import requests
from urllib.parse import urlencode
from app.config import XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI

XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize"
XERO_TOKEN_URL = "https://identity.xero.com/connect/token"
XERO_CONNECTIONS_URL = "https://api.xero.com/connections"
XERO_API_BASE = "https://api.xero.com/api.xro/2.0"

def build_auth_url(state: str) -> str:
    params = {
        "response_type": "code",
        "client_id": XERO_CLIENT_ID,
        "redirect_uri": XERO_REDIRECT_URI,
        "scope": "offline_access openid profile email accounting.invoices accounting.contacts accounting.settings",
        "state": state,
    }
    return f"{XERO_AUTH_URL}?{urlencode(params)}"

def exchange_code_for_tokens(code: str) -> dict:
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": XERO_REDIRECT_URI,
    }
    r = requests.post(XERO_TOKEN_URL, data=data, auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET), timeout=30)
    r.raise_for_status()
    return r.json()

def refresh_tokens(refresh_token: str) -> dict:
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    r = requests.post(XERO_TOKEN_URL, data=data, auth=(XERO_CLIENT_ID, XERO_CLIENT_SECRET), timeout=30)
    r.raise_for_status()
    return r.json()

def list_connections(access_token: str) -> list[dict]:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    r = requests.get(XERO_CONNECTIONS_URL, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()

def get_report(access_token: str, xero_tenant_id: str, report_name: str, params: dict | None = None) -> dict:
    params = params or {}
    url = f"{XERO_API_BASE}/Reports/{report_name}"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json", "xero-tenant-id": xero_tenant_id}
    r = requests.get(url, headers=headers, params=params, timeout=60)
    r.raise_for_status()
    return r.json()

def get_accounts(access_token: str, xero_tenant_id: str) -> dict:
    url = f"{XERO_API_BASE}/Accounts"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json", "xero-tenant-id": xero_tenant_id}
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()

def get_contacts(access_token: str, xero_tenant_id: str) -> dict:
    url = f"{XERO_API_BASE}/Contacts"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json", "xero-tenant-id": xero_tenant_id}
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    return r.json()
