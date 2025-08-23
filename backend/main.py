from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from pathlib import Path
from dotenv import load_dotenv

from services.document_service import DocumentService
from services.vector_service import VectorService
from services.embedding_service import EmbeddingService
from services.llm_service import LLMService

load_dotenv()

# Initialize services
document_service = DocumentService()
vector_service = VectorService()
embedding_service = EmbeddingService()
llm_service = LLMService()

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
    if not file.filename or not file.filename.endswith(('.pdf', '.txt', '.docx')):
        raise HTTPException(status_code=400, detail="Unsupported file type")
    
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = Path("uploads")
        uploads_dir.mkdir(exist_ok=True)
        
        # Save uploaded file
        file_path = uploads_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process document
        result = await document_service.process_document(str(file_path), file.filename)
        
        # Generate embeddings for chunks
        chunk_texts = [chunk["text"] for chunk in result["chunks"]]
        embeddings = await embedding_service.generate_embeddings(chunk_texts)
        
        # Prepare vectors for Pinecone
        vectors = []
        for i, (chunk, embedding) in enumerate(zip(result["chunks"], embeddings)):
            vectors.append({
                "id": f"{result['document_id']}_chunk_{i}",
                "values": embedding,
                "metadata": {
                    "document_id": result["document_id"],
                    "filename": result["filename"],
                    "chunk_index": i,
                    "text": chunk["text"],
                    "token_count": chunk["token_count"]
                }
            })
        
        # Store vectors in Pinecone
        upsert_result = await vector_service.upsert_vectors(vectors)
        
        # Clean up temporary file
        os.remove(file_path)
        
        return {
            "message": f"File {file.filename} processed and indexed successfully",
            "document_id": result["document_id"],
            "chunks_created": result["chunk_count"],
            "upload_date": result["upload_date"],
            "vectors_stored": upsert_result.get("vectors_upserted", 0)
        }
    except Exception as e:
        # Clean up file if it exists
        if 'file_path' in locals() and file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.post("/query", response_model=QueryResponse)
async def query_documents(request: QueryRequest):
    try:
        # Generate embedding for the query
        query_embedding = await embedding_service.generate_embedding(request.query)
        
        # Search for similar chunks in Pinecone
        similar_chunks = await vector_service.search_similar(
            query_embedding, 
            top_k=request.max_results or 5
        )
        
        # Extract source information
        sources = []
        context_chunks = []
        
        for chunk in similar_chunks:
            metadata = chunk.get("metadata", {})
            sources.append({
                "document_id": metadata.get("document_id", "unknown"),
                "filename": metadata.get("filename", "unknown"),
                "chunk_text": metadata.get("text", "")[:200] + "...",
                "similarity_score": chunk.get("score", 0.0),
                "chunk_index": metadata.get("chunk_index", 0)
            })
            context_chunks.append(metadata.get("text", ""))
        
        # Check if we have relevant context
        if not context_chunks:
            return QueryResponse(
                answer="I couldn't find any relevant information in the uploaded documents for your query.",
                sources=[],
                confidence=0.0
            )
        
        # Generate LLM response using the retrieved context
        answer = await llm_service.generate_rag_response(
            query=request.query,
            context_chunks=context_chunks,
            sources=sources
        )
        
        return QueryResponse(
            answer=answer,
            sources=sources,
            confidence=similar_chunks[0].get("score", 0.0) if similar_chunks else 0.0
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

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

@app.get("/health/pinecone")
async def test_pinecone():
    """Test Pinecone connection and index status"""
    if not vector_service.pc:
        return {"status": "error", "message": "Pinecone not initialized"}
    
    try:
        indexes = [index.name for index in vector_service.pc.list_indexes()]
        return {
            "status": "connected",
            "indexes": indexes,
            "target_index": vector_service.index_name,
            "index_exists": vector_service.index_name in indexes
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health/embeddings")
async def test_embeddings():
    """Test sentence-transformers embeddings"""
    if not embedding_service.model:
        return {"status": "error", "message": "Sentence transformer model not loaded"}
    
    try:
        test_text = "This is a test document for FDA regulatory guidance."
        embedding = await embedding_service.generate_embedding(test_text)
        return {
            "status": "success",
            "model": embedding_service.model_id,
            "embedding_dimension": len(embedding),
            "test_text": test_text
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/health/llm")
async def test_llm():
    """Test OpenRouter LLM connection"""
    return await llm_service.test_connection()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)