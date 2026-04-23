import os
import json
from google.cloud import bigquery
from google.oauth2 import service_account
from app.config import GCP_PROJECT_ID

def get_bq_client() -> bigquery.Client:
    """Return a BigQuery client.

    Replit doesn't have Google Cloud's default credentials, so the simplest approach
    is to add a Replit Secret called GCP_SERVICE_ACCOUNT_JSON containing the full
    service account key JSON.
    """
    sa_json = os.getenv("GCP_SERVICE_ACCOUNT_JSON")
    if sa_json:
        info = json.loads(sa_json)
        creds = service_account.Credentials.from_service_account_info(info)
        return bigquery.Client(project=GCP_PROJECT_ID, credentials=creds)

    # On GCP (Cloud Run etc.), ADC usually works.
    return bigquery.Client(project=GCP_PROJECT_ID)
