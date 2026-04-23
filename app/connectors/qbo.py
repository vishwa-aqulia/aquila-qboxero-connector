import base64
import requests
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode
from app.config import QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, BASE_URL

INTUIT_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
INTUIT_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
QBO_API_BASE = "https://quickbooks.api.intuit.com/v3/company"

def build_auth_url(state: str) -> str:
    params = {
        "client_id": QBO_CLIENT_ID,
        "response_type": "code",
        "scope": "com.intuit.quickbooks.accounting",
        "redirect_uri": QBO_REDIRECT_URI,
        "state": state,
    }
    return f"{INTUIT_AUTH_URL}?{urlencode(params)}"

def exchange_code_for_tokens(code: str) -> dict:
    basic = base64.b64encode(f"{QBO_CLIENT_ID}:{QBO_CLIENT_SECRET}".encode()).decode()
    headers = {
        "Authorization": f"Basic {basic}",
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": QBO_REDIRECT_URI,
    }
    r = requests.post(INTUIT_TOKEN_URL, headers=headers, data=data, timeout=30)
    r.raise_for_status()
    return r.json()

def refresh_tokens(refresh_token: str) -> dict:
    basic = base64.b64encode(f"{QBO_CLIENT_ID}:{QBO_CLIENT_SECRET}".encode()).decode()
    headers = {
        "Authorization": f"Basic {basic}",
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    r = requests.post(INTUIT_TOKEN_URL, headers=headers, data=data, timeout=30)
    r.raise_for_status()
    return r.json()

def get_report(access_token: str, realm_id: str, report_name: str, params: dict | None = None) -> dict:
    params = params or {}
    url = f"{QBO_API_BASE}/{realm_id}/reports/{report_name}"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    r = requests.get(url, headers=headers, params=params, timeout=60)
    r.raise_for_status()
    return r.json()

def get_company_info(access_token: str, realm_id: str) -> dict:
    url = f"{QBO_API_BASE}/{realm_id}/companyinfo/{realm_id}"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    r = requests.get(url, headers=headers, timeout=30)
    r.raise_for_status()
    return r.json()

def query(access_token: str, realm_id: str, query: str) -> dict:
    url = f"{QBO_API_BASE}/{realm_id}/query"
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json", "Content-Type": "application/text"}
    r = requests.post(url, headers=headers, data=query, timeout=60)
    r.raise_for_status()
    return r.json()
