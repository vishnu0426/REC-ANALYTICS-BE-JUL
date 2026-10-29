# Architecture Decision Records (ADRs)

## ADR-001: Provider abstraction must be deployment-mode-aware, not just interface-swappable

**Status:** Decided
**Context:** The platform must support cloud-first, air-gapped, and hybrid deployments, with STT/LLM/embedding providers switchable per org.

**Decision:** The provider abstraction is a two-layer design:

1. A `ProviderInterface` (Protocol/ABC in Python) per capability — `SpeechToTextProvider`, `LLMProvider`, `EmbeddingProvider` — with concrete implementations (`WhisperLocal`, `FasterWhisperLocal`, `DeepgramCloud`, `AzureSpeechCloud`, `GoogleSTTCloud`; `OllamaLocal`, `OpenAICloud`, `AnthropicCloud`, `GeminiCloud`; `BGELocal`, `NomicLocal`, `OpenAIEmbeddingCloud`, `GeminiEmbeddingCloud`).
2. A **deployment-mode gate** sitting in front of the interface, driven by `organizations.deployment_mode`:
   - `air_gapped` → only `*Local` implementations are registered/selectable at all; cloud provider classes aren't even loaded into the provider registry for that org's config UI.
   - `cloud` → all providers available.
   - `hybrid` → available per-org, but individual data classifications (e.g., calls tagged as containing regulated PII) can be routed to local-only providers even within a cloud-enabled org.

**Why this matters:** Treating this as "just implement an interface and let the user pick" would let someone accidentally configure an air-gapped deployment to call OpenAI's API — a compliance failure, not a bug you want discovered in production. The gate belongs in the provider *registry* construction, not as a runtime check the caller has to remember to make.

**Consequence:** Every new provider added later must declare its deployment-mode compatibility (`local` / `cloud`) as a class attribute, enforced by a test that fails CI if an air-gapped-incompatible provider is registered without the flag.

---

## ADR-002: Qdrant deferred to Phase 2; OpenSearch carries all search in v1

**Status:** Decided
**Context:** Spec calls for both Qdrant (semantic search) and OpenSearch (transcript/keyword search). Running both from day one adds real operational surface — two more stateful services to deploy, monitor, back up, and secure, especially painful in air-gapped/on-prem installs where every additional service is something the customer's ops team has to operate themselves.

**Decision:** Launch with OpenSearch only. It covers lexical/keyword search (`"internet complaint"`), structured filtering (QA score ranges, compliance status, date ranges), and reasonably good fuzzy matching. The Global AI Search feature's natural-language queries (e.g., "show angry customers") are handled by translating the NL query into **structured OpenSearch filters via an LLM parsing step**, not via vector similarity — for the listed example queries (sentiment, keyword mentions, score thresholds, resolution status), structured filtering is sufficient and cheaper to operate.

Add Qdrant in Phase 2 when a genuine semantic-similarity requirement emerges — e.g., "find calls similar to this one" or RAG-style retrieval for a future agent-assist feature — rather than building it speculatively.

**Consequence:** The search service's query-parsing layer should be designed with a pluggable "resolution strategy" per parsed intent, so adding a vector-search resolution path later doesn't require re-architecting the endpoint — just adding a new strategy alongside the structured-filter one.

---

## ADR-003: GPU-bound stages get their own worker pool, isolated from CPU-bound stages

**Status:** Decided
**Context:** Diarization (pyannote) and STT (Whisper family) are GPU/compute-heavy and are the actual throughput bottleneck for "millions of calls per month" — not the LLM calls, which are I/O-bound (network-latency-bound) whether cloud or local-via-Ollama.

**Decision:** Celery worker pools are split by resource profile, not strictly by pipeline stage:

- **GPU pool** (Audio, Diarization, Speech workers) — sized and autoscaled against GPU node availability; queue depth here is the primary capacity-planning signal.
- **CPU/IO pool** (LLM, QA, Compliance, Analytics, Report workers) — scales on standard CPU/memory metrics and concurrent-request limits against whatever LLM provider is active.

Each pool has its own Celery queue name and its own autoscaling policy in Kubernetes (separate `HorizontalPodAutoscaler` targets, GPU pool on a node pool with GPU taints/tolerations).

**Consequence:** Capacity planning conversations with infrastructure teams should center on GPU node count first — that's the real cost and scaling constraint at enterprise volume, not worker replica count in general.

---

## ADR-004: Masked and unmasked transcript text are separate columns with independent access control

**Status:** Decided
**Context:** PII masking must be applied before most viewers see a transcript, but some workflows (compliance investigation, legal hold) genuinely need the unmasked version.

**Decision:** Store both `text_masked` and `text_unmasked` at the segment level. Default read path returns masked only. Unmasked access requires an elevated permission scope AND is audit-logged on every access (see `audit_logs`), not just gated by a UI toggle. `full_text_unmasked` should additionally be encrypted at the column level (not just disk-level encryption) so a database-level compromise doesn't expose it without the application-layer key.

**Consequence:** This roughly doubles transcript storage size. Acceptable tradeoff given the compliance requirement — do not "compute masking on the fly" from a single unmasked column, since that pattern tends to leak the unmasked text into logs, caches, or search indexes by accident.

---

## ADR-005: QA scorecards are templated and versioned, not hardcoded to a fixed 9-criteria model

**Status:** Decided
**Context:** The spec's 9 criteria (greeting, identity verification, listening, empathy, communication, professionalism, knowledge, resolution, closing) are a sensible default, but different verticals and even different teams within one org will want different weightings or additional criteria (e.g., a collections team needs a "disclosure read verbatim" criterion that a tech-support team doesn't).

**Decision:** `qa_scorecard_templates` holds criteria definitions as data, not code. The QA Worker's LLM prompt is constructed dynamically from the active template. Every `qa_evaluations` row pins the `template_id` used, so a template edit doesn't retroactively change the interpretation of historical scores.

**Consequence:** Slightly more complex prompt-construction logic in the QA Worker, but this avoids a redeployment every time a QA manager wants to add or reweight a criterion — a very common ask in the first few months of any real rollout.

---

## ADR-006: Compliance rules are authored as natural language, compiled to detection prompts at evaluation time

**Status:** Decided
**Context:** Legacy platforms (CallMiner-era) rely on analyst-maintained keyword/phrase lists that are brittle and require significant ongoing tuning effort — a documented pain point in the market research. The intent-based alternative (understanding what was meant, not exact phrasing) is the differentiator worth building toward.

**Decision:** Compliance rules are authored in plain language by compliance/legal staff (`compliance_rules.rule_logic`) through the settings UI, not as regex/keyword lists. The Compliance Worker compiles the active rule set into a structured LLM evaluation prompt at call-processing time, with each rule mapped to a schema-constrained output (triggered: bool, timestamp, evidence, severity) so results remain structured and auditable rather than free-text LLM output.

**Consequence:** This shifts real accuracy risk onto prompt engineering and evaluation quality rather than pattern-matching bugs — mitigate with a **golden-set regression suite**: a maintained library of calls with known, human-labeled violations that every rule-set or prompt change must be tested against before deploying to production. This is arguably the single most important quality-assurance investment for the whole platform, and should be built early, not bolted on later.
