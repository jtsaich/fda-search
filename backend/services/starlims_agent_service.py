import asyncio
import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from services.starlims_sql_service import StarlimsSqlService

logger = logging.getLogger(__name__)

RAG_TOOL = "knowledge_base_search"
STARLIMS_SQL_TOOLS = (
    "may_task_summary",
    "may_audit_events",
    "may_status_distribution",
    "may_oos_tasks",
    "may_top_tests",
    "may_data_quality",
)
STARLIMS_FORBIDDEN_CLAIMS = [
    "Do not treat STARLIMSDEV data as production quality evidence.",
    "Do not decide batch release eligibility from ORDTASK/AUDITTRL alone.",
    "Do not infer root cause without QMS investigation data.",
    "Do not compute TAT when ANALYZEDDATE/DONE_TESTING_DT are missing.",
    "Do not claim method-version correctness without method/version data.",
    "Do not infer instrument abnormality without instrument data.",
]

KnowledgeBaseSearch = Callable[[str], Awaitable[dict[str, Any]]]


@dataclass
class AgentContract:
    clarified_question: str
    intent: str
    tools: list[str]
    can_answer_directly: bool
    unsupported_reasons: list[str]
    forbidden_claims: list[str]
    tool_reason: str = ""
    generated_by: str = "rules"
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
    sources: list[dict[str, Any]]
    source: dict[str, Any] | None
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

    def __init__(self, llm_client: Any | None = None, model: str | None = None):
        self.llm_client = llm_client
        self.model = model

    def should_handle(self, question: str) -> bool:
        return True

    async def generate(self, question: str) -> AgentContract:
        contract = await self._generate_with_llm(question)
        return contract or self._generate_with_rules(question)

    async def _generate_with_llm(self, question: str) -> AgentContract | None:
        if not self.llm_client:
            return None

        from services.chat_protocol import DEFAULT_MODEL

        system_prompt = (
            "You are the routing generator for FDA Search. Do not answer the "
            "user. Clarify the user's question and select the tool evidence "
            "needed to answer it.\n\n"
            "Available tools:\n"
            f"- {RAG_TOOL}: search uploaded FDA, R&D, drug research, "
            "pharmaceutical, and government research documents.\n"
            "- STARLIMS SQL tools for STARLIMS operational database questions "
            "about ORDTASK/AUDITTRL May 2026 task/audit data: "
            f"{', '.join(STARLIMS_SQL_TOOLS)}.\n\n"
            "Return JSON only with these keys: clarified_question, intent, "
            "tools, can_answer_directly, unsupported_reasons, tool_reason. "
            "Use exact tool names. If unsure between general docs and the "
            f"database, include both {RAG_TOOL} and the relevant SQL tool."
        )

        try:
            response = await asyncio.to_thread(
                self.llm_client.chat.completions.create,
                model=self.model or DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question},
                ],
                temperature=0,
                max_tokens=500,
            )
            content = response.choices[0].message.content or ""
            payload = self._parse_json_object(content)
            return self._contract_from_payload(question, payload)
        except Exception as exc:
            logger.warning("Agent contract LLM routing failed: %s", exc)
            return None

    def _contract_from_payload(
        self, question: str, payload: dict[str, Any]
    ) -> AgentContract:
        tools = self._normalize_tools(payload.get("tools", []), question)
        if not tools:
            return self._generate_with_rules(question)

        normalized = question.lower()
        unsupported_reasons = self._string_list(payload.get("unsupported_reasons"))
        for reason in self._unsupported_reasons(normalized):
            if reason not in unsupported_reasons:
                unsupported_reasons.append(reason)

        can_answer = bool(payload.get("can_answer_directly", True))
        if unsupported_reasons:
            can_answer = False

        return AgentContract(
            clarified_question=str(payload.get("clarified_question") or question),
            intent=str(payload.get("intent") or "agentic_search"),
            tools=tools,
            can_answer_directly=can_answer,
            unsupported_reasons=unsupported_reasons,
            forbidden_claims=self._forbidden_claims_for(tools),
            tool_reason=str(payload.get("tool_reason") or ""),
            generated_by="llm",
        )

    def _generate_with_rules(self, question: str) -> AgentContract:
        normalized = question.lower()
        if not self._is_starlims_question(normalized):
            return AgentContract(
                clarified_question=question,
                intent="knowledge_base_question",
                tools=[RAG_TOOL],
                can_answer_directly=True,
                unsupported_reasons=[],
                forbidden_claims=self._forbidden_claims_for([RAG_TOOL]),
                tool_reason="Question does not mention STARLIMS database fields or audit/task terms.",
            )

        intent, tools = self._pick_starlims_tools(normalized)
        unsupported_reasons = self._unsupported_reasons(normalized)
        return AgentContract(
            clarified_question=question,
            intent=intent,
            tools=tools,
            can_answer_directly=not unsupported_reasons,
            unsupported_reasons=unsupported_reasons,
            forbidden_claims=self._forbidden_claims_for(tools),
            tool_reason="Question matches STARLIMS database terms.",
        )

    def _pick_starlims_tools(self, normalized: str) -> tuple[str, list[str]]:
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

        if self._unsupported_reasons(normalized):
            add("may_data_quality")

        if not tools:
            add("may_task_summary")
            add("may_status_distribution")

        return intent, tools

    def _normalize_tools(self, raw_tools: Any, question: str) -> list[str]:
        if isinstance(raw_tools, str):
            raw_tools = [raw_tools]
        if not isinstance(raw_tools, list):
            return []

        normalized: list[str] = []

        def add(tool: str) -> None:
            if tool not in normalized:
                normalized.append(tool)

        for tool in raw_tools:
            name = str(tool).strip().lower()
            if name in STARLIMS_SQL_TOOLS:
                add(name)
            elif name == RAG_TOOL or any(
                term in name for term in ("rag", "knowledge", "document", "pinecone")
            ):
                add(RAG_TOOL)
            elif any(term in name for term in ("starlims", "sql", "database")):
                _, starlims_tools = self._pick_starlims_tools(question.lower())
                for starlims_tool in starlims_tools:
                    add(starlims_tool)

        return normalized

    def _is_starlims_question(self, normalized_question: str) -> bool:
        return any(term in normalized_question for term in self.STARLIMS_TERMS)

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

    @staticmethod
    def _parse_json_object(content: str) -> dict[str, Any]:
        text = content.strip()
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("LLM routing response did not contain a JSON object")
        return json.loads(text[start : end + 1])

    @staticmethod
    def _string_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [str(item) for item in value if str(item).strip()]

    @staticmethod
    def _forbidden_claims_for(tools: list[str]) -> list[str]:
        claims = []
        if any(tool in STARLIMS_SQL_TOOLS for tool in tools):
            claims.extend(STARLIMS_FORBIDDEN_CLAIMS)
        if RAG_TOOL in tools:
            claims.append("Do not cite knowledge-base facts unless they appear in retrieved context.")
        return claims


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
        rag_search: KnowledgeBaseSearch | None = None,
        llm_client: Any | None = None,
    ):
        self.sql_service = sql_service or StarlimsSqlService()
        self.contract_agent = contract_agent or ContractGeneratorAgent(llm_client=llm_client)
        self.evaluator_agent = evaluator_agent or EvidenceEvaluatorAgent()
        self.rag_search = rag_search

    async def run(self, question: str) -> AgentRun:
        contract = await self.contract_agent.generate(question)
        tool_results = []

        for tool in contract.tools:
            if tool == RAG_TOOL:
                tool_results.append(
                    await self._run_rag_tool(contract.clarified_question or question)
                )
            else:
                tool_results.append(
                    self.sql_service.run_tool(
                        tool,
                        start_date=contract.start_date,
                        end_date=contract.end_date,
                    )
                )

        evaluation = self.evaluator_agent.evaluate(contract, tool_results)
        prompt_context = self._format_prompt_context(contract, tool_results, evaluation)
        sources = self._format_sources(tool_results, prompt_context)
        return AgentRun(
            contract=contract,
            tool_results=tool_results,
            evaluation=evaluation,
            prompt_context=prompt_context,
            sources=sources,
            source=sources[0] if sources else None,
            steps=[
                {
                    "agent": "contract_generator",
                    "status": "completed",
                    "generated_by": contract.generated_by,
                    "intent": contract.intent,
                    "clarified_question": contract.clarified_question,
                    "tools": contract.tools,
                    "tool_reason": contract.tool_reason,
                },
                {
                    "agent": "tool_runner",
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

    async def _run_rag_tool(self, query: str) -> dict[str, Any]:
        if not self.rag_search:
            return {
                "tool": RAG_TOOL,
                "rows": [],
                "sources": [],
                "error": "Knowledge base search tool is not configured.",
            }

        try:
            result = await self.rag_search(query)
            return {
                "tool": RAG_TOOL,
                "rows": result.get("rows", []),
                "sources": result.get("sources", []),
                **({"error": result["error"]} if result.get("error") else {}),
            }
        except Exception as exc:
            return {"tool": RAG_TOOL, "rows": [], "sources": [], "error": str(exc)}

    def _format_prompt_context(
        self,
        contract: AgentContract,
        tool_results: list[dict[str, Any]],
        evaluation: AgentEvaluation,
    ) -> str:
        selected_tools = ", ".join(contract.tools)
        lines = [
            "## Search Agent Evidence",
            f"Generator: {contract.generated_by}.",
            f"Clarified question: {contract.clarified_question}.",
            f"Contract intent: {contract.intent}.",
            f"Selected tools: {selected_tools}.",
            f"Evaluator status: {'approved' if evaluation.approved else 'rejected'}.",
        ]

        if any(tool in STARLIMS_SQL_TOOLS for tool in contract.tools):
            lines.extend(
                [
                    "STARLIMS data source: SQL Server database STARLIMS_DATA, tables dbo.ORDTASK and dbo.AUDITTRL.",
                    f"STARLIMS data window: {contract.start_date} inclusive to {contract.end_date} exclusive.",
                    f"STARLIMS snapshot date: {contract.snapshot_date}.",
                ]
            )

        if RAG_TOOL in contract.tools:
            lines.append("Knowledge base source: Pinecone document chunks selected by embedding search.")

        if evaluation.issues:
            lines.append("Evaluator issues:")
            lines.extend(f"- {issue}" for issue in evaluation.issues)

        if contract.unsupported_reasons:
            lines.append("Known cannot-determine boundaries for this question:")
            lines.extend(f"- {reason}" for reason in contract.unsupported_reasons)

        if contract.forbidden_claims:
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
            if result.get("tool") == RAG_TOOL:
                lines.extend(self._format_knowledge_rows(rows))
            else:
                lines.extend(self._format_rows(rows))

        lines.extend(
            [
                "Answer instructions:",
                "- Use STARLIMS SQL evidence for STARLIMS database claims.",
                "- Use knowledge-base evidence for FDA, research, and uploaded-document claims.",
                "- Separate facts, observations, inferences, recommendations, and cannot-determine items.",
                "- If evaluator status is rejected, explain that supporting evidence could not be retrieved.",
                "- Keep GxP tone: do not overstate conclusions or replace QC/QA judgment.",
            ]
        )
        return "\n".join(lines)

    @staticmethod
    def _format_sources(
        tool_results: list[dict[str, Any]],
        prompt_context: str,
    ) -> list[dict[str, Any]]:
        sources = []
        has_sql = False
        for result in tool_results:
            if result.get("tool") == RAG_TOOL:
                sources.extend(result.get("sources", []))
            else:
                has_sql = True

        if has_sql:
            sources.insert(
                0,
                {
                    "type": "document",
                    "id": "starlims-sql-agent",
                    "filename": "STARLIMS SQL Agent",
                    "chunk_index": 0,
                    "score": 1.0,
                    "text": prompt_context[:500],
                },
            )
        return sources

    @staticmethod
    def _format_knowledge_rows(rows: list[dict[str, Any]]) -> list[str]:
        output = []
        for index, row in enumerate(rows[:3], start=1):
            title = row.get("filename", "Unknown")
            chunk_index = row.get("chunk_index", 0)
            score = row.get("score", 0)
            output.append(f"#### {index}. {title} chunk {chunk_index} score {score}")
            output.append(str(row.get("text", ""))[:2500])
        return output

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
