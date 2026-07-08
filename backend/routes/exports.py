from typing import Optional

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel

from services.docx_export_service import (
    DOCX_MEDIA_TYPE,
    DocxSource,
    build_docx_bytes,
    sanitize_docx_filename,
)

router = APIRouter(prefix="/api/export", tags=["exports"])


class ExportSourceRequest(BaseModel):
    title: Optional[str] = None
    filename: Optional[str] = None
    score: Optional[float] = None
    text: Optional[str] = None


class DocxExportRequest(BaseModel):
    title: Optional[str] = None
    content: str
    sources: Optional[list[ExportSourceRequest]] = None


@router.post("/docx")
async def export_docx(request: DocxExportRequest) -> Response:
    if not request.content.strip():
        raise HTTPException(status_code=400, detail="content must not be blank")

    sources = [
        DocxSource(
            title=source.title,
            filename=source.filename,
            score=source.score,
            text=source.text,
        )
        for source in request.sources or []
    ]
    filename = sanitize_docx_filename(request.title)
    docx_bytes = build_docx_bytes(
        content=request.content,
        title=request.title,
        sources=sources,
    )

    return Response(
        content=docx_bytes,
        media_type=DOCX_MEDIA_TYPE,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
