from fastapi import APIRouter, HTTPException
import logging

from services.vector_service import VectorService
from services.embedding_service import EmbeddingService
from services.llm_service import LLMService

router = APIRouter(tags=["health"])
logger = logging.getLogger(__name__)

# Initialize services
vector_service = VectorService()
embedding_service = EmbeddingService()
llm_service = LLMService()


@router.get("/health/pinecone")
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
            "index_exists": vector_service.index_name in indexes,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/health/embeddings")
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
            "test_text": test_text,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/health/llm")
async def test_llm():
    """Test OpenRouter LLM connection"""
    return await llm_service.test_connection()


@router.post("/admin/recreate-index")
async def recreate_pinecone_index():
    """Delete and recreate Pinecone index (USE WITH CAUTION - deletes all vectors!)"""
    try:
        if not vector_service.pc:
            raise HTTPException(status_code=500, detail="Pinecone not configured")

        index_name = vector_service.index_name

        # Delete existing index if it exists
        existing_indexes = [index["name"] for index in vector_service.pc.list_indexes()]
        if index_name in existing_indexes:
            vector_service.pc.delete_index(index_name)
            logger.info(f"Deleted existing index: {index_name}")

        # Create new index with 768 dimensions
        vector_service.pc.create_index(
            name=index_name,
            dimension=768,
            metric="cosine",
            spec={"serverless": {"cloud": "aws", "region": "us-east-1"}},
        )

        # Reconnect to the new index
        vector_service.index = vector_service.pc.Index(index_name)

        logger.info(f"Created new index: {index_name} with 768 dimensions")
        return {
            "message": "Index recreated successfully",
            "index_name": index_name,
            "dimension": 768,
            "note": "Please re-upload all documents",
        }
    except Exception as e:
        logger.error(f"Error recreating index: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
