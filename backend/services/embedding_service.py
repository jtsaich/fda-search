import os
import requests
from typing import List
from dotenv import load_dotenv

load_dotenv()

class EmbeddingService:
    def __init__(self):
        self.api_key = os.getenv("HUGGINGFACE_API_KEY")
        self.model_id = "sentence-transformers/all-MiniLM-L6-v2"
        self.api_url = f"https://api-inference.huggingface.co/models/{self.model_id}"
        self.headers = {"Authorization": f"Bearer {self.api_key}"}
    
    async def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts"""
        embeddings = []
        
        for text in texts:
            response = requests.post(
                self.api_url,
                headers=self.headers,
                json={"inputs": text}
            )
            
            if response.status_code == 200:
                embedding = response.json()
                embeddings.append(embedding)
            else:
                raise Exception(f"Error generating embedding: {response.text}")
        
        return embeddings
    
    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        response = requests.post(
            self.api_url,
            headers=self.headers,
            json={"inputs": text}
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Error generating embedding: {response.text}")