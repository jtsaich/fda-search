import os
from typing import List, Dict, Any
from pinecone import Pinecone
from dotenv import load_dotenv

load_dotenv()

class VectorService:
    def __init__(self):
        self.api_key = os.getenv("PINECONE_API_KEY")
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "fda-documents")
        self.pc = None
        self.index = None
        
        if self.api_key:
            self.pc = Pinecone(api_key=self.api_key)
            self._ensure_index_exists()
    
    def _ensure_index_exists(self):
        """Create index if it doesn't exist"""
        try:
            existing_indexes = [index['name'] for index in self.pc.list_indexes()]
            
            if self.index_name not in existing_indexes:
                self.pc.create_index(
                    name=self.index_name,
                    dimension=384,  # all-MiniLM-L6-v2 dimension
                    metric="cosine",
                    spec={
                        'serverless': {
                            'cloud': 'aws',
                            'region': 'us-east-1'
                        }
                    }
                )
            
            self.index = self.pc.Index(self.index_name)
        except Exception as e:
            print(f"Error initializing Pinecone: {e}")
            self.index = None
    
    async def upsert_vectors(self, vectors: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Insert or update vectors in Pinecone"""
        if not self.api_key or not self.index:
            return {"message": "Pinecone not configured, skipping vector storage"}
        
        try:
            batch_size = 100
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                self.index.upsert(vectors=batch)
            
            return {
                "vectors_upserted": len(vectors),
                "status": "success"
            }
        except Exception as e:
            return {
                "error": f"Failed to upsert vectors: {str(e)}",
                "status": "error"
            }
    
    async def search_similar(self, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar vectors"""
        if not self.api_key or not self.index:
            return []
        
        try:
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                include_metadata=True
            )
            
            return [
                {
                    "id": match["id"],
                    "score": match["score"],
                    "metadata": match.get("metadata", {})
                }
                for match in results["matches"]
            ]
        except Exception as e:
            print(f"Error searching vectors: {e}")
            return []
    
    async def delete_document_vectors(self, document_id: str) -> Dict[str, Any]:
        """Delete all vectors for a document"""
        if not self.api_key:
            return {"message": "Pinecone not configured"}
        
        self.index.delete(
            filter={"document_id": document_id}
        )
        
        return {
            "document_id": document_id,
            "status": "deleted"
        }