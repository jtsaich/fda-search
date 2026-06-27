import os
from datetime import date, datetime
from decimal import Decimal
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv():
        return None

load_dotenv()


class StarlimsSqlService:
    """Read-only STARLIMS SQL Server access through fixed query templates."""

    def __init__(self):
        self.host = os.getenv("STARLIMS_SQL_HOST", "127.0.0.1")
        self.port = int(os.getenv("STARLIMS_SQL_PORT", "1433"))
        self.user = os.getenv("STARLIMS_SQL_USER")
        self.password = os.getenv("STARLIMS_SQL_PASSWORD")
        self.database = os.getenv("STARLIMS_SQL_DATABASE", "STARLIMS_DATA")
        self.timeout = int(os.getenv("STARLIMS_SQL_TIMEOUT_SECONDS", "20"))

    @property
    def is_configured(self) -> bool:
        return bool(self.host and self.user and self.password and self.database)

    def run_tool(
        self,
        tool_name: str,
        start_date: str = "2026-05-01",
        end_date: str = "2026-06-01",
    ) -> dict[str, Any]:
        tools = {
            "may_task_summary": self._may_task_summary,
            "may_audit_events": self._may_audit_events,
            "may_status_distribution": self._may_status_distribution,
            "may_oos_tasks": self._may_oos_tasks,
            "may_top_tests": self._may_top_tests,
            "may_data_quality": self._may_data_quality,
        }
        if tool_name not in tools:
            raise ValueError(f"Unsupported STARLIMS SQL tool: {tool_name}")

        if not self.is_configured:
            return {
                "tool": tool_name,
                "error": (
                    "STARLIMS SQL is not configured. Set STARLIMS_SQL_HOST, "
                    "STARLIMS_SQL_USER, STARLIMS_SQL_PASSWORD, and "
                    "STARLIMS_SQL_DATABASE."
                ),
                "rows": [],
            }

        rows = tools[tool_name](start_date, end_date)
        return {"tool": tool_name, "rows": rows}

    def _connect(self):
        try:
            import pymssql
        except ImportError as exc:
            raise RuntimeError(
                "pymssql is required for STARLIMS SQL Server access"
            ) from exc

        return pymssql.connect(
            server=self.host,
            port=self.port,
            user=self.user,
            password=self.password,
            database=self.database,
            login_timeout=5,
            timeout=self.timeout,
            as_dict=True,
        )

    def _fetch_all(self, sql: str, params: tuple[Any, ...]) -> list[dict[str, Any]]:
        with self._connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                return [
                    {key: self._clean_value(value) for key, value in row.items()}
                    for row in cursor.fetchall()
                ]

    @staticmethod
    def _clean_value(value: Any) -> Any:
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return value

    def _may_task_summary(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return self._fetch_all(
            """
            WITH may_tasks AS (
                SELECT DISTINCT ORIGINAL_ORIGREC
                FROM dbo.AUDITTRL
                WHERE TABLENAME = 'ORDTASK'
                  AND AUDIT_DT >= %s
                  AND AUDIT_DT < %s
            ),
            existing_tasks AS (
                SELECT m.ORIGINAL_ORIGREC
                FROM may_tasks m
                JOIN dbo.ORDTASK o ON o.ORIGREC = m.ORIGINAL_ORIGREC
            )
            SELECT
                (SELECT COUNT(*) FROM may_tasks) AS handled_tasks,
                (SELECT COUNT(*) FROM existing_tasks) AS existing_tasks,
                (SELECT COUNT(*) FROM may_tasks)
                  - (SELECT COUNT(*) FROM existing_tasks) AS deleted_tasks
            """,
            (start_date, end_date),
        )

    def _may_audit_events(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return self._fetch_all(
            """
            SELECT
                EVENT_TYPE AS event_type,
                COUNT(*) AS events,
                COUNT(DISTINCT ORIGINAL_ORIGREC) AS tasks
            FROM dbo.AUDITTRL
            WHERE TABLENAME = 'ORDTASK'
              AND AUDIT_DT >= %s
              AND AUDIT_DT < %s
            GROUP BY EVENT_TYPE
            ORDER BY events DESC
            """,
            (start_date, end_date),
        )

    def _may_status_distribution(
        self, start_date: str, end_date: str
    ) -> list[dict[str, Any]]:
        return self._fetch_all(
            """
            WITH may_tasks AS (
                SELECT DISTINCT ORIGINAL_ORIGREC
                FROM dbo.AUDITTRL
                WHERE TABLENAME = 'ORDTASK'
                  AND AUDIT_DT >= %s
                  AND AUDIT_DT < %s
            )
            SELECT
                o.TS AS current_status,
                COUNT(*) AS tasks,
                CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS decimal(5,1)) AS pct
            FROM may_tasks m
            JOIN dbo.ORDTASK o ON o.ORIGREC = m.ORIGINAL_ORIGREC
            GROUP BY o.TS
            ORDER BY tasks DESC
            """,
            (start_date, end_date),
        )

    def _may_oos_tasks(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return self._fetch_all(
            """
            WITH may_tasks AS (
                SELECT DISTINCT ORIGINAL_ORIGREC
                FROM dbo.AUDITTRL
                WHERE TABLENAME = 'ORDTASK'
                  AND AUDIT_DT >= %s
                  AND AUDIT_DT < %s
            )
            SELECT
                o.FOLDERNO AS folder_no,
                o.TESTNO AS test_name,
                o.USRNAM AS operator,
                o.ANALYSISDUEDATE AS planned_analysis_date,
                o.TS AS current_status,
                o.TSADISP AS status_display,
                o.ORIGREC AS task_origrec
            FROM may_tasks m
            JOIN dbo.ORDTASK o ON o.ORIGREC = m.ORIGINAL_ORIGREC
            WHERE o.TS = 'OOS'
            ORDER BY o.FOLDERNO, o.TESTNO
            """,
            (start_date, end_date),
        )

    def _may_top_tests(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return self._fetch_all(
            """
            WITH may_tasks AS (
                SELECT DISTINCT ORIGINAL_ORIGREC
                FROM dbo.AUDITTRL
                WHERE TABLENAME = 'ORDTASK'
                  AND AUDIT_DT >= %s
                  AND AUDIT_DT < %s
            )
            SELECT TOP 10
                o.TESTNO AS test_name,
                COUNT(*) AS tasks
            FROM may_tasks m
            JOIN dbo.ORDTASK o ON o.ORIGREC = m.ORIGINAL_ORIGREC
            GROUP BY o.TESTNO
            ORDER BY tasks DESC, o.TESTNO
            """,
            (start_date, end_date),
        )

    def _may_data_quality(self, start_date: str, end_date: str) -> list[dict[str, Any]]:
        return self._fetch_all(
            """
            WITH may_tasks AS (
                SELECT DISTINCT ORIGINAL_ORIGREC
                FROM dbo.AUDITTRL
                WHERE TABLENAME = 'ORDTASK'
                  AND AUDIT_DT >= %s
                  AND AUDIT_DT < %s
            )
            SELECT
                COUNT(*) AS current_tasks,
                SUM(CASE WHEN o.TEST_TYPE IS NULL OR LTRIM(RTRIM(o.TEST_TYPE)) = ''
                    THEN 1 ELSE 0 END) AS missing_test_type,
                SUM(CASE WHEN o.TMNAME IS NULL OR LTRIM(RTRIM(o.TMNAME)) = ''
                    OR o.TMNAME = 'N/A' THEN 1 ELSE 0 END) AS missing_tmname,
                SUM(CASE WHEN o.ANALYZEDDATE IS NULL THEN 1 ELSE 0 END)
                    AS missing_analyzeddate,
                SUM(CASE WHEN o.DONE_TESTING_DT IS NULL THEN 1 ELSE 0 END)
                    AS missing_done_testing_dt
            FROM may_tasks m
            JOIN dbo.ORDTASK o ON o.ORIGREC = m.ORIGINAL_ORIGREC
            """,
            (start_date, end_date),
        )
