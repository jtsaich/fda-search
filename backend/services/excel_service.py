"""
Spreadsheet structured data extraction service.
Extracts headers, typed data, and summaries from Excel and CSV files
for LLM-driven chart generation.
"""

import csv
import io
import logging
from typing import Any

import openpyxl

logger = logging.getLogger(__name__)


class ExcelService:
    @staticmethod
    def extract_structured_data(file_bytes: bytes, filename: str) -> dict[str, Any]:
        """
        Extract structured data from an Excel or CSV file, preserving
        headers, column types, and row-level dict data.

        Returns:
            {
                "filename": str,
                "sheets": [
                    {
                        "name": str,
                        "headers": [str, ...],
                        "data": [{"col": value, ...}, ...],
                        "data_types": {"col": "number"|"string"|"date", ...}
                    }
                ]
            }
        """
        if filename.lower().endswith(".csv"):
            return ExcelService._extract_csv_structured(file_bytes, filename)
        return ExcelService._extract_xlsx_structured(file_bytes, filename)

    @staticmethod
    def _extract_csv_structured(file_bytes: bytes, filename: str) -> dict[str, Any]:
        """Extract structured data from a CSV file."""
        text_data = file_bytes.decode("utf-8")
        reader = csv.reader(io.StringIO(text_data))
        rows = list(reader)
        if not rows:
            return {"filename": filename, "sheets": []}

        headers = [h.strip() if h.strip() else f"Column_{i}" for i, h in enumerate(rows[0])]

        data = []
        data_types: dict[str, str] = {}

        for row in rows[1:]:
            row_dict = {}
            for i, cell_str in enumerate(row):
                if i >= len(headers):
                    break
                col = headers[i]
                cell_str = cell_str.strip()

                # Try to coerce to number
                value: Any = cell_str
                if cell_str:
                    try:
                        value = int(cell_str)
                    except ValueError:
                        try:
                            value = float(cell_str)
                        except ValueError:
                            pass

                row_dict[col] = value if cell_str else None

                if col not in data_types and cell_str:
                    if isinstance(value, (int, float)):
                        data_types[col] = "number"
                    else:
                        data_types[col] = "string"

            if any(v is not None for v in row_dict.values()):
                data.append(row_dict)

        return {
            "filename": filename,
            "sheets": [
                {
                    "name": "Sheet1",
                    "headers": headers,
                    "data": data,
                    "data_types": data_types,
                }
            ],
        }

    @staticmethod
    def _extract_xlsx_structured(file_bytes: bytes, filename: str) -> dict[str, Any]:
        """Extract structured data from an Excel file."""
        xlsx_file = io.BytesIO(file_bytes)
        workbook = openpyxl.load_workbook(xlsx_file, read_only=True, data_only=True)

        sheets = []
        for sheet in workbook.worksheets:
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                continue

            # First row is headers
            headers = [str(h) if h is not None else f"Column_{i}" for i, h in enumerate(rows[0])]

            data = []
            data_types: dict[str, str] = {}

            for row in rows[1:]:
                row_dict = {}
                for i, cell in enumerate(row):
                    if i >= len(headers):
                        break
                    col = headers[i]
                    row_dict[col] = cell

                    # Infer types from first non-None value per column
                    if col not in data_types and cell is not None:
                        if isinstance(cell, (int, float)):
                            data_types[col] = "number"
                        elif hasattr(cell, "strftime"):
                            data_types[col] = "date"
                        else:
                            data_types[col] = "string"

                # Skip fully empty rows
                if any(v is not None for v in row_dict.values()):
                    data.append(row_dict)

            sheets.append(
                {
                    "name": sheet.title,
                    "headers": headers,
                    "data": data,
                    "data_types": data_types,
                }
            )

        return {"filename": filename, "sheets": sheets}

    @staticmethod
    def generate_data_summary(structured_data: dict[str, Any]) -> str:
        """
        Produce a human-readable summary of the Excel data
        suitable for including in an LLM prompt.
        """
        lines = [f"Excel file: {structured_data['filename']}"]

        for sheet in structured_data["sheets"]:
            lines.append(f"\nSheet: {sheet['name']}")
            lines.append(f"Columns: {', '.join(sheet['headers'])}")
            lines.append(f"Column types: {sheet['data_types']}")
            lines.append(f"Row count: {len(sheet['data'])}")

            # Show first few rows as sample
            sample_rows = sheet["data"][:5]
            if sample_rows:
                lines.append("Sample data:")
                for row in sample_rows:
                    formatted = {
                        k: (v.isoformat() if hasattr(v, "isoformat") else v)
                        for k, v in row.items()
                        if v is not None
                    }
                    lines.append(f"  {formatted}")

        return "\n".join(lines)
