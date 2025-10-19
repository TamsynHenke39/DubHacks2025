# payments/config.py
# Centralized configuration for the isolated payments service.
# Loads environment variables from payments/.env if present.

import os
from dataclasses import dataclass
from typing import Optional, List

from dotenv import load_dotenv

# Try to load a local .env file sitting in the payments directory
# Note: The app runs from repo root, so this relative path works.
load_dotenv(dotenv_path=os.path.join("payments", ".env"), override=False)


@dataclass(frozen=True)
class Settings:
    service_name: str
    service_version: str
    currency: str
    max_tx_cents: int
    cors_allowed_origins: Optional[List[str]]
    database_url: str
    idempotency_ttl_seconds: int

    cybersource_environment: str
    cybersource_auth_type: str
    cybersource_merchant_id: Optional[str]
    cybersource_key_id: Optional[str]
    cybersource_shared_secret: Optional[str]
    # If using JWT auth instead of http_signature (optional fields):
    cybersource_jwt_key_alias: Optional[str] = None
    cybersource_jwt_key_password: Optional[str] = None
    cybersource_jwt_key_file: Optional[str] = None

    # Stripe
    stripe_secret_key: Optional[str] = None


def _parse_origins(value: Optional[str]) -> Optional[List[str]]:
    if not value:
        return None
    return [v.strip() for v in value.split(",") if v.strip()]


def load_settings() -> Settings:
    return Settings(
        service_name=os.getenv("PAYMENTS_SERVICE_NAME", "payments"),
        service_version=os.getenv("PAYMENTS_SERVICE_VERSION", "0.1.0"),
        currency=os.getenv("PAYMENTS_CURRENCY", "USD"),
        max_tx_cents=int(os.getenv("PAYMENTS_MAX_TX_CENTS", "50000")),
        cors_allowed_origins=_parse_origins(os.getenv("PAYMENTS_CORS_ALLOWED_ORIGINS")),
        database_url=os.getenv("DATABASE_URL", "sqlite:///payments/payments.db"),
        idempotency_ttl_seconds=int(os.getenv("IDEMPOTENCY_TTL_SECONDS", "86400")),
        cybersource_environment=os.getenv("CYBERSOURCE_ENVIRONMENT", "sandbox"),
        cybersource_auth_type=os.getenv("CYBERSOURCE_AUTH_TYPE", "http_signature"),
        cybersource_merchant_id=os.getenv("CYBERSOURCE_MERCHANT_ID"),
        cybersource_key_id=os.getenv("CYBERSOURCE_KEY_ID"),
        cybersource_shared_secret=os.getenv("CYBERSOURCE_SHARED_SECRET"),
        cybersource_jwt_key_alias=os.getenv("CYBERSOURCE_JWT_KEY_ALIAS"),
        cybersource_jwt_key_password=os.getenv("CYBERSOURCE_JWT_KEY_PASSWORD"),
        cybersource_jwt_key_file=os.getenv("CYBERSOURCE_JWT_KEY_FILE"),
        stripe_secret_key=os.getenv("STRIPE_SECRET_KEY"),
    )


SETTINGS = load_settings()
