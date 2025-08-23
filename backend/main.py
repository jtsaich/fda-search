from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="FDA RAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5

class QueryResponse(BaseModel):
    answer: str
    sources: List[dict]
    confidence: float

class Document(BaseModel):
    id: str
    filename: str
    upload_date: str
    size: int
    chunk_count: int

@app.get("/")
async def root():
    return {"message": "FDA RAG API is running"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.endswith(('.pdf', '.txt', '.docx')):
        raise HTTPException(status_code=400, detail="Unsupported file type")
    
    return {
        "message": f"File {file.filename} uploaded successfully",
        "document_id": "doc_123",
        "chunks_created": 10
    }

@app.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    return QueryResponse(
        answer="This is a placeholder response for your query about FDA regulations.",
        sources=[
            {
                "document_id": "doc_123",
                "filename": "sample.pdf",
                "chunk_text": "Relevant text from the document...",
                "page": 1
            }
        ],
        confidence=0.85
    )

@app.get("/documents", response_model=List[Document])
async def list_documents():
    return [
        Document(
            id="doc_123",
            filename="sample.pdf",
            upload_date="2024-01-01",
            size=1024000,
            chunk_count=10
        )
    ]

@app.delete("/documents/{document_id}")
async def delete_document(document_id: str):
    return {"message": f"Document {document_id} deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)