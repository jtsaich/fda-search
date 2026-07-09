"""Contract tests for DOCX report artifact generation and streaming."""

import json

from services.chat_protocol import is_docx_report_request, stream_report_artifact
from services.report_service import DocxReportArtifact, generate_docx_report_artifact


class FakeOpenAIClient:
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


def _stream_parts(report, *, sources=None, agent_steps=None):
    parts = []
    for chunk in stream_report_artifact(report, sources=sources, agent_steps=agent_steps):
        assert chunk.startswith("data: ")
        payload = chunk[len("data: ") :].strip()
        if payload == "[DONE]":
            continue
        parts.append(json.loads(payload))
    return parts


def test_generate_docx_report_artifact_uses_llm_json_for_summary_content_and_sources():
    full_report = (
        "# FDA Warning Letter Analysis\n\n"
        "## Observations\n"
        "The firm did not document CAPA effectiveness checks.\n\n"
        "## Recommendations\n"
        "- Reconcile open CAPA records.\n"
        "- Record verification evidence before closure."
    )
    sources = [
        {
            "id": "chunk-17",
            "filename": "warning-letter.pdf",
            "chunk_index": 2,
            "score": 0.91,
            "text": "CAPA effectiveness checks were missing.",
        }
    ]
    client = FakeOpenAIClient(
        json.dumps(
            {
                "title": "CAPA Effectiveness Report",
                "summary": "Prepared a CAPA-focused DOCX report from the supplied evidence.",
                "report_markdown": full_report,
            }
        )
    )

    artifact = generate_docx_report_artifact(
        client=client,
        messages=[{"role": "user", "content": "Generate a DOCX report."}],
        model="fake-model",
        sources=sources,
    )

    assert artifact.title == "CAPA Effectiveness Report"
    assert artifact.summary == "Prepared a CAPA-focused DOCX report from the supplied evidence."
    assert artifact.content == full_report
    assert artifact.content != artifact.summary
    assert artifact.sources == sources


def test_generate_docx_report_artifact_extracts_fenced_and_surrounded_json():
    cases = [
        {
            "name": "fenced json",
            "content": "```json\n{\"title\":\"Fenced Report\",\"summary\":\"Short fenced summary.\",\"report_markdown\":\"# Fenced body\\nFull report text.\"}\n```",
            "expected_title": "Fenced Report",
            "expected_summary": "Short fenced summary.",
            "expected_content": "# Fenced body\nFull report text.",
        },
        {
            "name": "surrounded json",
            "content": "prefix text {\"title\":\"Recovered Report\",\"summary\":\"Short recovered summary.\",\"report_markdown\":\"# Recovered body\\nFull report text.\"} suffix text",
            "expected_title": "Recovered Report",
            "expected_summary": "Short recovered summary.",
            "expected_content": "# Recovered body\nFull report text.",
        },
    ]

    for case in cases:
        artifact = generate_docx_report_artifact(
            client=FakeOpenAIClient(case["content"]),
            messages=[{"role": "user", "content": "Need a report document."}],
            model="fake-model",
        )

        assert artifact.title == case["expected_title"], case["name"]
        assert artifact.content == case["expected_content"], case["name"]
        assert artifact.summary == case["expected_summary"], case["name"]
        assert artifact.content != artifact.summary, case["name"]


def test_is_docx_report_request_detects_report_artifact_prompts_without_general_chat():
    report_prompts = [
        "Create a DOCX report for these FDA observations.",
        "Generate a downloadable report document from the cited evidence.",
        "請產生一份可下載的報告檔案",
    ]
    unrelated_prompts = [
        "Summarize the FDA observations in chat.",
        "What does this warning letter say about CAPA?",
        "Show a chart of monthly task counts.",
    ]

    for prompt in report_prompts:
        assert is_docx_report_request(prompt), prompt
    for prompt in unrelated_prompts:
        assert not is_docx_report_request(prompt), prompt


def test_stream_report_artifact_emits_docx_data_part_and_chat_summary_separately():
    full_report = (
        "# Batch Release Investigation\n\n"
        "## Facts\n"
        "Lot A had incomplete deviation closure evidence.\n\n"
        "## Inferences\n"
        "The available records support a documentation-gap finding.\n\n"
        "## Recommendations\n"
        "Attach closure evidence before release."
    )
    summary = "Prepared a short chat summary for the downloadable DOCX report."
    sources = [
        {
            "title": "Deviation SOP",
            "filename": "deviation-sop.pdf",
            "chunk_index": 4,
            "score": 0.88,
            "text": "Closure evidence must be attached before release.",
        }
    ]
    report = DocxReportArtifact(
        title="Batch Release Investigation",
        summary=summary,
        content=full_report,
        sources=sources,
    )

    parts = _stream_parts(report, sources=sources)

    docx_parts = [part for part in parts if part["type"] == "data-docx-report"]
    assert len(docx_parts) == 1
    docx_payload = docx_parts[0]["data"]
    assert docx_payload["title"] == "Batch Release Investigation"
    assert docx_payload["content"] == full_report
    assert docx_payload["content"] != summary
    assert docx_payload["sources"] == [
        {
            "title": "Deviation SOP",
            "filename": "deviation-sop.pdf",
            "score": 0.88,
            "text": "Closure evidence must be attached before release.",
        }
    ]

    visible_text = "".join(
        part["delta"] for part in parts if part["type"] == "text-delta"
    )
    assert visible_text == summary
    assert visible_text != full_report
    assert "Lot A had incomplete deviation closure evidence" not in visible_text

    assert parts[-1] == {"type": "finish"}
