"""Non-secret settings, read from the environment or a local .env file.

Wavelength never reads API keys from the environment or from files. Keys are
supplied by the user through the UI at runtime and kept only in process memory
(see app.secrets).
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql://wavelength:wavelength@localhost:5432/wavelength"
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
