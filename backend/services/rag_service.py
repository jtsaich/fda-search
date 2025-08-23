import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

class RAGService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.api_url = "https://openrouter.ai/api/v1/chat/completions"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def generate_answer(
        self, 
        query: str, 
        context_chunks: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Generate answer using RAG"""
        
        context = self._format_context(context_chunks)
        prompt = self._create_prompt(query, context)
        
        if not self.api_key:
            return {
                "answer": "OpenRouter API not configured. This is a placeholder response.",
                "model": "placeholder",
                "confidence": 0.0
            }
        
        response = requests.post(
            self.api_url,
            headers=self.headers,
            json={
                "model": "meta-llama/llama-3.2-3b-instruct:free",
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an FDA regulatory expert assistant. Answer questions based on the provided context from FDA documents."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.3,
                "max_tokens": 500
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            return {
                "answer": result["choices"][0]["message"]["content"],
                "model": result["model"],
                "confidence": 0.85
            }
        else:
            return {
                "answer": f"Error generating response: {response.text}",
                "model": "error",
                "confidence": 0.0
            }
    
    def _format_context(self, chunks: List[Dict[str, Any]]) -> str:
        """Format context chunks for the prompt"""
        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(f"[Source {i}]: {chunk['text']}")
        return "\n\n".join(context_parts)
    
    def _create_prompt(self, query: str, context: str) -> str:
        """Create the RAG prompt"""
        return f"""Based on the following context from FDA documents, answer the question.

Context:
{context}

Question: {query}

Please provide a comprehensive answer based on the information in the context. If the context doesn't contain enough information to fully answer the question, mention what information is available and what might be missing."""