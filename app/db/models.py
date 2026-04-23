from sqlalchemy import Column, String, DateTime, Text, Integer
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class Connection(Base):
    __tablename__ = "connections"

    id = Column(String, primary_key=True)
    tenant_id = Column(String, nullable=False)
    source = Column(String, nullable=False)  # qbo | xero

    # QBO fields
    realm_id = Column(String, nullable=True)

    # Xero fields
    xero_tenant_id = Column(String, nullable=True)

    # OAuth tokens (store encrypted in prod)
    access_token = Column(Text, nullable=False)
    refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class SyncRun(Base):
    __tablename__ = "sync_runs"

    id = Column(String, primary_key=True)
    connection_id = Column(String, nullable=False)
    status = Column(String, nullable=False)  # started|success|failed
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
