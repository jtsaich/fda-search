"""Contract tests for the DOCX export endpoint."""

from io import BytesIO

from docx import Document
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routes.exports import router as exports_router


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(exports_router)
    return TestClient(app)


def _docx_text(docx_bytes: bytes) -> str:
    document = Document(BytesIO(docx_bytes))
    return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text)


def test_docx_export_returns_downloadable_parseable_answer_document():
    response = _client().post(
        "/api/export/docx",
        json={
            "title": "FDA Warning Letter Review",
            "content": "# Review summary\nThe inspection found incomplete CAPA records.\n- Verify batch identity\n- Document corrective action",
            "sources": [],
        },
    )

    assert response.status_code == 200
    assert (
        response.headers["content-type"].split(";", 1)[0]
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    content_disposition = response.headers["content-disposition"]
    assert content_disposition.startswith("attachment;")
    assert "filename=" in content_disposition
    assert content_disposition.endswith('.docx"') or content_disposition.endswith(".docx")

    text = _docx_text(response.content)
    assert "Review summary" in text
    assert "The inspection found incomplete CAPA records." in text
    assert "Verify batch identity" in text
    assert "Document corrective action" in text


def test_docx_export_renders_sources_referenced_section():
    response = _client().post(
        "/api/export/docx",
        json={
            "title": "Source-backed answer",
            "content": "The response cites the retrieved FDA guidance.",
            "sources": [
                {
                    "title": "FDA Guidance for Industry",
                    "filename": "guidance.pdf",
                    "score": 0.92,
                    "text": "Firms should establish written procedures for corrective actions.",
                },
                {
                    "filename": "inspection-notes.docx",
                    "text": "Investigator noted missing CAPA evidence.",
                },
            ],
        },
    )

    assert response.status_code == 200
    text = _docx_text(response.content)
    assert "Sources Referenced" in text
    assert "FDA Guidance for Industry" in text
    assert "guidance.pdf" in text
    assert "0.92" in text
    assert "Firms should establish written procedures for corrective actions." in text
    assert "inspection-notes.docx" in text
    assert "Investigator noted missing CAPA evidence." in text


def test_docx_export_rejects_blank_content_without_docx_bytes():
    response = _client().post(
        "/api/export/docx",
        json={"title": "Blank", "content": " \n\t ", "sources": []},
    )

    assert response.status_code == 400
    assert "content" in response.json()["detail"].lower()
    assert (
        response.headers.get("content-type", "").split(";", 1)[0]
        != "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert not response.content.startswith(b"PK")
