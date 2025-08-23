from typing import List
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        # Use a smaller, more memory-efficient model
        # paraphrase-MiniLM-L3-v2: ~60MB vs all-MiniLM-L6-v2: ~90MB
        self.model_id = "sentence-transformers/paraphrase-MiniLM-L3-v2"
        try:
            # Load the model locally for better performance and reliability
            self.model = SentenceTransformer(self.model_id)
            print(f"Successfully loaded embedding model: {self.model_id}")
        except Exception as e:
            print(f"Error loading sentence transformer model: {e}")
            self.model = None
    
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        if not self.model:
            raise Exception("Sentence transformer model not loaded")
        
        try:
            # Generate embeddings for all texts at once (more efficient)
            embeddings = self.model.encode(texts)
            return [embedding.tolist() for embedding in embeddings]
        except Exception as e:
            raise Exception(f"Error generating embeddings: {str(e)}")
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        if not self.model:
            raise Exception("Sentence transformer model not loaded")
        
        try:
            # Generate embedding for single text
            embedding = self.model.encode([text])
            return embedding[0].tolist()  # Return as list of floats
        except Exception as e:
            raise Exception(f"Error generating embedding: {str(e)}")