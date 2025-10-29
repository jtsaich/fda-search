# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an FDA Regulatory Assistant using Retrieval-Augmented Generation (RAG). Currently in specification phase with a comprehensive technical document (`fda_rag_prototype.md`) that defines the entire implementation.

## Architecture

**Tech Stack:**
- Backend: FastAPI + Python with Pinecone vector DB
- Frontend: Next.js 14 + React + TypeScript + TailwindCSS
- Persistence: Supabase PostgreSQL for chat history
- Embeddings: HuggingFace (sentence-transformers/all-MiniLM-L6-v2)
- LLM: OpenRouter (Claude/GPT-4/Llama access)

## Common Commands

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py  # Runs on http://localhost:8000
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev  # Runs on http://localhost:3000
npm run build
npm run lint
```

### Running Full Stack
Open two terminals:
1. Backend: `cd backend && python main.py`
2. Frontend: `cd frontend && npm run dev`

## Project Structure

```
backend/
├── main.py              # FastAPI application entry
├── models.py            # Pydantic models
├── services/            # Core business logic
│   ├── document_service.py    # Document processing
│   ├── embedding_service.py   # HuggingFace embeddings
│   ├── rag_service.py         # RAG query logic
│   └── vector_service.py      # Pinecone operations
└── uploads/             # Temporary file storage

frontend/
├── app/                 # Next.js app router pages
│   ├── page.tsx         # Redirects to new chat
│   └── chat/
│       └── [id]/        # Dynamic chat pages
├── components/          # React components
│   ├── DocumentUpload.tsx
│   ├── ChatInterface.tsx
│   └── DocumentList.tsx
└── lib/                # Utilities and API client
    ├── supabase.ts      # Supabase client
    └── chat-store.ts    # Chat persistence
```

## Required Environment Variables

Create `.env` file in root:
```
HUGGINGFACE_API_KEY=
OPENROUTER_API_KEY=
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=gcp-starter
PINECONE_INDEX_NAME=fda-documents

# For chat persistence (frontend)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

See `CHAT_PERSISTENCE_SETUP.md` for Supabase setup instructions.

## Key Implementation Details

1. **Document Processing**: Handles PDF, TXT, DOCX files with chunking (512 tokens, 50 overlap)
2. **Vector Search**: Uses Pinecone with 768-dimensional embeddings, retrieves top 5 chunks
3. **API Endpoints**:
   - `POST /upload` - Document upload and processing
   - `POST /api/chat` - Chatting server stream event
   - `GET /documents` - List documents
   - `DELETE /documents/{id}` - Remove documents

4. **Frontend Routes**:
   - `/` - Redirects to new chat session
   - `/chat/[id]` - Chat interface with persistence
   - Document upload and management via tabs

## Architecture Decision: Frontend + Backend Approach

**Why We Use Both Next.js Frontend + Python Backend:**

**Next.js Frontend (Port 3000):**
- User interface and chat components
- Vercel AI SDK integration for streaming chat
- Client-side interactions and routing

**FastAPI Backend (Port 8000):**
- Document processing (PDF, DOCX parsing)
- HuggingFace embeddings generation
- Pinecone vector database operations
- Heavy computational tasks without serverless timeout limits
- Clean separation of ML/AI logic from UI concerns

**Alternative Considered:** Next.js-only serverless approach, but rejected due to:
- API route execution time limits (30s on Vercel)
- Less suitable for heavy document processing
- Python ecosystem advantages for ML/AI tasks
- Better scalability for production RAG systems

## Current Status

**Chat Persistence Implemented** - Full chat history persistence using Supabase:
1. ✅ Document upload and processing service implemented
2. ✅ Embedding and vector storage with Pinecone
3. ✅ RAG query logic with source tracking
4. ✅ Frontend chat interface with streaming responses
5. ✅ Chat persistence with Supabase PostgreSQL
6. ✅ Message history loads on page refresh
7. ✅ RAG sources preserved in chat history

**Next Steps:**
- Add chat list sidebar
- Implement user authentication
- Optimize with single-message requests