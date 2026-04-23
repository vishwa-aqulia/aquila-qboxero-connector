from google.cloud import bigquery
from google.api_core.exceptions import NotFound
from app.config import GCP_PROJECT_ID, BQ_DATASET_ID

def _table_id(table_name: str) -> str:
    return f"{GCP_PROJECT_ID}.{BQ_DATASET_ID}.{table_name}"

def ensure_tables(bq: bigquery.Client) -> None:
    tables = {
        "sync_runs": [
            bigquery.SchemaField("run_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("tenant_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_org_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("status", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("started_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("finished_at", "TIMESTAMP"),
            bigquery.SchemaField("error", "STRING"),
        ],
        "orgs": [
            bigquery.SchemaField("tenant_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_org_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("org_name", "STRING"),
            bigquery.SchemaField("country", "STRING"),
            bigquery.SchemaField("base_currency", "STRING"),
            bigquery.SchemaField("timezone", "STRING"),
            bigquery.SchemaField("updated_at", "TIMESTAMP"),
            bigquery.SchemaField("ingested_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("raw_json", "STRING"),
        ],
        "accounts": [
            bigquery.SchemaField("tenant_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_org_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("account_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("account_code", "STRING"),
            bigquery.SchemaField("name", "STRING"),
            bigquery.SchemaField("type", "STRING"),
            bigquery.SchemaField("subtype", "STRING"),
            bigquery.SchemaField("classification", "STRING"),
            bigquery.SchemaField("currency", "STRING"),
            bigquery.SchemaField("is_active", "BOOL"),
            bigquery.SchemaField("updated_at", "TIMESTAMP"),
            bigquery.SchemaField("ingested_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("raw_json", "STRING"),
        ],
        "contacts": [
            bigquery.SchemaField("tenant_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_org_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("contact_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("name", "STRING"),
            bigquery.SchemaField("contact_type", "STRING"),  # customer|vendor|both|unknown
            bigquery.SchemaField("email", "STRING"),
            bigquery.SchemaField("phone", "STRING"),
            bigquery.SchemaField("is_active", "BOOL"),
            bigquery.SchemaField("updated_at", "TIMESTAMP"),
            bigquery.SchemaField("ingested_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("raw_json", "STRING"),
        ],
        "report_lines": [
            bigquery.SchemaField("tenant_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("source_org_id", "STRING", mode="REQUIRED"),
            bigquery.SchemaField("report_name", "STRING", mode="REQUIRED"),  # ProfitAndLoss|BalanceSheet|TrialBalance|AgedReceivables|AgedPayables
            bigquery.SchemaField("basis", "STRING"),  # Accrual|Cash|unknown
            bigquery.SchemaField("period_start", "DATE"),
            bigquery.SchemaField("period_end", "DATE"),
            bigquery.SchemaField("report_run_time", "TIMESTAMP"),
            bigquery.SchemaField("row_path", "STRING"),
            bigquery.SchemaField("row_depth", "INT64"),
            bigquery.SchemaField("row_type", "STRING"),
            bigquery.SchemaField("row_name", "STRING"),
            bigquery.SchemaField("account_id", "STRING"),
            bigquery.SchemaField("account_code", "STRING"),
            bigquery.SchemaField("column_name", "STRING"),
            bigquery.SchemaField("amount", "NUMERIC"),
            bigquery.SchemaField("currency", "STRING"),
            bigquery.SchemaField("ingested_at", "TIMESTAMP", mode="REQUIRED"),
            bigquery.SchemaField("raw_json", "STRING"),
        ],
    }

    for table_name, schema in tables.items():
        tid = _table_id(table_name)
        try:
            bq.get_table(tid)
        except NotFound:
            table = bigquery.Table(tid, schema=schema)

            # Partition the largest table (report_lines) by ingestion time by default.
            if table_name in {"report_lines", "sync_runs"}:
                table.time_partitioning = bigquery.TimePartitioning(
                    type_=bigquery.TimePartitioningType.DAY,
                    field="ingested_at" if table_name == "report_lines" else "started_at",
                )

            table.clustering_fields = ["tenant_id", "source", "source_org_id"]

            bq.create_table(table)
