import re
from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Core services
    database_url: str = "postgresql+psycopg://AgnoCall:AgnoCall@localhost:5432/AgnoCall"
    redis_url: str = "redis://localhost:6379/0"

    # MinIO / S3-compatible object storage
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "AgnoCall"
    minio_secret_key: str = "AgnoCall123"
    minio_bucket: str = "call-recordings"
    minio_secure: bool = False
    # Endpoint used when building presigned URLs the *browser* will call directly.
    # Inside docker-compose the backend talks to MinIO via the "minio" service
    # name, but a presigned URL handed to the frontend must resolve from the
    # user's machine, hence a separate public endpoint.
    minio_public_endpoint: str = "localhost:9000"

    # Provider abstraction (ADR-001): deployment_mode gates which providers
    # are even selectable — "air_gapped" disables every *Cloud provider.
    deployment_mode: str = "hybrid"  # cloud | air_gapped | hybrid
    openai_api_key: str = ""
    # gpt-4o-mini is several times faster/cheaper at some quality cost; set
    # OPENAI_MODEL to trade accuracy for processing time.
    openai_model: str = "gpt-4o"
    # "auto" preserves existing OpenAI/Ollama selection; "mock" forces the
    # instant, no-network MockLLMProvider (load-testing / local dev only).
    llm_provider: str = "auto"

    # Browser origin allowed by CORS. "*" is the dev default; set to the real
    # frontend origin (e.g. "https://calls.example.com") in production.
    frontend_origin: str = "*"

    # Speech-to-text provider selection: deepgram | google | mock
    stt_provider: str = "deepgram"
    deepgram_api_key: str = ""
    # Path to a Google Cloud service account JSON key (same convention as
    # GOOGLE_APPLICATION_CREDENTIALS used by the google-cloud-speech client).
    google_application_credentials: str = ""

    # Optional absolute path to the ffmpeg binary, for hosts (e.g. Windows
    # workers) where it isn't on the process PATH. Empty = look up on PATH.
    ffmpeg_path: str = ""

    # Forms module (ported from the Form Builder project): secret used to sign
    # and verify the form-builder JWTs (FB's JWT_SECRET env var).
    forms_jwt_secret: str = "form_builder_secret_key"

    class Config:
        env_file = ".env"

    @field_validator("minio_endpoint", "minio_public_endpoint")
    @classmethod
    def _strip_scheme(cls, value: str) -> str:
        # The minio-py client rejects an endpoint that includes a scheme
        # ("ValueError: path in endpoint is not allowed") — it wants a bare
        # host:port and derives http vs. https solely from `minio_secure`.
        # Stripping any accidental http(s):// prefix here means .env can be
        # written either way without silently breaking the client at import
        # time (minio_client.py constructs both clients at module load).
        return re.sub(r"^https?://", "", value).rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
