"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """All env-var driven settings for the agent backend."""

    # Database
    database_url: str = "postgresql+asyncpg://localhost:5432/fuzebox_telemetry"

    # LLM
    openai_api_key: str = ""
    openai_model: str = "gpt-5.4-mini"
    evaluator_model: str = "gpt-5.4-mini"
    fallback_model: str = "gpt-4.1-nano"

    # CORS
    cors_origins: str = "http://localhost:5173"

    # Observability
    sentry_dsn: str = ""

    # Rate limiting
    rate_limit_run: str = "10/minute"
    rate_limit_read: str = "60/minute"

    # Agent pipeline
    max_iterations: int = 10  # Recursion cap per agent per session
    agent_timeout_s: int = 30  # Per-agent LLM call timeout
    max_input_length: int = 5000  # Max chars for input validation

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
