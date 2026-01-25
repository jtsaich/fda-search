"""
AI SDK Chat Protocol Implementation for FastAPI
Implements the Vercel AI SDK data stream protocol
https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-stream-protocol
"""

import json
import logging
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ClientAttachment(BaseModel):
    name: str
    contentType: str
    url: str


class ToolInvocation(BaseModel):
    toolCallId: str
    toolName: str
    args: dict
    result: dict


class ClientMessage(BaseModel):
    role: str
    content: str
    experimental_attachments: Optional[List[ClientAttachment]] = None
    toolInvocations: Optional[List[ToolInvocation]] = None


class ChatMessage(BaseModel):
    role: str
    content: Optional[str] = None
    parts: Optional[List[Dict[str, Any]]] = None
    experimental_attachments: Optional[List[Dict[str, Any]]] = None

    class Config:
        extra = "ignore"  # Ignore extra fields like id, createdAt, etc.

    def get_text_content(self) -> str:
        """Extract text content from either content field or parts array"""
        if self.content:
            return self.content

        if self.parts:
            text_parts = []
            for part in self.parts:
                if part.get("type") == "text" and part.get("text"):
                    text_parts.append(part["text"])
            return " ".join(text_parts) if text_parts else ""

        return ""


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "google/gemma-3-27b-it:free"
    use_rag: Optional[bool] = True
    system_prompt: Optional[str] = None


available_tools = {}


def stream_text(
    client,
    messages: List[Dict[str, Any]],
    model: str,
    temperature: float = 0.7,
    protocol: str = "data",
    sources: Optional[List[Dict[str, Any]]] = None,
):
    """
    Stream response from OpenRouter using AI SDK v5 SSE (Server-Sent Events) format

    Yields Server-Sent Events formatted chunks:
    - data: {"type":"message-start","messageId":"..."}
    - data: {"type":"text-delta","delta":"text"}
    - data: {"type":"finish-message","finishReason":"stop"}
    - data: [DONE]

    https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
    """
    import uuid

    stream = client.chat.completions.create(
        model=model,
        messages=messages,
        stream=True,
        temperature=temperature,
        max_tokens=1000,
        stream_options={"include_usage": True},
    )

    # When protocol is set to "text", send plain text chunks
    if protocol == "text":
        for chunk in stream:
            for choice in chunk.choices:
                if choice.finish_reason == "stop":
                    break
                elif choice.delta and choice.delta.content:
                    yield choice.delta.content

    # When protocol is set to "data", use AI SDK v5 SSE format
    elif protocol == "data":
        text_id = str(uuid.uuid4())
        text_started = False
        usage_data = None

        try:
            # Send source-document parts BEFORE text starts (if provided)
            # Following AI SDK SourceDocumentUIPart structure
            # providerMetadata must be Record<string, any> where values are JSON-serializable
            if sources:
                for source in sources:
                    source_id = str(uuid.uuid4())
                    data = json.dumps(
                        {
                            "type": "source-document",
                            "sourceId": source_id,
                            "mediaType": "text/plain",
                            "title": f"{source.get('filename', 'Unknown')} - Chunk {source.get('chunk_index', 0) + 1}",
                            "filename": source.get("filename", "Unknown"),
                            "providerMetadata": {
                                "rag": {
                                    "chunk_index": source.get("chunk_index", 0),
                                    "score": source.get("score", 0),
                                    "text": source.get("text", ""),
                                    "document_id": source.get("id", ""),
                                }
                            },
                        }
                    )
                    yield f"data: {data}\n\n"

            for chunk in stream:
                # Capture usage data from the final chunk (when include_usage is enabled)
                if hasattr(chunk, "usage") and chunk.usage is not None:
                    usage_data = {
                        "prompt_tokens": chunk.usage.prompt_tokens,
                        "completion_tokens": chunk.usage.completion_tokens,
                        "total_tokens": chunk.usage.total_tokens,
                    }
                    logger.info(f"Token usage: {usage_data}")

                if not chunk.choices or len(chunk.choices) == 0:
                    continue

                for choice in chunk.choices:
                    # Send text-start on first content chunk
                    if not text_started and choice.delta and choice.delta.content:
                        data = json.dumps({"type": "text-start", "id": text_id})
                        yield f"data: {data}\n\n"
                        text_started = True

                    # Send text deltas with the same id
                    if choice.delta and choice.delta.content:
                        data = json.dumps(
                            {
                                "type": "text-delta",
                                "id": text_id,
                                "delta": choice.delta.content,
                            }
                        )
                        yield f"data: {data}\n\n"

                    # Capture finish reason
                    if choice.finish_reason:
                        finish_reason = choice.finish_reason
                        logger.info(f"Stream finished with reason: {finish_reason}")

            # Send text-end after all text deltas
            if text_started:
                data = json.dumps({"type": "text-end", "id": text_id})
                yield f"data: {data}\n\n"

            # Send usage data if available (before finish)
            if usage_data and usage_data.get("prompt_tokens") is not None:
                data = json.dumps({"type": "data-usage", "data": usage_data})
                yield f"data: {data}\n\n"

            # Send finish-message
            data = json.dumps({"type": "finish"})
            yield f"data: {data}\n\n"

        except Exception as e:
            logger.error(f"Error during streaming: {str(e)}")
            # Send error message
            yield f'data: {json.dumps({"type": "error", "error": str(e)})}\n\n'

        finally:
            # Always send [DONE] at the end to properly close the stream
            yield "data: [DONE]\n\n"
