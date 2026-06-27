from dataclasses import dataclass
from typing import Any

from services.starlims_sql_service import StarlimsSqlService


@dataclass
class AgentContract:
    intent: str
    tools: list[str]
    can_answer_directly: bool
    unsupported_reasons: list[str]
    forbidden_claims: list[str]
    start_date: str = "2026-05-01"
    end_date: str = "2026-06-01"
    snapshot_date: str = "2026-06-16"


@dataclass
class AgentEvaluation:
    approved: bool
    issues: list[str]


@dataclass
class AgentRun:
    contract: AgentContract
    tool_results: list[dict[str, Any]]
    evaluation: AgentEvaluation
    prompt_context: str
    source: dict[str, Any]
    steps: list[dict[str, Any]]


class ContractGeneratorAgent:
    STARLIMS_TERMS = (
        "starlims",
        "ordtask",
        "audittrl",
        "prelogged",
        "oos",
        "oot",
        "tmname",
        "test_type",
        "analyzeddate",
        "done_testing_dt",
        "tat",
        "2026年5月",
        "5月",
        "may 2026",
        "檢驗任務",
        "經手任務",
        "測項",
        "現行狀態",
        "資料品質",
        "欄位",
        "稽核",
        "qc主管",
    )

    UNSUPPORTED_TERMS = (
        "tat",
        "放行",
        "批次放行",
        "根因",
        "儀器異常",
        "方法版本",
        "qms",
        "偏差",
        "規格",
        "上下限",
        "result value",
        "結果值",
    )

    def should_handle(self, question: str) -> bool:
        normalized = question.lower()
        return any(term in normalized for term in self.STARLIMS_TERMS)

    def generate(self, question: str) -> AgentContract:
        normalized = question.lower()
        tools: list[str] = []
        intent = "starlims_task_question"

        def add(tool: str) -> None:
            if tool not in tools:
                tools.append(tool)

        if any(term in normalized for term in ("多少", "新建", "編輯", "刪除", "created", "edited")):
            intent = "task_volume"
            add("may_task_summary")
            add("may_audit_events")

        if any(term in normalized for term in ("狀態", "分布", "占比", "prelogged", "done", "完成率")):
            intent = "status_distribution"
            add("may_status_distribution")

        if "oos" in normalized:
            intent = "oos_tracking"
            add("may_oos_tasks")

        if any(term in normalized for term in ("測項", "任務量", "top", "最高", "appearance", "assay", "溶離")):
            intent = "test_volume"
            add("may_top_tests")

        if any(term in normalized for term in ("資料品質", "缺", "欄位", "tat", "tmname", "test_type", "analyzeddate")):
            intent = "data_quality"
            add("may_data_quality")

        if any(term in normalized for term in ("摘要", "風險", "追蹤", "建議", "qc主管", "開發團隊")):
            intent = "management_summary"
            add("may_task_summary")
            add("may_status_distribution")
            add("may_oos_tasks")
            add("may_top_tests")
            add("may_data_quality")

        unsupported_reasons = self._unsupported_reasons(normalized)
        if unsupported_reasons:
            add("may_data_quality")

        if not tools:
            add("may_task_summary")
            add("may_status_distribution")

        return AgentContract(
            intent=intent,
            tools=tools,
            can_answer_directly=not unsupported_reasons,
            unsupported_reasons=unsupported_reasons,
            forbidden_claims=[
                "Do not treat STARLIMSDEV data as production quality evidence.",
                "Do not decide batch release eligibility from ORDTASK/AUDITTRL alone.",
                "Do not infer root cause without QMS investigation data.",
                "Do not compute TAT when ANALYZEDDATE/DONE_TESTING_DT are missing.",
                "Do not claim method-version correctness without method/version data.",
                "Do not infer instrument abnormality without instrument data.",
            ],
        )

    def _unsupported_reasons(self, normalized_question: str) -> list[str]:
        if not any(term in normalized_question for term in self.UNSUPPORTED_TERMS):
            return []

        reasons = []
        if any(term in normalized_question for term in ("tat", "週期", "完成時間")):
            reasons.append("TAT needs date fields such as ANALYZEDDATE and DONE_TESTING_DT.")
        if any(term in normalized_question for term in ("放行", "批次", "規格", "上下限")):
            reasons.append("Batch release/specification decisions need batch, result, unit, and limit data.")
        if any(term in normalized_question for term in ("根因", "qms", "偏差")):
            reasons.append("Root-cause and deviation conclusions need QMS investigation data.")
        if "方法版本" in normalized_question:
            reasons.append("Method-version conclusions need method code/version master data.")
        if "儀器" in normalized_question:
            reasons.append("Instrument conclusions need instrument identifiers and run data.")
        return reasons


class EvidenceEvaluatorAgent:
    def evaluate(
        self, contract: AgentContract, tool_results: list[dict[str, Any]]
    ) -> AgentEvaluation:
        issues = []
        by_tool = {result.get("tool"): result for result in tool_results}

        for tool in contract.tools:
            result = by_tool.get(tool)
            if not result:
                issues.append(f"Missing tool result: {tool}")
                continue
            if result.get("error"):
                issues.append(f"{tool}: {result['error']}")
            elif not result.get("rows"):
                issues.append(f"{tool}: no rows returned")

        return AgentEvaluation(approved=not issues, issues=issues)


class StarlimsAgentService:
    def __init__(
        self,
        sql_service: StarlimsSqlService | None = None,
        contract_agent: ContractGeneratorAgent | None = None,
        evaluator_agent: EvidenceEvaluatorAgent | None = None,
    ):
        self.sql_service = sql_service or StarlimsSqlService()
        self.contract_agent = contract_agent or ContractGeneratorAgent()
        self.evaluator_agent = evaluator_agent or EvidenceEvaluatorAgent()

    async def run(self, question: str) -> AgentRun | None:
        if not self.contract_agent.should_handle(question):
            return None

        contract = self.contract_agent.generate(question)
        tool_results = [
            self.sql_service.run_tool(
                tool,
                start_date=contract.start_date,
                end_date=contract.end_date,
            )
            for tool in contract.tools
        ]
        evaluation = self.evaluator_agent.evaluate(contract, tool_results)
        prompt_context = self._format_prompt_context(contract, tool_results, evaluation)
        return AgentRun(
            contract=contract,
            tool_results=tool_results,
            evaluation=evaluation,
            prompt_context=prompt_context,
            source={
                "type": "document",
                "id": "starlims-sql-agent",
                "filename": "STARLIMS SQL Agent",
                "chunk_index": 0,
                "score": 1.0 if evaluation.approved else 0.0,
                "text": prompt_context[:500],
            },
            steps=[
                {
                    "agent": "contract_generator",
                    "status": "completed",
                    "intent": contract.intent,
                    "tools": contract.tools,
                },
                {
                    "agent": "query_generator",
                    "status": "completed",
                    "tools": [result.get("tool") for result in tool_results],
                },
                {
                    "agent": "evidence_evaluator",
                    "status": "approved" if evaluation.approved else "rejected",
                    "issues": evaluation.issues,
                },
            ],
        )

    def _format_prompt_context(
        self,
        contract: AgentContract,
        tool_results: list[dict[str, Any]],
        evaluation: AgentEvaluation,
    ) -> str:
        lines = [
            "## STARLIMS SQL Agent Evidence",
            f"Data source: SQL Server database STARLIMS_DATA, tables dbo.ORDTASK and dbo.AUDITTRL.",
            f"Data window: {contract.start_date} inclusive to {contract.end_date} exclusive.",
            f"Snapshot date: {contract.snapshot_date}.",
            f"Contract intent: {contract.intent}.",
            f"Evaluator status: {'approved' if evaluation.approved else 'rejected'}.",
        ]

        if evaluation.issues:
            lines.append("Evaluator issues:")
            lines.extend(f"- {issue}" for issue in evaluation.issues)

        if contract.unsupported_reasons:
            lines.append("Known cannot-determine boundaries for this question:")
            lines.extend(f"- {reason}" for reason in contract.unsupported_reasons)

        lines.append("Forbidden claims:")
        lines.extend(f"- {claim}" for claim in contract.forbidden_claims)

        lines.append("Tool results:")
        for result in tool_results:
            lines.append(f"### {result.get('tool')}")
            if result.get("error"):
                lines.append(f"ERROR: {result['error']}")
                continue
            rows = result.get("rows", [])
            if not rows:
                lines.append("(no rows)")
                continue
            lines.extend(self._format_rows(rows))

        lines.extend(
            [
                "Answer instructions:",
                "- Use only the STARLIMS SQL Agent Evidence for STARLIMS database claims.",
                "- Separate facts, observations, inferences, recommendations, and cannot-determine items.",
                "- If evaluator status is rejected, explain that database evidence could not be retrieved.",
                "- Keep GxP tone: do not overstate conclusions or replace QC/QA judgment.",
            ]
        )
        return "\n".join(lines)

    @staticmethod
    def _format_rows(rows: list[dict[str, Any]]) -> list[str]:
        if not rows:
            return ["(no rows)"]

        headers = list(rows[0].keys())
        output = [
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join("---" for _ in headers) + " |",
        ]
        for row in rows[:50]:
            output.append(
                "| "
                + " | ".join(str(row.get(header, "")) for header in headers)
                + " |"
            )
        if len(rows) > 50:
            output.append(f"({len(rows) - 50} more rows omitted)")
        return output
