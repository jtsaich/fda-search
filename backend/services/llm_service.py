import os
import base64
from typing import List, Dict, Any, Optional
import openai
from dotenv import load_dotenv

load_dotenv()


def encode_file_to_base64(file_path: str) -> str:
    """Encode a file to base64 string"""
    with open(file_path, "rb") as file:
        return base64.b64encode(file.read()).decode("utf-8")


def get_file_mime_type(filename: str) -> str:
    """Get MIME type based on file extension"""
    ext = filename.lower().split(".")[-1]
    mime_types = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "gif": "image/gif",
        "webp": "image/webp",
        "txt": "text/plain",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
    }
    return mime_types.get(ext, "application/octet-stream")


class LLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        self.base_url = "https://openrouter.ai/api/v1"
        self.model = "google/gemma-3-27b-it:free"

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
        attached_files: Optional[List[Dict[str, Any]]] = None,
        use_system_prompt: bool = True,
    ) -> str:
        """Generate RAG response using LLM with retrieved context and optional file attachments"""
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

        # Build messages array
        messages = []

        # Add system prompt if enabled
        if use_system_prompt:
            system_prompt = f"""You are a helpful FDA regulatory assistant. A user has asked a question and here is the relevant information from the knowledge base:

{context}

Please provide a helpful, accurate response based on this information. Keep the response concise and informative. If you include information from the documents, make sure it's accurate to what's provided in the context.

The user's question is: {query}"""
            messages.append({"role": "system", "content": system_prompt})

        try:
            # Use provided model or fallback to default
            selected_model = model if model else self.model

            # Build user message content (multimodal if files attached)
            user_content = self._build_multimodal_content(query, attached_files)

            # Add user message
            messages.append({"role": "user", "content": user_content})  # type: ignore

            # Generate response using OpenRouter
            response = self.client.chat.completions.create(
                model=selected_model,
                messages=messages,  # type: ignore
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

    def _build_multimodal_content(
        self, query: str, attached_files: Optional[List[Dict[str, Any]]] = None
    ):
        """Build multimodal content array for messages with text and files"""
        # If no files, return simple text
        if not attached_files:
            return query

        # Build content array with text and files
        content: List[Dict[str, Any]] = [{"type": "text", "text": query}]

        for file_info in attached_files:
            file_path = file_info.get("path")
            filename = file_info.get("filename", "")

            # Skip if file path is missing
            if not file_path:
                continue

            mime_type = get_file_mime_type(filename)

            # Encode file to base64
            base64_data = encode_file_to_base64(file_path)

            # Handle different file types
            if mime_type.startswith("image/"):
                # Image format for OpenRouter
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{base64_data}"},
                    }
                )
            elif mime_type == "application/pdf":
                # PDF format for OpenRouter
                content.append(
                    {
                        "type": "file",
                        "file": {
                            "filename": filename,
                            "file_data": f"data:{mime_type};base64,{base64_data}",
                        },
                    }
                )
            else:
                # For text files, we could extract and include as text
                # For now, treat as generic file
                content.append(
                    {
                        "type": "file",
                        "file": {
                            "filename": filename,
                            "file_data": f"data:{mime_type};base64,{base64_data}",
                        },
                    }
                )

        return content

    async def generate_direct_response(
        self,
        query: str,
        model: Optional[str] = None,
        attached_files: Optional[List[Dict[str, Any]]] = None,
        use_system_prompt: bool = True,
    ) -> str:
        """Generate direct LLM response without RAG context"""
        if not self.client:
            raise Exception("OpenRouter API key not configured")

        # Build messages array
        messages = []

        # Add system prompt if enabled
        if use_system_prompt:
            system_prompt = """You are a helpful FDA regulatory assistant. You have general knowledge about FDA regulations, processes, and guidelines.

Please provide helpful and accurate responses based on your training data. Be clear about the limitations of your knowledge and recommend consulting official FDA resources when appropriate."""
            messages.append({"role": "system", "content": system_prompt})

        try:
            # Use provided model or fallback to default
            selected_model = model if model else self.model

            # Build user message content (multimodal if files attached)
            user_content = self._build_multimodal_content(query, attached_files)

            # Add user message
            messages.append({"role": "user", "content": user_content})  # type: ignore

            # Generate response using OpenRouter
            response = self.client.chat.completions.create(
                model=selected_model,
                messages=messages,  # type: ignore
                temperature=0.7,
                max_tokens=500,
            )

            # Extract the response content
            llm_response = (
                response.choices[0].message.content or "No response generated"
            )

            return llm_response

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
