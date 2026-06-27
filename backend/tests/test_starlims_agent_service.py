import asyncio

import pytest

from services.starlims_agent_service import StarlimsAgentService
from services.starlims_sql_service import StarlimsSqlService


class FakeSqlService:
    def __init__(self):
        self.calls = []

    def run_tool(self, tool_name, start_date="2026-05-01", end_date="2026-06-01"):
        self.calls.append((tool_name, start_date, end_date))
        rows = {
            "may_task_summary": [
                {"handled_tasks": 161, "existing_tasks": 159, "deleted_tasks": 2}
            ],
            "may_audit_events": [
                {"event_type": "Create", "events": 125, "tasks": 125},
                {"event_type": "Edit", "events": 208, "tasks": 81},
            ],
            "may_status_distribution": [
                {"current_status": "Prelogged", "tasks": 84, "pct": 52.8},
                {"current_status": "Logged", "tasks": 50, "pct": 31.4},
                {"current_status": "Done", "tasks": 14, "pct": 8.8},
            ],
            "may_oos_tasks": [
                {
                    "folder_no": "D00000193",
                    "test_name": "溶離",
                    "operator": "SYSADM",
                    "planned_analysis_date": "2026-06-09T12:27:32.430000",
                    "current_status": "OOS",
                }
            ],
            "may_top_tests": [{"test_name": "Appearance", "tasks": 18}],
            "may_data_quality": [
                {
                    "current_tasks": 159,
                    "missing_test_type": 158,
                    "missing_tmname": 159,
                    "missing_analyzeddate": 159,
                    "missing_done_testing_dt": 159,
                }
            ],
        }
        return {"tool": tool_name, "rows": rows[tool_name]}


async def fake_rag_search(query):
    return {
        "rows": [
            {
                "id": "chunk-1",
                "filename": "FDA guidance.pdf",
                "chunk_index": 0,
                "score": 0.9,
                "text": f"Retrieved context for: {query}",
            }
        ],
        "sources": [
            {
                "type": "document",
                "id": "chunk-1",
                "filename": "FDA guidance.pdf",
                "chunk_index": 0,
                "score": 0.9,
                "text": "Retrieved context",
            }
        ],
    }


class FakeLLMClient:
    def __init__(self, content):
        self.chat = FakeChat(content)


class FakeChat:
    def __init__(self, content):
        self.completions = FakeCompletions(content)


class FakeCompletions:
    def __init__(self, content):
        self.content = content

    def create(self, **kwargs):
        return FakeResponse(self.content)


class FakeResponse:
    def __init__(self, content):
        self.choices = [FakeChoice(content)]


class FakeChoice:
    def __init__(self, content):
        self.message = FakeMessage(content)


class FakeMessage:
    def __init__(self, content):
        self.content = content


def test_starlims_agent_generates_status_contract():
    sql = FakeSqlService()
    service = StarlimsAgentService(sql_service=sql)

    run = asyncio.run(service.run("請列出5月經手任務的現行狀態分布。"))

    assert run is not None
    assert run.contract.intent == "status_distribution"
    assert sql.calls == [("may_status_distribution", "2026-05-01", "2026-06-01")]
    assert run.evaluation.approved is True
    assert "Prelogged" in run.prompt_context
    assert run.steps[-1]["status"] == "approved"


def test_starlims_agent_adds_boundaries_for_tat_question():
    sql = FakeSqlService()
    service = StarlimsAgentService(sql_service=sql)

    run = asyncio.run(service.run("目前資料是否足以做檢測TAT分析？若不足缺哪些欄位？"))

    assert run is not None
    assert run.contract.intent == "data_quality"
    assert run.contract.can_answer_directly is False
    assert "may_data_quality" in run.contract.tools
    assert "TAT needs date fields" in run.contract.unsupported_reasons[0]
    assert "missing_done_testing_dt" in run.prompt_context


def test_agent_routes_non_starlims_question_to_rag_tool():
    service = StarlimsAgentService(
        sql_service=FakeSqlService(),
        rag_search=fake_rag_search,
    )

    run = asyncio.run(service.run("What does FDA guidance say about clinical trials?"))

    assert run.contract.intent == "knowledge_base_question"
    assert run.contract.tools == ["knowledge_base_search"]
    assert "Retrieved context" in run.prompt_context
    assert run.sources[0]["filename"] == "FDA guidance.pdf"


def test_agent_uses_llm_contract_when_available():
    client = FakeLLMClient(
        """
        {
          "clarified_question": "Summarize clinical trial guidance",
          "intent": "guidance_summary",
          "tools": ["knowledge_base_search"],
          "can_answer_directly": true,
          "unsupported_reasons": [],
          "tool_reason": "Needs FDA document context"
        }
        """
    )
    service = StarlimsAgentService(
        sql_service=FakeSqlService(),
        rag_search=fake_rag_search,
        llm_client=client,
    )

    run = asyncio.run(service.run("clinical trial guidance?"))

    assert run.contract.generated_by == "llm"
    assert run.contract.intent == "guidance_summary"
    assert run.contract.clarified_question == "Summarize clinical trial guidance"
    assert run.contract.tools == ["knowledge_base_search"]


def test_starlims_sql_service_rejects_unknown_tool_before_connecting():
    service = StarlimsSqlService()

    with pytest.raises(ValueError):
        service.run_tool("drop_everything")
