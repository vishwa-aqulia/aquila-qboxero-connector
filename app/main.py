from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
import uuid
from datetime import datetime, timedelta, timezone

from google.cloud import bigquery
import json

from app.db.db import SessionLocal, init_db
from app.db.models import Connection
from app.bq.schema import ensure_tables
from app.bq.client import get_bq_client
from app.bq.loader import load_json_rows, now_ts

from app.connectors import qbo as qbo_api
from app.connectors import xero as xero_api
from app.transform.flatten import flatten_qbo_report, flatten_xero_report

app = FastAPI(title="Keystone Connector")

def db():
    d = SessionLocal()
    try:
        yield d
    finally:
        d.close()


def _token_needs_refresh(expires_at: datetime | None, skew_seconds: int = 120) -> bool:
    if expires_at is None:
        return True
    return datetime.now(timezone.utc) >= (expires_at - timedelta(seconds=skew_seconds))

def ensure_fresh_tokens(conn: Connection, db: Session) -> Connection:
    """Refresh tokens if they're near expiry.

    For a real SaaS:
    - encrypt refresh tokens at rest
    - add retries/backoff for transient errors
    - handle 'reconnect required' cleanly in your UI
    """
    if not conn.refresh_token:
        return conn

    if not _token_needs_refresh(conn.token_expires_at):
        return conn

    try:
        if conn.source == "qbo":
            tokens = qbo_api.refresh_tokens(conn.refresh_token)
            expires_in = int(tokens.get("expires_in", 3600))
            conn.access_token = tokens["access_token"]
            # Intuit may rotate refresh tokens - always store the latest
            if tokens.get("refresh_token"):
                conn.refresh_token = tokens["refresh_token"]
            conn.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        elif conn.source == "xero":
            tokens = xero_api.refresh_tokens(conn.refresh_token)
            expires_in = int(tokens.get("expires_in", 1800))
            conn.access_token = tokens["access_token"]
            # Xero rotates refresh tokens - always store the latest
            if tokens.get("refresh_token"):
                conn.refresh_token = tokens["refresh_token"]
            conn.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

        db.add(conn)
        db.commit()
        db.refresh(conn)
        return conn

    except Exception as e:
        # Most common cause: refresh token revoked/expired -> user must reconnect
        raise HTTPException(status_code=401, detail=f"Token refresh failed. Reconnect required. ({e})")

@app.on_event("startup")
def _startup():
    init_db()

@app.get("/health")
def health():
    return {"ok": True}

# ----------------------------
# OAuth start endpoints
# ----------------------------

@app.get("/oauth/qbo/start")
def qbo_start(tenant_id: str):
    state = f"qbo:{tenant_id}:{uuid.uuid4()}"
    return RedirectResponse(qbo_api.build_auth_url(state))

@app.get("/oauth/xero/start")
def xero_start(tenant_id: str):
    state = f"xero:{tenant_id}:{uuid.uuid4()}"
    return RedirectResponse(xero_api.build_auth_url(state))

# ----------------------------
# OAuth callback endpoints
# ----------------------------

@app.get("/oauth/qbo/callback")
def qbo_callback(code: str, realmId: str, state: str, db: Session = Depends(db)):
    # state = qbo:<tenant_id>:<nonce>
    parts = state.split(":")
    if len(parts) < 3 or parts[0] != "qbo":
        raise HTTPException(400, "Invalid state")
    tenant_id = parts[1]

    tokens = qbo_api.exchange_code_for_tokens(code)
    conn_id = str(uuid.uuid4())
    expires_in = int(tokens.get("expires_in", 3600))
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    conn = Connection(
        id=conn_id,
        tenant_id=tenant_id,
        source="qbo",
        realm_id=realmId,
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        token_expires_at=expires_at,
    )
    db.add(conn)
    db.commit()
    return {"connected": True, "connection_id": conn_id, "tenant_id": tenant_id, "realm_id": realmId}

@app.get("/oauth/xero/callback")
def xero_callback(code: str, state: str, db: Session = Depends(db)):
    parts = state.split(":")
    if len(parts) < 3 or parts[0] != "xero":
        raise HTTPException(400, "Invalid state")
    tenant_id = parts[1]

    tokens = xero_api.exchange_code_for_tokens(code)
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token")

    conns = xero_api.list_connections(access_token)
    if not conns:
        raise HTTPException(400, "No Xero connections returned")
    xero_tenant_id = conns[0].get("tenantId")

    conn_id = str(uuid.uuid4())
    conn = Connection(
        id=conn_id,
        tenant_id=tenant_id,
        source="xero",
        xero_tenant_id=xero_tenant_id,
        access_token=access_token,
        refresh_token=refresh_token,
        token_expires_at=datetime.now(timezone.utc) + timedelta(seconds=int(tokens.get('expires_in', 1800))),
    )
    db.add(conn)
    db.commit()
    return {"connected": True, "connection_id": conn_id, "tenant_id": tenant_id, "xero_tenant_id": xero_tenant_id}

# ----------------------------
# Sync endpoint (manual trigger)
# ----------------------------

@app.post("/sync/{connection_id}")
def run_sync(connection_id: str, db: Session = Depends(db)):
    conn = db.get(Connection, connection_id)
    if not conn:
        raise HTTPException(404, "Connection not found")

    conn = ensure_fresh_tokens(conn, db)

    bq = get_bq_client()
    ensure_tables(bq)

    ingested_at = now_ts()
    source_org_id = conn.realm_id if conn.source == "qbo" else conn.xero_tenant_id

    # 1) Pull accounts/contacts
    if conn.source == "xero":
        accounts_payload = xero_api.get_accounts(conn.access_token, conn.xero_tenant_id)
        contacts_payload = xero_api.get_contacts(conn.access_token, conn.xero_tenant_id)

        accounts = []
        for a in accounts_payload.get("Accounts", []):
            accounts.append({
                "tenant_id": conn.tenant_id,
                "source": "xero",
                "source_org_id": source_org_id,
                "account_id": a.get("AccountID"),
                "account_code": a.get("Code"),
                "name": a.get("Name"),
                "type": a.get("Type"),
                "subtype": None,
                "classification": a.get("Class"),
                "currency": None,
                "is_active": (a.get("Status") == "ACTIVE"),
                "updated_at": None,
                "ingested_at": ingested_at,
                "raw_json": json.dumps(a),
            })
        load_json_rows(bq, "accounts", accounts)

        contacts = []
        for c in contacts_payload.get("Contacts", []):
            contacts.append({
                "tenant_id": conn.tenant_id,
                "source": "xero",
                "source_org_id": source_org_id,
                "contact_id": c.get("ContactID"),
                "name": c.get("Name"),
                "contact_type": "unknown",
                "email": c.get("EmailAddress"),
                "phone": None,
                "is_active": (c.get("ContactStatus") == "ACTIVE"),
                "updated_at": None,
                "ingested_at": ingested_at,
                "raw_json": json.dumps(c),
            })
        load_json_rows(bq, "contacts", contacts)

        # 2) Pull core reports
        report_lines = []
        for rpt in ["ProfitAndLoss", "BalanceSheet", "TrialBalance", "AgedReceivables", "AgedPayables"]:
            payload = xero_api.get_report(conn.access_token, conn.xero_tenant_id, rpt)
            report_lines.extend(flatten_xero_report(rpt, payload, conn.tenant_id, source_org_id, ingested_at))
        load_json_rows(bq, "report_lines", report_lines)

    else:  # QBO
        # Accounts via query
        accounts_payload = qbo_api.query(conn.access_token, conn.realm_id, "SELECT * FROM Account STARTPOSITION 1 MAXRESULTS 1000")
        accounts = []
        for a in accounts_payload.get("QueryResponse", {}).get("Account", []):
            accounts.append({
                "tenant_id": conn.tenant_id,
                "source": "qbo",
                "source_org_id": source_org_id,
                "account_id": a.get("Id"),
                "account_code": a.get("AcctNum"),
                "name": a.get("Name"),
                "type": a.get("AccountType"),
                "subtype": a.get("AccountSubType"),
                "classification": a.get("Classification"),
                "currency": a.get("CurrencyRef", {}).get("value") if isinstance(a.get("CurrencyRef"), dict) else None,
                "is_active": a.get("Active"),
                "updated_at": a.get("MetaData", {}).get("LastUpdatedTime"),
                "ingested_at": ingested_at,
                "raw_json": json.dumps(a),
            })
        load_json_rows(bq, "accounts", accounts)

        # Contacts: Customers + Vendors (first 1000 of each)
        customers_payload = qbo_api.query(conn.access_token, conn.realm_id, "SELECT * FROM Customer STARTPOSITION 1 MAXRESULTS 1000")
        vendors_payload = qbo_api.query(conn.access_token, conn.realm_id, "SELECT * FROM Vendor STARTPOSITION 1 MAXRESULTS 1000")
        contacts = []
        for c in customers_payload.get("QueryResponse", {}).get("Customer", []):
            contacts.append({
                "tenant_id": conn.tenant_id,
                "source": "qbo",
                "source_org_id": source_org_id,
                "contact_id": c.get("Id"),
                "name": c.get("DisplayName"),
                "contact_type": "customer",
                "email": (c.get("PrimaryEmailAddr") or {}).get("Address") if isinstance(c.get("PrimaryEmailAddr"), dict) else None,
                "phone": (c.get("PrimaryPhone") or {}).get("FreeFormNumber") if isinstance(c.get("PrimaryPhone"), dict) else None,
                "is_active": c.get("Active"),
                "updated_at": c.get("MetaData", {}).get("LastUpdatedTime"),
                "ingested_at": ingested_at,
                "raw_json": json.dumps(c),
            })
        for v in vendors_payload.get("QueryResponse", {}).get("Vendor", []):
            contacts.append({
                "tenant_id": conn.tenant_id,
                "source": "qbo",
                "source_org_id": source_org_id,
                "contact_id": v.get("Id"),
                "name": v.get("DisplayName"),
                "contact_type": "vendor",
                "email": (v.get("PrimaryEmailAddr") or {}).get("Address") if isinstance(v.get("PrimaryEmailAddr"), dict) else None,
                "phone": (v.get("PrimaryPhone") or {}).get("FreeFormNumber") if isinstance(v.get("PrimaryPhone"), dict) else None,
                "is_active": v.get("Active"),
                "updated_at": v.get("MetaData", {}).get("LastUpdatedTime"),
                "ingested_at": ingested_at,
                "raw_json": json.dumps(v),
            })
        load_json_rows(bq, "contacts", contacts)

        report_lines = []
        for rpt in ["ProfitAndLoss", "BalanceSheet", "TrialBalance", "AgedReceivable", "AgedPayable"]:
            payload = qbo_api.get_report(conn.access_token, conn.realm_id, rpt)
            report_lines.extend(flatten_qbo_report(rpt, payload, conn.tenant_id, source_org_id, ingested_at))
        load_json_rows(bq, "report_lines", report_lines)

    return {"ok": True, "connection_id": connection_id, "ingested_at": ingested_at}
