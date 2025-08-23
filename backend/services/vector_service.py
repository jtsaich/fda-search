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
    
    async def list_documents(self) -> List[Dict[str, Any]]:
        """List all unique documents in the vector database"""
        if not self.api_key or not self.index:
            return []
        
        try:
            # Query all vectors to get metadata (this is a simple approach)
            # For large datasets, you'd want to implement a proper document registry
            results = self.index.query(
                vector=[0.0] * 384,  # Dummy vector
                top_k=10000,  # Large number to get all vectors
                include_metadata=True,
                include_values=False
            )
            
            # Group by document_id to get unique documents
            documents_dict = {}
            for match in results.get("matches", []):
                metadata = match.get("metadata", {})
                doc_id = metadata.get("document_id")
                
                if doc_id and doc_id not in documents_dict:
                    documents_dict[doc_id] = {
                        "id": doc_id,
                        "filename": metadata.get("filename", "Unknown"),
                        "upload_date": metadata.get("upload_date", "Unknown"),
                        "chunks": []
                    }
                
                if doc_id:
                    documents_dict[doc_id]["chunks"].append({
                        "chunk_index": metadata.get("chunk_index", 0),
                        "token_count": metadata.get("token_count", 0)
                    })
            
            # Calculate aggregate info for each document
            document_list = []
            for doc_id, doc_info in documents_dict.items():
                chunks = doc_info["chunks"]
                total_tokens = sum(chunk["token_count"] for chunk in chunks)
                
                document_list.append({
                    "id": doc_id,
                    "filename": doc_info["filename"],
                    "upload_date": doc_info["upload_date"],
                    "size": total_tokens * 4,  # Rough estimate: 4 bytes per token
                    "chunk_count": len(chunks)
                })
            
            # Sort by upload date (newest first)
            document_list.sort(key=lambda x: x.get("upload_date", ""), reverse=True)
            
            return document_list
            
        except Exception as e:
            print(f"Error listing documents: {e}")
            return []