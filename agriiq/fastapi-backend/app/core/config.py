"""
Application configuration loaded from environment variables / .env file.
Uses pydantic-settings for typed, validated settings.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        protected_namespaces=("settings_",),
    )

    # ── Database ──────────────────────────────────────────────────────────────
    # psycopg3 connection string: postgresql://user:pass@host:port/dbname
    database_url: str = "postgresql://agriiq:agriiq_secret@localhost:5432/agriiq"

    # ── JWT ───────────────────────────────────────────────────────────────────
    jwt_secret: str = "dev_secret_key_must_be_at_least_256_bits_long_in_production_abc"
    jwt_expiration_seconds: int = 86400  # 24 hours
    jwt_algorithm: str = "HS256"

    # ── ML model ──────────────────────────────────────────────────────────────
    model_dir: str = "ml_models"

    # ── Provider switches ─────────────────────────────────────────────────────
    # "mock" = synthetic data; "live" = real external APIs
    ndvi_provider: str = "mock"
    soil_provider: str = "mock"

    # ── External API keys (only used when provider=live) ─────────────────────
    sentinel_hub_client_id: str = ""
    sentinel_hub_client_secret: str = ""
    agmarknet_api_key: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:80",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

    # ── Application ───────────────────────────────────────────────────────────
    app_name: str = "AgriIQ API"
    app_version: str = "2.0.0"
    debug: bool = False

    @field_validator("jwt_secret")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters long")
        return v

    @property
    def model_dir_path(self) -> Path:
        return Path(self.model_dir)


@lru_cache
def get_settings() -> Settings:
    """Return cached Settings instance. Import this everywhere."""
    return Settings()


settings = get_settings()
