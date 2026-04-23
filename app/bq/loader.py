from google.cloud import bigquery
from datetime import datetime, timezone
from app.config import GCP_PROJECT_ID, BQ_DATASET_ID

def table_ref(table: str) -> str:
    return f"{GCP_PROJECT_ID}.{BQ_DATASET_ID}.{table}"

def now_ts() -> str:
    return datetime.now(timezone.utc).isoformat()

def load_json_rows(bq: bigquery.Client, table: str, rows: list[dict]) -> None:
    if not rows:
        return
    errors = bq.insert_rows_json(table_ref(table), rows)
    if errors:
        # In production, capture + retry intelligently
        raise RuntimeError(f"BigQuery insert errors: {errors}")
