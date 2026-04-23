import os

def env(name: str, default: str | None = None) -> str:
    v = os.getenv(name, default)
    if v is None:
        raise RuntimeError(f"Missing required env var: {name}")
    return v

GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "")
BQ_DATASET_ID = os.getenv("BQ_DATASET_ID", "")
BASE_URL = os.getenv("BASE_URL", "http://localhost:8080")

DATABASE_URL = os.getenv("CONNECTOR_DATABASE_URL", "sqlite:///./connector.db")

QBO_CLIENT_ID = env("QBO_CLIENT_ID", "")
QBO_CLIENT_SECRET = env("QBO_CLIENT_SECRET", "")
QBO_REDIRECT_URI = env("QBO_REDIRECT_URI", f"{BASE_URL}/oauth/qbo/callback")

XERO_CLIENT_ID = env("XERO_CLIENT_ID", "")
XERO_CLIENT_SECRET = env("XERO_CLIENT_SECRET", "")
XERO_REDIRECT_URI = env("XERO_REDIRECT_URI", f"{BASE_URL}/oauth/xero/callback")
