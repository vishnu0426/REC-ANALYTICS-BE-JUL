"""
Provider abstraction (ADR-001).

Every provider declares which deployment modes it's compatible with. The
registry functions below refuse to hand back a provider that doesn't match
the org's `deployment_mode` — this is the gate that makes it structurally
impossible for an air-gapped deployment to accidentally call a cloud API.

STT: cloud transcription is real, via DeepgramProvider or GoogleSTTProvider
(selected by STT_PROVIDER), both implementing the same `transcribe()`
contract. MockSTTProvider remains as a no-key-required fallback so the full
downstream pipeline (LLM analysis -> QA -> compliance -> sentiment ->
analytics) can still be exercised end-to-end without cloud credentials or a
GPU. Swap in FasterWhisperProvider for an air-gapped/local deployment by
implementing the same contract — nothing else in the pipeline needs to
change.

LLM: this scaffold calls the real OpenAI API when a key is configured, which
is the "cloud" provider. `OllamaProvider` is stubbed as the local equivalent
for air-gapped installs — point it at a local Ollama instance running a
model like llama3 or qwen2.5, same JSON-contract in, JSON out.
"""
import json
import os
import random
from abc import ABC, abstractmethod
from typing import Literal

from app.core.config import get_settings

settings = get_settings()

DeploymentMode = Literal["cloud", "air_gapped", "hybrid"]


# ---------------------------------------------------------------------------
# Speech-to-text
# ---------------------------------------------------------------------------

class STTProvider(ABC):
    compatible_modes: set = {"cloud", "air_gapped", "hybrid"}

    @abstractmethod
    def transcribe(self, audio_bytes: bytes, filename: str) -> list[dict]:
        """Returns a list of segments: [{speaker_role, start_time, end_time, text, confidence}]"""
        ...


class MockSTTProvider(STTProvider):
    """
    Demo/dev stand-in used when no cloud STT credentials are configured.
    Generates a plausible, varied support-call transcript so the rest of the
    pipeline (which is the actually interesting part of this codebase) has
    real content to work on. DeepgramProvider and GoogleSTTProvider return
    the identical segment shape for real transcription.
    """
    compatible_modes = {"cloud", "air_gapped", "hybrid"}

    _SCENARIOS = [
        {
            "topic": "billing dispute",
            "lines": [
                ("agent", "Thank you for calling support, my name is Alex, how can I help you today?"),
                ("customer", "Hi, I was charged twice for my subscription this month and I need that fixed."),
                ("agent", "I'm sorry to hear that. Can you confirm the last four digits of the card on file?"),
                ("customer", "Yes, it's 4471."),
                ("agent", "Thank you. I can see the duplicate charge from March 3rd. I'll refund that now."),
                ("customer", "Okay, how long will the refund take?"),
                ("agent", "Five to seven business days back to your original payment method."),
                ("customer", "Alright, that works. Thanks for sorting it out quickly."),
                ("agent", "Of course. Is there anything else I can help with today?"),
                ("customer", "No, that's everything. Thank you."),
                ("agent", "Thanks for calling, have a great day."),
            ],
        },
        {
            "topic": "internet connectivity issue",
            "lines": [
                ("agent", "Hello, thanks for calling technical support, this is Jordan."),
                ("customer", "My internet has been dropping every twenty minutes for two days now."),
                ("agent", "That's frustrating, let's get that sorted. Can I get your account email first?"),
                ("customer", "It's jsmith@example.com."),
                ("agent", "Got it. I see some signal errors on your line. Let's try restarting the router."),
                ("customer", "I've already tried that three times, it didn't help."),
                ("agent", "Understood. In that case I'd like to schedule a technician visit."),
                ("customer", "This is the second time this has happened this month, it's really frustrating."),
                ("agent", "I completely understand, I'll also apply a service credit for the downtime."),
                ("customer", "Okay, I appreciate that. When can the technician come?"),
                ("agent", "I have an opening tomorrow between 9 and 11am, does that work?"),
                ("customer", "Yes that works. Thank you."),
            ],
        },
        {
            "topic": "cancellation request",
            "lines": [
                ("agent", "Hi, this is Sam from customer care, how can I help?"),
                ("customer", "I'd like to cancel my subscription, I'm not using it anymore."),
                ("agent", "I'm sorry to hear that. Can I ask what's driving the cancellation?"),
                ("customer", "It's just too expensive for what I'm getting out of it."),
                ("agent", "That's fair. We do have a discounted plan, would you like to hear about it?"),
                ("customer", "No thanks, I'd just like to cancel."),
                ("agent", "No problem, I've processed the cancellation effective end of billing cycle."),
                ("customer", "Great, thank you."),
                ("agent", "You're welcome, thanks for being a customer."),
            ],
        },
    ]

    def transcribe(self, audio_bytes: bytes, filename: str) -> list[dict]:
        scenario = random.choice(self._SCENARIOS)
        segments = []
        t = 0.0
        for i, (role, text) in enumerate(scenario["lines"]):
            duration = max(2.0, len(text.split()) / 2.4)  # rough words-per-second pacing
            segments.append({
                "sequence": i,
                "speaker_role": role,
                "start_time": round(t, 1),
                "end_time": round(t + duration, 1),
                "text": text,
                "confidence": round(random.uniform(0.90, 0.99), 2),
            })
            t += duration + random.uniform(0.3, 1.2)  # inter-turn gap / natural pause
        return segments


class DeepgramProvider(STTProvider):
    """
    Cloud STT via Deepgram's prerecorded transcription API. Uses raw HTTP
    (urllib) rather than the deepgram-sdk package, matching the lightweight
    dependency approach OllamaProvider takes below.
    """
    compatible_modes = {"cloud", "hybrid"}

    def __init__(self):
        if not settings.deepgram_api_key:
            raise RuntimeError("DEEPGRAM_API_KEY not configured")
        self._api_key = settings.deepgram_api_key

    def transcribe(self, audio_bytes: bytes, filename: str) -> list[dict]:
        import urllib.request

        # `audio_bytes` has already been normalized to plain PCM WAV by
        # `pipeline.py::_normalize_audio` regardless of the original
        # filename's extension/codec, so the content-type is always WAV here
        # — it must not be guessed from `filename` any more.
        url = ("https://api.deepgram.com/v1/listen"
               "?model=nova-2&diarize=true&punctuate=true&utterances=true&smart_format=true")
        req = urllib.request.Request(url, data=audio_bytes, method="POST", headers={
            "Authorization": f"Token {self._api_key}",
            "Content-Type": "audio/wav",
        })
        with urllib.request.urlopen(req, timeout=300) as resp:
            body = json.loads(resp.read())

        segments = []
        for i, u in enumerate(body["results"]["utterances"]):
            segments.append({
                "sequence": i,
                # Diarization gives numeric speaker indices, not roles.
                # Speaker 0 is assumed to be the agent since agents answer
                # and open the call in the support-line recordings this
                # pipeline processes.
                "speaker_role": "agent" if u["speaker"] == 0 else "customer",
                "start_time": round(u["start"], 1),
                "end_time": round(u["end"], 1),
                "text": u["transcript"],
                "confidence": round(u["confidence"], 2),
            })
        return segments


class GoogleSTTProvider(STTProvider):
    """
    Cloud STT via Google Cloud Speech-to-Text. Authenticates via
    GOOGLE_APPLICATION_CREDENTIALS, the standard google-cloud-speech
    client convention.
    """
    compatible_modes = {"cloud", "hybrid"}

    def __init__(self):
        if not settings.google_application_credentials:
            raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS not configured")
        os.environ.setdefault("GOOGLE_APPLICATION_CREDENTIALS", settings.google_application_credentials)

    def transcribe(self, audio_bytes: bytes, filename: str) -> list[dict]:
        from google.cloud import speech

        client = speech.SpeechClient()
        config = speech.RecognitionConfig(
            language_code="en-US",
            enable_automatic_punctuation=True,
            diarization_config=speech.SpeakerDiarizationConfig(
                enable_speaker_diarization=True,
                min_speaker_count=2,
                max_speaker_count=2,
            ),
        )
        audio = speech.RecognitionAudio(content=audio_bytes)
        response = client.long_running_recognize(config=config, audio=audio).result(timeout=600)
        if not response.results:
            return []

        # Only the last result carries the final, cumulative per-word
        # speaker tags for the whole file.
        last_alternative = response.results[-1].alternatives[0]
        confidence = round(last_alternative.confidence, 2) if last_alternative.confidence else 0.9

        segments = []
        current = None
        for w in last_alternative.words:
            role = "agent" if w.speaker_tag == 1 else "customer"
            if current and current["speaker_role"] == role:
                current["text"] += f" {w.word}"
                current["end_time"] = round(w.end_time.total_seconds(), 1)
            else:
                if current:
                    segments.append(current)
                current = {
                    "sequence": len(segments),
                    "speaker_role": role,
                    "start_time": round(w.start_time.total_seconds(), 1),
                    "end_time": round(w.end_time.total_seconds(), 1),
                    "text": w.word,
                    "confidence": confidence,
                }
        if current:
            segments.append(current)
        return segments


def get_stt_provider() -> STTProvider:
    mode = settings.deployment_mode
    choice = settings.stt_provider.lower()
    if choice == "deepgram" and settings.deepgram_api_key:
        provider = DeepgramProvider()
    elif choice == "google" and settings.google_application_credentials:
        provider = GoogleSTTProvider()
    else:
        provider = MockSTTProvider()

    if mode not in provider.compatible_modes:
        raise RuntimeError(f"No STT provider compatible with deployment_mode={mode}")
    return provider


# ---------------------------------------------------------------------------
# LLM
# ---------------------------------------------------------------------------

class LLMProvider(ABC):
    compatible_modes: set = {"cloud", "air_gapped", "hybrid"}

    @abstractmethod
    def generate_json(self, system: str, prompt: str) -> dict:
        ...


class OpenAIProvider(LLMProvider):
    compatible_modes = {"cloud", "hybrid"}

    def __init__(self):
        import openai
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY not configured")
        self._client = openai.OpenAI(api_key=settings.openai_api_key)

    def generate_json(self, system: str, prompt: str) -> dict:
        response = self._client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        )
        return json.loads(response.choices[0].message.content)


class MockLLMProvider(LLMProvider):
    """
    Instant, no-network stand-in for load-testing/local dev — mirrors
    MockSTTProvider's role. Returns a canned dict matching every key
    `pipeline.py::_stage_llm_analysis`'s prompt schema declares, since every
    downstream stage (_stage_qa, _stage_compliance,
    _stage_extraction_labeling, _stage_insights, _stage_sentiment_emotion,
    _stage_analytics, _stage_timeline_and_recommendations) reads specific
    keys/shapes off this dict. `_QA_CRITERIA`/`_LABEL_KEYS` below duplicate
    pipeline.QA_CRITERIA / the `labels` schema fields rather than importing
    pipeline.py (which already imports this module) — keep in sync if either
    changes.
    """
    compatible_modes = {"cloud", "air_gapped", "hybrid"}

    _QA_CRITERIA = [
        "greeting", "identity_verification", "listening", "empathy",
        "communication", "professionalism", "knowledge", "resolution", "closing",
    ]
    _LABEL_KEYS = [
        "urgent", "escalation_required", "satisfaction_survey",
        "training_opportunity", "upsell_opportunity",
    ]

    def generate_json(self, system: str, prompt: str) -> dict:
        return {
            "executive_summary": "Mock call: customer asked about billing, agent resolved it.",
            "detailed_summary": "Customer called regarding a billing question. Agent verified "
                                 "the account, explained the charge, and resolved the issue.",
            "key_discussion_points": ["billing charge", "account verification"],
            "final_resolution": "Charge explained and confirmed correct.",
            "action_items": [{"description": "Follow up with customer in 3 days", "owner": "agent"}],
            "intent": "billing",
            "main_topic": "billing inquiry",
            "sub_topics": ["charge dispute"],
            "keywords": ["billing", "charge", "refund"],
            "root_cause": "Customer did not recognize a recurring charge.",
            "outcome": "resolved",
            "customer_info": {"name": "Mock Customer", "phone": None, "email": None, "account_id": None},
            "call_reason": {"primary": "billing question", "secondary": None},
            "resolution_summary": "Explained the charge; customer satisfied.",
            "follow_up": {"required": True, "reason": "Confirm refund posts correctly."},
            "classification": {"category": "billing", "subcategory": None, "complexity": "low"},
            "labels": {k: (k in ("urgent", "satisfaction_survey")) for k in self._LABEL_KEYS},
            "qa_scores": [
                {"criterion": c, "score": 80.0, "explanation": "Mock evaluation.",
                 "evidence": "Mock transcript evidence.", "timestamp": 5.0, "confidence": 0.9}
                for c in self._QA_CRITERIA
            ],
            "qa_strengths": "Clear communication.",
            "qa_weaknesses": "Could confirm identity earlier.",
            "qa_coaching_suggestions": "Verify identity before discussing account details.",
            "qa_improvement_plan": "Practice identity verification scripts.",
            "compliance_violations": [
                {"rule_code": "IDENTITY_VERIFICATION_MISSING", "category": "identity", "severity": "medium",
                 "timestamp": 3.0, "explanation": "Mock violation for load-test coverage.",
                 "evidence": "Mock transcript evidence."},
            ],
            "sentiment": {
                "overall": "positive", "beginning": "neutral", "middle": "neutral", "end": "positive",
                "timeline": [{"timestamp": 5.0, "score": 0.2, "label": "neutral"},
                             {"timestamp": 20.0, "score": 0.6, "label": "positive"}],
            },
            "emotion": {
                "dominant_customer": "calm", "dominant_agent": "professional",
                "timeline": [{"timestamp": 5.0, "emotion": "calm", "confidence": 0.8}],
            },
            "timeline_events": [
                {"event_type": "greeting", "start_time": 0.0, "end_time": 3.0, "description": "Agent greets customer."},
                {"event_type": "solution", "start_time": 10.0, "end_time": 15.0, "description": "Agent explains charge."},
            ],
            "observations": [{"text": "Agent handled the billing question efficiently.", "timestamp": 10.0, "category": "positive"}],
            "recommendations": [{"category": "coaching", "text": "Verify identity earlier in the call.", "priority": "medium"}],
            "customer_risk_level": "low",
            "escalation_risk": 0.1,
            "churn_risk": 0.1,
            "csat_prediction": 0.8,
            "repeat_call_probability": 0.1,
        }


class OllamaProvider(LLMProvider):
    """Air-gapped local equivalent. Point OLLAMA_HOST at a local instance
    running e.g. `ollama run llama3.1`. Same JSON-contract as OpenAIProvider."""
    compatible_modes = {"air_gapped", "hybrid"}

    def __init__(self, host: str = None):
        self._host = host or os.environ.get("OLLAMA_HOST", "http://localhost:11434")

    def generate_json(self, system: str, prompt: str) -> dict:
        import urllib.request
        payload = json.dumps({
            "model": os.environ.get("OLLAMA_MODEL", "llama3.1"),
            "system": system + "\n\nRespond with ONLY valid JSON.",
            "prompt": prompt,
            "stream": False,
            "format": "json",
        }).encode()
        req = urllib.request.Request(f"{self._host}/api/generate", data=payload,
                                      headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read())
        return json.loads(body["response"])


def get_llm_provider() -> LLMProvider:
    if settings.llm_provider.lower() == "mock":
        return MockLLMProvider()
    mode = settings.deployment_mode
    if mode == "air_gapped":
        return OllamaProvider()
    # cloud or hybrid: prefer OpenAI if configured, else fall back to Ollama
    if settings.openai_api_key:
        return OpenAIProvider()
    return OllamaProvider()
