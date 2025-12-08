from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Any

from services.vector_service import VectorService
from services.auth_service import require_permission

router = APIRouter(prefix="/documents", tags=["documents"])

# Initialize service
vector_service = VectorService()


class Document(BaseModel):
    id: str
    filename: str
    upload_date: str
    size: int
    chunk_count: int


@router.get("", response_model=List[Document])
async def list_documents():
    """List all documents from the vector database"""
    try:
        # Get documents from vector database
        documents = await vector_service.list_documents()

        # Convert to Document model format
        document_list = []
        for doc in documents:
            document_list.append(
                Document(
                    id=doc["id"],
                    filename=doc["filename"],
                    upload_date=doc["upload_date"],
                    size=doc["size"],
                    chunk_count=doc["chunk_count"],
                )
            )

        return document_list
    except Exception as e:
        # Return empty list if error occurs
        print(f"Error listing documents: {e}")
        return []


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: Dict[str, Any] = Depends(require_permission("documents.delete"))
):
    """Delete a document and all its vectors from the database

    Requires: documents.delete permission
    """
    try:
        # Delete document vectors from Pinecone
        result = await vector_service.delete_document_vectors(document_id)

        if result.get("status") == "deleted":
            return {
                "message": f"Document {document_id} deleted successfully",
                "deleted_by": current_user.get("email")
            }
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete document: {result.get('message', 'Unknown error')}",
            )
    except HTTPException:
        # Re-raise HTTP exceptions (including auth failures)
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting document: {str(e)}"
        )
