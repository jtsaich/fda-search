# FDA Search - RAG-powered Regulatory Assistant

A monorepo application that provides an intelligent search interface for FDA regulatory documents using Retrieval-Augmented Generation (RAG).

## Architecture

- **Frontend**: Next.js 14 with TypeScript, TailwindCSS, and shadcn/ui components
- **Backend**: FastAPI with Python, document processing, and vector search
- **Vector Database**: Pinecone for semantic search
- **Embeddings**: HuggingFace (sentence-transformers/all-MiniLM-L6-v2)
- **LLM**: OpenRouter API for multiple model access

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- API keys for HuggingFace, OpenRouter, and Pinecone

### Setup

1. Clone the repository and install dependencies:
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..

# Install frontend dependencies
cd frontend
npm install
cd ..
```

2. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Run the development servers:
```bash
# Run both frontend and backend
npm run dev

# Or run separately:
# Terminal 1 - Backend
cd backend && python main.py

# Terminal 2 - Frontend
cd frontend && npm run dev
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Features

- **Document Upload**: Support for PDF, TXT, and DOCX files
- **Intelligent Search**: Semantic search through uploaded FDA documents
- **RAG-powered Answers**: AI-generated responses with source citations
- **Document Management**: View and delete uploaded documents
- **Real-time Processing**: Automatic text extraction and chunking

## Project Structure

```
fda-search/
├── backend/           # FastAPI backend
│   ├── main.py       # API entry point
│   ├── models.py     # Data models
│   ├── services/     # Business logic
│   └── uploads/      # Document storage
├── frontend/         # Next.js frontend
│   ├── app/         # App router pages
│   ├── components/  # React components
│   └── lib/         # Utilities
└── package.json     # Monorepo scripts
```

## Development

### Available Scripts

```bash
# Root level
npm run dev          # Run full stack
npm run install:all  # Install all dependencies

# Frontend
npm run dev:frontend    # Run frontend only
npm run build:frontend  # Build frontend
npm run lint:frontend   # Lint frontend

# Backend
npm run dev:backend    # Run backend only
```

## License

MIT