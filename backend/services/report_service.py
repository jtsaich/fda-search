import json
import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

REPORT_JSON_INSTRUCTION = """
Generate a downloadable DOCX report artifact for the latest user request.

Return ONLY a valid JSON object with these fields:
{
  "title": "short report title",
  "summary": "brief chat-facing summary of what the report contains",
  "report_markdown": "complete standalone report body in markdown"
}

Rules:
- The chat summary is not the report. It should be concise.
- The report_markdown is the full report text intended for the DOCX file.
- Use the evidence/context already provided in this conversation.
- Distinguish facts, observations, inferences, recommendations, and cannot-determine items when applicable.
- Do not invent unsupported facts, dates, root causes, or regulatory conclusions.
- Do not include markdown fences around the JSON.
""".strip()


@dataclass
class DocxReportArtifact:
    title: str
    summary: str
    content: str
    sources: list[dict[str, Any]]


def generate_docx_report_artifact(
    *,
    client: Any,
    messages: list[dict[str, Any]],
    model: str,
    sources: list[dict[str, Any]] | None = None,
) -> DocxReportArtifact:
    if client is None:
        raise RuntimeError("LLM client is not configured")

    response = client.chat.completions.create(
        model=model,
        messages=[*messages, {"role": "user", "content": REPORT_JSON_INSTRUCTION}],
        temperature=0.1,
        max_tokens=3000,
        timeout=45,
    )
    raw_content = response.choices[0].message.content or ""
    payload = _parse_report_json(raw_content)

    title = _clean_text(payload.get("title"), "Generated Report")
    summary = _clean_text(payload.get("summary"), "Generated a downloadable DOCX report.")
    report_markdown = _clean_text(payload.get("report_markdown"), "")
    if not report_markdown:
        raise ValueError("Report generator returned empty report_markdown")

    return DocxReportArtifact(
        title=title,
        summary=summary,
        content=report_markdown,
        sources=sources or [],
    )


def _parse_report_json(raw_content: str) -> dict[str, Any]:
    cleaned = raw_content.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            logger.warning("Report generator returned non-JSON content: %s", raw_content[:200])
            raise
        payload = json.loads(cleaned[start : end + 1])

    if not isinstance(payload, dict):
        raise ValueError("Report generator returned JSON that is not an object")
    return payload


def _clean_text(value: Any, fallback: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback
