"""
AI SDK Chat Protocol Implementation for FastAPI
Implements the Vercel AI SDK data stream protocol
https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol#data-stream-protocol
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional
from pydantic import AliasChoices, BaseModel, ConfigDict, Field
import tiktoken

logger = logging.getLogger(__name__)

# Default model — overridable via OPENROUTER_DEFAULT_MODEL env var so the
# active model can be swapped from the Railway dashboard without redeploying.
DEFAULT_MODEL = os.getenv(
    "OPENROUTER_DEFAULT_MODEL",
    "google/gemini-2.5-flash-lite-preview-09-2025",
)

# Model context limits
MODEL_CONTEXT_LIMITS = {
    "google/gemma-3-27b-it:free": 131072,
    "google/gemma-3-27b-it": 131072,
    "google/gemini-2.5-flash-lite-preview-09-2025": 1048576,
    "google/gemini-3-flash-preview": 1048576,
    "anthropic/claude-3.5-sonnet": 200000,
    "openai/gpt-4o": 128000,
    "default": 100000,
}

# Fallback models when primary model is unavailable
# Note: gemma-3-27b-it doesn't support system prompts, so use a different fallback
MODEL_FALLBACKS = {
    "google/gemma-3-27b-it:free": "google/gemini-3-flash-preview",
    "google/gemma-3-27b-it": "google/gemini-3-flash-preview",
}


def get_model_limit(model: str) -> int:
    """Get the context token limit for a model."""
    return MODEL_CONTEXT_LIMITS.get(model, MODEL_CONTEXT_LIMITS["default"])


def count_message_tokens(messages: list) -> int:
    """Count tokens in message list using tiktoken."""
    encoder = tiktoken.get_encoding("cl100k_base")
    total = 0
    for msg in messages:
        total += 4  # role overhead
        content = msg.get("content", "")
        if isinstance(content, str):
            total += len(encoder.encode(content))
        elif isinstance(content, list):
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    total += len(encoder.encode(part.get("text", "")))
                elif isinstance(part, dict) and part.get("type") == "image_url":
                    total += 85  # image token estimate
    total += 2  # reply priming
    return total


def truncate_messages_to_fit(
    messages: list, max_tokens: int, reserved: int = 1000
) -> list:
    """Truncate messages to fit limit, preserving system msg and recent messages."""
    available = max_tokens - reserved

    # Separate system message
    system_msg = None
    conversation = []
    for msg in messages:
        if msg.get("role") == "system":
            system_msg = msg
        else:
            conversation.append(msg)

    system_tokens = count_message_tokens([system_msg]) if system_msg else 0

    # Always ensure we keep at least the last user message
    last_user_msg = None
    for msg in reversed(conversation):
        if msg.get("role") == "user":
            last_user_msg = msg
            break

    last_user_tokens = count_message_tokens([last_user_msg]) if last_user_msg else 0

    # If system message too large, truncate its content but keep last user message
    if system_msg and system_tokens > available - last_user_tokens:
        encoder = tiktoken.get_encoding("cl100k_base")
        content = system_msg.get("content", "")
        tokens = encoder.encode(content)
        # Leave room for last user message
        max_system_tokens = available - last_user_tokens - 100
        if max_system_tokens > 0:
            truncated = encoder.decode(tokens[:max_system_tokens])
            system_msg = {"role": "system", "content": truncated}
        else:
            system_msg = None

        result = []
        if system_msg:
            result.append(system_msg)
        if last_user_msg:
            result.append(last_user_msg)
        return result

    remaining = available - system_tokens

    # Keep most recent messages that fit
    result = []
    for msg in reversed(conversation):
        msg_tokens = count_message_tokens([msg])
        if msg_tokens <= remaining:
            result.insert(0, msg)
            remaining -= msg_tokens

    # Ensure at least last user message is included
    if last_user_msg and last_user_msg not in result:
        result.append(last_user_msg)

    if system_msg:
        result.insert(0, system_msg)

    return result


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
    model_config = ConfigDict(populate_by_name=True)

    messages: List[ChatMessage]
    model: Optional[str] = None  # falls back to DEFAULT_MODEL when unset
    use_evidence_tools: Optional[bool] = Field(
        default=True,
        validation_alias=AliasChoices("use_evidence_tools", "use_rag"),
    )
    system_prompt: Optional[str] = None


available_tools = {}


CHART_KEYWORDS = (
    "chart",
    "graph",
    "plot",
    "visualization",
    "visualize",
    "图",
    "图片",
    "圖",
    "圖表",
    "可视化",
    "視覺化",
    "長條",
    "柱状",
    "折線",
    "折线",
    "饼图",
    "圓餅",
)


def is_chart_request(text: str) -> bool:
    normalized = text.lower()
    return any(keyword in normalized for keyword in CHART_KEYWORDS)


def json_safe_rows(rows: list[dict[str, Any]], limit: int = 200) -> list[dict[str, Any]]:
    safe_rows = []
    for row in rows[:limit]:
        if not isinstance(row, dict):
            continue
        safe_row = {}
        for key, value in row.items():
            if hasattr(value, "isoformat"):
                safe_row[key] = value.isoformat()
            elif value is not None:
                safe_row[key] = value
        if safe_row:
            safe_rows.append(safe_row)
    return safe_rows


def build_chart_instruction(data_sources: list[dict[str, Any]]) -> str:
    chart_instruction = (
        "\n\n## CHART GENERATION RULES (MANDATORY)\n"
        "When the user asks you to create a chart, graph, or visualization from the available data, "
        "you MUST output a machine-readable CHART_SPEC block. This is NOT optional — the frontend parses this block to render an interactive chart.\n\n"
        "### Required format (output this EXACTLY — no variations allowed):\n"
        "CHART_SPEC:{\"chartType\":\"bar\",\"title\":\"My Title\",\"xAxis\":\"column_name\",\"yAxis\":\"column_name\",\"data\":[{\"col1\":\"a\",\"col2\":10},{\"col1\":\"b\",\"col2\":20}]}\n\n"
        "### Rules:\n"
        "- chartType must be one of: bar, line, pie, scatter, area\n"
        "- data must be an array of objects with column names as keys and actual values from the data source\n"
        "- yAxis can be a string (single series) or an array of strings (multiple series)\n"
        "- Place the CHART_SPEC block at the END of your response, after your text analysis\n"
        "- Only include CHART_SPEC when the user explicitly requests a chart or visualization\n\n"
        "### WRONG (NEVER do this):\n"
        "```\nLineChart\n  title: My Title\n  x-axis [a, b, c]\n  y-axis \"Revenue\"\n  data [1, 2, 3]\n```\n"
        "The above plaintext/ASCII format WILL NOT render. You MUST use the CHART_SPEC JSON format.\n"
    )

    for source in data_sources:
        rows = json_safe_rows(source.get("rows", []))
        if rows:
            chart_instruction += (
                f"\n\nFull data from {source.get('label', 'data')} "
                "(use this for CHART_SPEC data):\n"
                f"{json.dumps(rows, ensure_ascii=False)}"
            )

    return chart_instruction


def _create_stream(client, model: str, messages: list, temperature: float):
    """Create a streaming chat completion, with fallback on model unavailability."""
    try:
        return client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            temperature=temperature,
            max_tokens=1000,
            stream_options={"include_usage": True},
        )
    except Exception as e:
        error_str = str(e).lower()
        # Check if it's a model availability, rate limit, or capability error
        should_fallback = (
            "unavailable" in error_str
            or "not found" in error_str
            or "no endpoints found" in error_str
            or "does not exist" in error_str
            or "rate-limited" in error_str
            or "rate limit" in error_str
            or "429" in error_str
            or "developer instruction is not enabled" in error_str
            or "not enabled" in error_str
        )
        if should_fallback:
            # Per-model fallback if defined, otherwise fall back to DEFAULT_MODEL
            # (unless DEFAULT_MODEL is the model that just failed)
            fallback = MODEL_FALLBACKS.get(model)
            if not fallback and model != DEFAULT_MODEL:
                fallback = DEFAULT_MODEL
            if fallback:
                logger.warning(f"Model {model} error: {e}, falling back to {fallback}")
                return client.chat.completions.create(
                    model=fallback,
                    messages=messages,
                    stream=True,
                    temperature=temperature,
                    max_tokens=1000,
                    stream_options={"include_usage": True},
                )
        raise


def _extract_chart_specs(text: str) -> tuple[str, list[dict]]:
    """
    Scan accumulated LLM text for CHART_SPEC:{...} blocks.
    Returns (cleaned_text, list_of_chart_specs).
    """
    import re
    import uuid

    charts = []
    # Match CHART_SPEC: followed by a JSON object (greedy brace matching)
    pattern = r'CHART_SPEC:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})'

    for match in re.finditer(pattern, text):
        raw_json = match.group(1)
        try:
            spec = json.loads(raw_json)
            spec["id"] = str(uuid.uuid4())
            charts.append(spec)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse CHART_SPEC JSON: {raw_json[:200]}")

    # Remove all CHART_SPEC blocks from the text
    cleaned = re.sub(r'CHART_SPEC:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', text).strip()
    return cleaned, charts


def stream_text(
    client,
    messages: List[Dict[str, Any]],
    model: str,
    temperature: float = 0.7,
    protocol: str = "data",
    sources: Optional[List[Dict[str, Any]]] = None,
    excel_filenames: Optional[List[str]] = None,
    agent_steps: Optional[List[Dict[str, Any]]] = None,
):
    """
    Stream response from OpenRouter using AI SDK v5 SSE (Server-Sent Events) format

    Yields Server-Sent Events formatted chunks:
    - data: {"type":"message-start","messageId":"..."}
    - data: {"type":"text-delta","delta":"text"}
    - data: {"type":"chart-data",...}  (when LLM produces CHART_SPEC)
    - data: {"type":"finish-message","finishReason":"stop"}
    - data: [DONE]

    https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
    """
    import uuid

    stream = _create_stream(client, model, messages, temperature)

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
        accumulated_text = ""  # Buffer for chart spec detection

        try:
            if agent_steps:
                for step in agent_steps:
                    data = json.dumps({"type": "data-agent-step", "data": step})
                    yield f"data: {data}\n\n"

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
                        delta_content = choice.delta.content
                        accumulated_text += delta_content

                        data = json.dumps(
                            {
                                "type": "text-delta",
                                "id": text_id,
                                "delta": delta_content,
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

            # After streaming completes, check for CHART_SPEC in accumulated text
            if accumulated_text and "CHART_SPEC:" in accumulated_text:
                cleaned_text, chart_specs = _extract_chart_specs(accumulated_text)

                # Emit a text-delta that strips the CHART_SPEC from the visible text
                # by sending a replacement signal
                if chart_specs:
                    # Send chart-data parts using AI SDK DataUIPart format:
                    # { type: "data-*", id?: string, data: unknown }
                    for spec in chart_specs:
                        filename = excel_filenames[0] if excel_filenames else None
                        chart_payload = {
                            "chartType": spec.get("chartType", "bar"),
                            "title": spec.get("title", ""),
                            "data": spec.get("data", []),
                            "xAxis": spec.get("xAxis", ""),
                            "yAxis": spec.get("yAxis", ""),
                        }
                        if filename:
                            chart_payload["filename"] = filename
                        chart_part = {
                            "type": "data-chart",
                            "id": spec.get("id", str(uuid.uuid4())),
                            "data": chart_payload,
                        }
                        data = json.dumps(chart_part)
                        yield f"data: {data}\n\n"
                        logger.info(f"Emitted data-chart: {spec.get('chartType')} - {spec.get('title')}")

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
