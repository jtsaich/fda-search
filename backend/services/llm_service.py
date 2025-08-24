import os
from typing import List, Dict, Any, Optional
import openai
from dotenv import load_dotenv

load_dotenv()


class LLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "google/gemma-2-9b-it:free"

        if self.api_key:
            self.client = openai.OpenAI(api_key=self.api_key, base_url=self.base_url)
        else:
            self.client = None

    async def generate_rag_response(
        self,
        query: str,
        context_chunks: List[str],
        sources: List[Dict[str, Any]],
        model: Optional[str] = None,
    ) -> str:
        """Generate RAG response using LLM with retrieved context"""
        if not self.client:
            raise Exception("OpenRouter API key not configured")

        # Prepare context from chunks
        context = "\n\n".join(context_chunks[:3])  # Use top 3 chunks

        # Format sources for the response
        sources_text = ""
        if sources:
            sources_text = "\n\n**Sources:**\n"
            for i, source in enumerate(sources[:3]):
                sources_text += f"{i + 1}. {source.get('filename', 'Unknown')} "
                sources_text += f"(similarity: {(source.get('similarity_score', 0.0) * 100):.1f}%)\n"

        # Create system prompt for RAG
        system_prompt = f"""You are a helpful FDA regulatory assistant. A user has asked a question and here is the relevant information from the knowledge base:

{context}

Please provide a helpful, accurate response based on this information. Keep the response concise and informative. If you include information from the documents, make sure it's accurate to what's provided in the context.

The user's question is: {query}"""

        try:
            # Use provided model or fallback to default
            selected_model = model if model else self.model

            # Generate response using OpenRouter
            response = self.client.chat.completions.create(
                model=selected_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query},
                ],
                temperature=0.1,
                max_tokens=500,
            )

            # Extract the response content
            llm_response = (
                response.choices[0].message.content or "No response generated"
            )

            # Append sources to the response
            final_response = llm_response + sources_text

            return final_response

        except Exception as e:
            print(f"OpenRouter API Error: {str(e)}")
            raise Exception(f"Error generating LLM response: {str(e)}")

    async def test_connection(self) -> Dict[str, Any]:
        """Test the OpenRouter connection"""
        if not self.client:
            return {"status": "error", "message": "OpenRouter API key not configured"}

        try:
            # Test with a simple query
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=10,
            )

            return {
                "status": "success",
                "model": self.model,
                "test_response": response.choices[0].message.content,
            }
        except Exception as e:
            print(f"OpenRouter API Error in test_connection: {str(e)}")
            return {"status": "error", "message": str(e)}
