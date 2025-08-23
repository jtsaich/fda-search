from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class QueryRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5

class Source(BaseModel):
    document_id: str
    filename: str
    chunk_text: str
    page: Optional[int] = None
    similarity_score: float

class QueryResponse(BaseModel):
    answer: str
    sources: List[Source]
    confidence: float
    response_time: float

class Document(BaseModel):
    id: str
    filename: str
    upload_date: datetime
    size: int
    chunk_count: int
    status: str = "processed"

class UploadResponse(BaseModel):
    message: str
    document_id: str
    filename: str
    chunks_created: int
    processing_time: float

class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None