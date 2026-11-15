"""Settings loaded from environment variables (or a local .env file).

Secrets live only in the process environment. They are never written to the
database, never returned by the API and never sent to the frontend.
"""

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    llm_provider: Literal["anthropic", "openai"] = "anthropic"
    anthropic_api_key: SecretStr | None = None
    anthropic_model: str = "claude-sonnet-5-5"
    anthropic_fast_model: str = "claude-haiku-5-5"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4.1-mini"

    voyage_api_key: SecretStr | None = None
    database_url: str = "postgresql+psycopg://wavelength:wavelength@localhost:5432/wavelength"

    spotify_client_id: str | None = None
    spotify_client_secret: SecretStr | None = None
    ticketmaster_api_key: SecretStr | None = None
    lastfm_api_key: SecretStr | None = None

    cors_origins: str = "http://localhost:5173"
    rate_limit: str = "20/minute"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
