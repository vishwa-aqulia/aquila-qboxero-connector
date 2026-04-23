from __future__ import annotations
from typing import Any

def flatten_qbo_report(report_name: str, payload: dict, tenant_id: str, source_org_id: str, ingested_at: str) -> list[dict]:
    # QBO reports are hierarchical. This flattener walks Rows recursively and emits one row per numeric cell.
    out: list[dict] = []
    rows = payload.get("Rows", {}).get("Row", [])
    columns = payload.get("Columns", {}).get("Column", [])

    def walk(row_list: list[dict], path: list[str], depth: int):
        for r in row_list:
            if "Header" in r:
                name = r["Header"].get("ColData", [{}])[0].get("value")
                walk(r.get("Rows", {}).get("Row", []), path + [name or "Header"], depth + 1)
            elif "Summary" in r:
                name = r["Summary"].get("ColData", [{}])[0].get("value")
                # summaries have values too
                emit_cells(r["Summary"].get("ColData", []), path + [name or "Summary"], depth, row_type="Summary")
            else:
                coldata = r.get("ColData", [])
                name = coldata[0].get("value") if coldata else None
                emit_cells(coldata, path + [name or "Row"], depth, row_type=r.get("type", "Row"))

    def emit_cells(coldata: list[dict], path: list[str], depth: int, row_type: str):
        row_name = path[-1] if path else None
        row_path = " / ".join([p for p in path if p])
        for idx, cell in enumerate(coldata[1:], start=1):
            col_name = columns[idx].get("ColTitle") if idx < len(columns) else f"col_{idx}"
            value = cell.get("value")
            try:
                amount = None if value in (None, "") else float(value.replace(",", ""))
            except Exception:
                amount = None
            out.append({
                "tenant_id": tenant_id,
                "source": "qbo",
                "source_org_id": source_org_id,
                "report_name": report_name,
                "basis": payload.get("Header", {}).get("ReportBasis"),
                "period_start": payload.get("Header", {}).get("StartPeriod"),
                "period_end": payload.get("Header", {}).get("EndPeriod"),
                "report_run_time": payload.get("Header", {}).get("Time"),
                "row_path": row_path,
                "row_depth": depth,
                "row_type": row_type,
                "row_name": row_name,
                "account_id": None,
                "account_code": None,
                "column_name": col_name,
                "amount": amount,
                "currency": payload.get("Header", {}).get("Currency"),
                "ingested_at": ingested_at,
                "raw_json": None,
            })

    walk(rows, [report_name], 0)
    return out

def flatten_xero_report(report_name: str, payload: dict, tenant_id: str, source_org_id: str, ingested_at: str) -> list[dict]:
    # Xero reports: payload['Reports'][0]['Rows']... each row has RowType and Cells.
    out: list[dict] = []
    reports = payload.get("Reports") or []
    if not reports:
        return out

    report = reports[0]
    rows = report.get("Rows") or []
    col_names = [c.get("Name") for c in (report.get("Columns") or [])]

    def walk(row_list: list[dict], path: list[str], depth: int):
        for r in row_list:
            rt = r.get("RowType")
            if rt == "Section":
                title = r.get("Title")
                walk(r.get("Rows") or [], path + [title or "Section"], depth + 1)
            else:
                emit_cells(r, path, depth)

    def emit_cells(r: dict, path: list[str], depth: int):
        rt = r.get("RowType") or "Row"
        cells = r.get("Cells") or []
        row_name = None
        if cells and cells[0].get("Value"):
            row_name = cells[0].get("Value")
        row_path = " / ".join([p for p in path + ([row_name] if row_name else []) if p])

        for idx, cell in enumerate(cells[1:], start=1):
            col_name = col_names[idx] if idx < len(col_names) else f"col_{idx}"
            value = cell.get("Value")
            try:
                amount = None if value in (None, "") else float(str(value).replace(",", ""))
            except Exception:
                amount = None
            out.append({
                "tenant_id": tenant_id,
                "source": "xero",
                "source_org_id": source_org_id,
                "report_name": report_name,
                "basis": None,
                "period_start": report.get("ReportDate"),
                "period_end": report.get("ReportDate"),
                "report_run_time": None,
                "row_path": row_path,
                "row_depth": depth,
                "row_type": rt,
                "row_name": row_name,
                "account_id": None,
                "account_code": None,
                "column_name": col_name,
                "amount": amount,
                "currency": report.get("CurrencyCode"),
                "ingested_at": ingested_at,
                "raw_json": None,
            })

    walk(rows, [report_name], 0)
    return out
