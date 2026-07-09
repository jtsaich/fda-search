from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from pathlib import Path
from dotenv import load_dotenv
import logging
import base64

from services.document_service import DocumentService
from services.vector_service import VectorService
from services.embedding_service import EmbeddingService
from services.llm_service import LLMService
from services.excel_service import ExcelService
from services.starlims_agent_service import RAG_TOOL, StarlimsAgentService
from services.chat_protocol import (
    ChatRequest,
    DEFAULT_MODEL,
    build_chart_instruction,
    stream_report_generation,
    stream_text,
    count_message_tokens,
    truncate_messages_to_fit,
    get_model_limit,
    is_chart_request,
    is_docx_report_request,
)
from routes.documents import router as documents_router
from routes.health import router as health_router
from routes.exports import router as exports_router

# Configure logging to use stdout instead of stderr
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

load_dotenv()

# Initialize services
document_service = DocumentService()
vector_service = VectorService()
embedding_service = EmbeddingService()
llm_service = LLMService()
excel_service = ExcelService()


async def knowledge_base_search_tool(query_text: str) -> dict:
    logger.info(f"Agent knowledge-base query: {query_text}")
    query_embedding = await embedding_service.generate_embedding(query_text)
    similar_chunks = await vector_service.search_similar(query_embedding, top_k=10)
    similar_chunks = sorted(
        similar_chunks,
        key=lambda x: x.get("score", 0),
        reverse=True,
    )

    logger.info(f"Found {len(similar_chunks)} similar chunks (sorted by score)")
    rows = []
    sources = []
    for chunk in similar_chunks[:3]:
        metadata = chunk.get("metadata", {})
        score = round(chunk.get("score", 0), 4)
        rows.append(
            {
                "id": chunk.get("id"),
                "filename": metadata.get("filename", "Unknown"),
                "chunk_index": metadata.get("chunk_index", 0),
                "score": score,
                "text": metadata.get("text", ""),
            }
        )
        sources.append(
            {
                "type": "document",
                "id": chunk.get("id"),
                "filename": metadata.get("filename", "Unknown"),
                "chunk_index": metadata.get("chunk_index", 0),
                "score": score,
                "text": metadata.get("text", "")[:500],
            }
        )

    return {"rows": rows, "sources": sources}


starlims_agent_service = StarlimsAgentService(
    rag_search=knowledge_base_search_tool,
    llm_client=llm_service.client,
)

app = FastAPI(title="FDA RAG API", version="1.0.0")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Log detailed validation errors to help debug 422 errors"""
    logger.error(f"Validation error for {request.url}")
    body = await request.body()
    logger.error(f"Request body: {body.decode() if body else 'empty'}")
    logger.error(f"Validation errors: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://frontend-git-main-jtsaichs-projects.vercel.app",
        "https://frontend-psi-plum-51.vercel.app",
    ],
    allow_origin_regex=r"https://(frontend|fda-research|fda-search)(-.*)?\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-vercel-ai-data-stream", "Content-Disposition"],
)


class QueryRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5
    model: Optional[str] = None  # falls back to DEFAULT_MODEL when unset


class QueryResponse(BaseModel):
    answer: str
    sources: List[dict]
    confidence: float


class DirectQueryResponse(BaseModel):
    answer: str


# Include routers
app.include_router(documents_router)
app.include_router(health_router)
app.include_router(exports_router)


@app.get("/")
async def root():
    return {"message": "FDA RAG API is running"}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(
        (".pdf", ".txt", ".docx", ".csv", ".xlsx")
    ):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    file_path = None
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = Path("uploads")
        uploads_dir.mkdir(exist_ok=True)

        # Save uploaded file
        file_path = uploads_dir / file.filename
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Process document
        result = await document_service.process_document(str(file_path), file.filename)

        # Generate embeddings for chunks
        chunk_texts = [chunk["text"] for chunk in result["chunks"]]
        embeddings = await embedding_service.generate_embeddings(chunk_texts)

        # Prepare vectors for Pinecone
        vectors = []
        for i, (chunk, embedding) in enumerate(zip(result["chunks"], embeddings)):
            vectors.append(
                {
                    "id": f"{result['document_id']}_chunk_{i}",
                    "values": embedding,
                    "metadata": {
                        "document_id": result["document_id"],
                        "filename": result["filename"],
                        "chunk_index": i,
                        "text": chunk["text"],
                        "token_count": chunk["token_count"],
                        "upload_date": result["upload_date"],
                    },
                }
            )

        # Store vectors in Pinecone
        upsert_result = await vector_service.upsert_vectors(vectors)

        # Clean up temporary file
        os.remove(file_path)

        return {
            "message": f"File {file.filename} processed and indexed successfully",
            "document_id": result["document_id"],
            "chunks_created": result["chunk_count"],
            "upload_date": result["upload_date"],
            "vectors_stored": upsert_result.get("vectors_upserted", 0),
        }
    except Exception as e:
        # Clean up file if it exists
        if file_path and file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/api/chat")
async def handle_chat_data(request: ChatRequest, protocol: str = Query("data")):
    """
    Streaming chat endpoint compatible with Vercel AI SDK
    Supports conversation history and optional evidence tools.
    """
    logger.info(
        f"Received streaming chat request with {len(request.messages)} messages"
    )
    logger.info(f"Evidence tools enabled: {request.use_evidence_tools}")

    try:
        # Convert AI SDK messages to OpenRouter format
        openai_messages = []

        # Add system prompt if provided, or create one if evidence tools are enabled.
        if request.system_prompt or request.use_evidence_tools:
            system_prompt = request.system_prompt or ""

            # Append tool-evidence instruction if enabled and not already mentioned.
            if request.use_evidence_tools:
                if (
                    "knowledge base" not in system_prompt.lower()
                    and "context" not in system_prompt.lower()
                ):
                    evidence_instruction = "You are given access to evidence tools. Provide accurate, concise responses based on the retrieved context."
                    if system_prompt:
                        system_prompt += f"\n\n{evidence_instruction}"
                    else:
                        system_prompt = evidence_instruction

            if system_prompt:
                logger.info(f"System prompt: {system_prompt}")
                openai_messages.append({"role": "system", "content": system_prompt})

        # Process conversation history
        for msg in request.messages:
            content_parts = []

            # Handle file attachments from parts (AI SDK sends files in parts)
            if msg.parts:
                for part in msg.parts:
                    part_type = part.get("type")

                    # Handle text parts
                    if part_type == "text":
                        text = part.get("text", "")
                        if text:
                            content_parts.append({"type": "text", "text": text})

                    # Handle file parts
                    elif part_type == "file":
                        media_type = part.get("mediaType", "")
                        url = part.get("url", "")
                        filename = part.get("filename", "")

                        if not url:
                            continue

                        # Handle images using OpenRouter's image_url format
                        if media_type.startswith("image/"):
                            content_parts.append(
                                {
                                    "type": "image_url",
                                    "image_url": {"url": url},
                                }
                            )

                        # Handle PDFs using OpenRouter's file format
                        elif media_type == "application/pdf":
                            content_parts.append(
                                {
                                    "type": "file",
                                    "file": {
                                        "filename": filename,
                                        "file_data": url,  # base64 data URL
                                    },
                                }
                            )

                        # Handle Text, CSV, XLSX, DOCX files by extracting text
                        elif (
                            media_type.startswith("text/")
                            or media_type
                            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            or media_type
                            == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            or filename.endswith((".txt", ".csv", ".xlsx", ".docx"))
                        ):
                            try:
                                # Data URL format: data:[<mediatype>][;base64],<data>
                                if "," in url:
                                    header, data = url.split(",", 1)
                                    file_bytes = base64.b64decode(data)

                                    # For Excel/CSV files, also extract structured data for charts
                                    is_spreadsheet = (
                                        media_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                        or media_type == "text/csv"
                                        or filename.endswith((".xlsx", ".csv"))
                                    )
                                    if is_spreadsheet:
                                        try:
                                            structured = excel_service.extract_structured_data(file_bytes, filename)
                                            summary = excel_service.generate_data_summary(structured)
                                            content_parts.append(
                                                {
                                                    "type": "text",
                                                    "text": f"Structured data from {filename}:\n{summary}",
                                                }
                                            )
                                            # Store for chart prompt injection
                                            if not hasattr(request, '_excel_data'):
                                                request._excel_data = []
                                            request._excel_data.append(structured)
                                        except Exception as e:
                                            logger.warning(f"Structured extraction failed for {filename}, falling back to text: {e}")

                                    extracted_text = (
                                        await document_service.extract_text_from_bytes(
                                            file_bytes, filename
                                        )
                                    )

                                    if extracted_text:
                                        content_parts.append(
                                            {
                                                "type": "text",
                                                "text": f"Content of {filename}:\n{extracted_text}",
                                            }
                                        )
                            except Exception as e:
                                logger.error(f"Error processing file {filename}: {e}")

            # If no parts, extract text from content field
            if not content_parts:
                text_content = msg.get_text_content()
                if text_content:
                    content_parts.append({"type": "text", "text": text_content})

            # Build the message
            openai_messages.append(
                {
                    "role": msg.role,
                    "content": (
                        content_parts
                        if len(content_parts) > 1
                        else (content_parts[0].get("text", "") if content_parts else "")
                    ),
                }
            )

        # Identify the latest user request once; evidence tools, charts, and report
        # export tools all use the same request boundary.
        last_user_message = next(
            (msg for msg in reversed(request.messages) if msg.role == "user"), None
        )
        latest_query_text = (
            last_user_message.get_text_content() if last_user_message else ""
        )
        wants_docx_report = is_docx_report_request(latest_query_text)

        # If evidence tools are enabled, let the agent choose tools for the last user message.
        evidence_sources = []
        agent_steps = None
        agent_chart_sources = []
        if request.use_evidence_tools and latest_query_text and not wants_docx_report:
            try:
                agent_run = await starlims_agent_service.run(latest_query_text)
                logger.info(
                    "Search agent selected intent %s with tools %s",
                    agent_run.contract.intent,
                    agent_run.contract.tools,
                )
                agent_steps = agent_run.steps
                evidence_sources.extend(agent_run.sources)
                agent_chart_sources = [
                    {
                        "label": f"agent tool '{result.get('tool')}'",
                        "rows": result.get("rows", []),
                    }
                    for result in agent_run.tool_results
                    if result.get("tool") != RAG_TOOL and result.get("rows")
                ]
                context_addition = f"\n\n{agent_run.prompt_context}"
                if openai_messages and openai_messages[0]["role"] == "system":
                    openai_messages[0]["content"] += context_addition
                else:
                    openai_messages.insert(
                        0,
                        {
                            "role": "system",
                            "content": agent_run.prompt_context,
                        },
                    )
            except Exception as e:
                logger.warning(f"Search agent failed: {str(e)}")

        # Inject chart generation instructions when chartable data is available.
        excel_data_list = getattr(request, '_excel_data', None)
        chart_sources = []
        if excel_data_list:
            for excel_data in excel_data_list:
                for sheet in excel_data.get("sheets", []):
                    chart_sources.append(
                        {
                            "label": f"sheet '{sheet['name']}' in {excel_data['filename']}",
                            "rows": sheet.get("data", []),
                        }
                    )

        if agent_chart_sources and is_chart_request(latest_query_text):
            chart_sources.extend(agent_chart_sources)

        if chart_sources:
            chart_instruction = build_chart_instruction(chart_sources)
            if openai_messages and openai_messages[0]["role"] == "system":
                openai_messages[0]["content"] += chart_instruction
            else:
                openai_messages.insert(
                    0,
                    {"role": "system", "content": chart_instruction},
                )

        # Token budget check - truncate if needed (silent truncation)
        model = request.model or DEFAULT_MODEL
        max_context = get_model_limit(model)
        current_tokens = count_message_tokens(openai_messages)
        logger.info(f"Token count before truncation: {current_tokens}, limit: {max_context}")

        if current_tokens > max_context - 1000:
            logger.warning(
                f"Token count {current_tokens} exceeds limit {max_context}, truncating..."
            )
            openai_messages = truncate_messages_to_fit(openai_messages, max_context)
            final_tokens = count_message_tokens(openai_messages)
            logger.info(f"Truncated to {final_tokens} tokens, {len(openai_messages)} messages")

            # Log message roles for debugging
            roles = [msg.get("role") for msg in openai_messages]
            logger.info(f"Message roles after truncation: {roles}")

        # Collect Excel filenames for chart-data metadata
        excel_filenames = [d["filename"] for d in excel_data_list] if excel_data_list else None

        if wants_docx_report:
            response = StreamingResponse(
                stream_report_generation(
                    client=llm_service.client,
                    messages=openai_messages,
                    model=model,
                    sources=evidence_sources if evidence_sources else None,
                    agent_steps=agent_steps,
                ),
                media_type="text/event-stream",
            )
        else:
            response = StreamingResponse(
                stream_text(
                    llm_service.client,
                    openai_messages,
                    request.model or DEFAULT_MODEL,
                    0.7 if not request.use_evidence_tools else 0.1,
                    sources=evidence_sources if evidence_sources else None,
                    excel_filenames=excel_filenames,
                    agent_steps=agent_steps,
                ),
                media_type="text/event-stream",
            )
        response.headers["x-vercel-ai-data-stream"] = "v1"

        # Required headers for SSE streaming
        response.headers["Cache-Control"] = "no-cache"
        response.headers["Connection"] = "keep-alive"
        response.headers["X-Accel-Buffering"] = (
            "no"  # Disable buffering in nginx/proxies
        )

        return response

    except Exception as e:
        logger.error(f"Error in streaming chat: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
