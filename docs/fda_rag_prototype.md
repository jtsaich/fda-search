# FDA RAG Prototype - Full-Stack Implementation

## Architecture Overview

```
Frontend (Next.js + React)     Backend (FastAPI + Python)     External Services
├── Chat Interface             ├── Document Upload API         ├── HuggingFace (Embeddings)
├── Document Upload UI         ├── RAG Query API               ├── OpenRouter (LLM)
├── Document Management        ├── Vector Search               └── Pinecone/Weaviate (Vector DB)
└── Settings Panel             └── Document Processing
```

## Stack Decisions

- **Frontend**: Next.js 14 + React + TailwindCSS + shadcn/ui
- **Backend**: FastAPI + Python
- **Vector Database**: Pinecone (hosted, no setup needed)
- **Embeddings**: HuggingFace Inference API
- **LLM**: OpenRouter (access to Claude, GPT-4, Llama, etc.)
- **File Storage**: Local filesystem (can upgrade to S3 later)

---

## Phase 1: Backend Setup (FastAPI)

### 1.1 Project Structure

```bash
fda-rag-prototype/
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── services/
│   │   ├── document_service.py
│   │   ├── embedding_service.py
│   │   ├── rag_service.py
│   │   └── vector_service.py
│   ├── utils/
│   │   └── file_utils.py
│   ├── uploads/
│   └── requirements.txt
├── frontend/
│   ├── (Next.js app)
└── .env
```

### 1.2 Backend Dependencies

```bash
# backend/requirements.txt
fastapi==0.104.1
uvicorn==0.24.0
python-multipart==0.0.6
python-dotenv==1.0.0
requests==2.31.0
PyPDF2==3.0.1
python-docx==1.1.0
pinecone-client==2.2.4
openai==1.3.7
pydantic==2.5.0
```

### 1.3 Environment Configuration

```bash
# .env
HUGGINGFACE_API_KEY=your_hf_token
OPENROUTER_API_KEY=your_openrouter_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_ENVIRONMENT=gcp-starter
PINECONE_INDEX_NAME=fda-documents
```

### 1.4 Core Backend Implementation

```python
# backend/main.py
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

from services.document_service import DocumentService
from services.rag_service import RAGService

load_dotenv()

app = FastAPI(title="FDA RAG API", version="1.0.0")

# CORS middleware for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
document_service = DocumentService()
rag_service = RAGService()

class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    sources: List[dict]
    conversation_id: str

@app.post("/upload-documents")
async def upload_documents(files: List[UploadFile] = File(...)):
    """Upload and process FDA documents"""
    try:
        results = []
        for file in files:
            # Save file
            file_path = await document_service.save_file(file)

            # Process and create embeddings
            chunks = await document_service.process_document(file_path)
            vector_ids = await rag_service.create_embeddings(chunks, file.filename)

            results.append({
                "filename": file.filename,
                "chunks_created": len(chunks),
                "vectors_stored": len(vector_ids)
            })

        return {"success": True, "results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat(message: ChatMessage):
    """Chat endpoint with RAG"""
    try:
        response = await rag_service.query(
            question=message.message,
            conversation_id=message.conversation_id
        )

        return ChatResponse(
            response=response["answer"],
            sources=response["sources"],
            conversation_id=response["conversation_id"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents")
async def list_documents():
    """List uploaded documents"""
    try:
        documents = await document_service.list_documents()
        return {"documents": documents}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Delete a document and its embeddings"""
    try:
        await document_service.delete_document(filename)
        await rag_service.delete_document_embeddings(filename)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 1.5 Document Service

```python
# backend/services/document_service.py
import os
import uuid
from pathlib import Path
from typing import List, Dict
import PyPDF2
from docx import Document as DocxDocument
from fastapi import UploadFile
import re

class DocumentService:
    def __init__(self):
        self.upload_dir = Path("uploads")
        self.upload_dir.mkdir(exist_ok=True)
        self.chunk_size = 1000
        self.chunk_overlap = 200

    async def save_file(self, file: UploadFile) -> str:
        """Save uploaded file to disk"""
        file_id = str(uuid.uuid4())
        file_extension = Path(file.filename).suffix
        file_path = self.upload_dir / f"{file_id}{file_extension}"

        content = await file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        return str(file_path)

    async def process_document(self, file_path: str) -> List[Dict]:
        """Process document into chunks"""
        file_path = Path(file_path)

        # Extract text based on file type
        if file_path.suffix.lower() == '.pdf':
            text = self._extract_pdf_text(file_path)
        elif file_path.suffix.lower() == '.txt':
            text = self._extract_text_file(file_path)
        elif file_path.suffix.lower() in ['.docx', '.doc']:
            text = self._extract_docx_text(file_path)
        else:
            raise ValueError(f"Unsupported file type: {file_path.suffix}")

        # Clean and chunk text
        cleaned_text = self._clean_text(text)
        chunks = self._create_chunks(cleaned_text, file_path.stem)

        return chunks

    def _extract_pdf_text(self, file_path: Path) -> str:
        """Extract text from PDF"""
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text

    def _extract_text_file(self, file_path: Path) -> str:
        """Extract text from text file"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()

    def _extract_docx_text(self, file_path: Path) -> str:
        """Extract text from DOCX file"""
        doc = DocxDocument(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text

    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove page numbers
        text = re.sub(r'Page \d+ of \d+', '', text)
        return text.strip()

    def _create_chunks(self, text: str, document_name: str) -> List[Dict]:
        """Create overlapping chunks"""
        words = text.split()
        chunks = []

        words_per_chunk = self.chunk_size // 6  # ~6 chars per word
        overlap_words = self.chunk_overlap // 6

        for i in range(0, len(words), words_per_chunk - overlap_words):
            chunk_words = words[i:i + words_per_chunk]
            chunk_text = ' '.join(chunk_words)

            if chunk_text.strip():
                chunks.append({
                    "text": chunk_text,
                    "document_name": document_name,
                    "chunk_id": f"{document_name}_{i}",
                    "metadata": {
                        "source": document_name,
                        "chunk_index": i // (words_per_chunk - overlap_words)
                    }
                })

        return chunks

    async def list_documents(self) -> List[Dict]:
        """List all uploaded documents"""
        documents = []
        for file_path in self.upload_dir.iterdir():
            if file_path.is_file():
                documents.append({
                    "filename": file_path.stem,
                    "original_name": file_path.name,
                    "size": file_path.stat().st_size,
                    "type": file_path.suffix
                })
        return documents

    async def delete_document(self, filename: str):
        """Delete a document file"""
        for file_path in self.upload_dir.glob(f"{filename}*"):
            file_path.unlink()
```

### 1.6 RAG Service with External APIs

```python
# backend/services/rag_service.py
import os
import uuid
import requests
import pinecone
from typing import List, Dict, Optional
import openai

class RAGService:
    def __init__(self):
        # Initialize Pinecone
        pinecone.init(
            api_key=os.getenv("PINECONE_API_KEY"),
            environment=os.getenv("PINECONE_ENVIRONMENT")
        )
        self.index_name = os.getenv("PINECONE_INDEX_NAME")

        # Create index if it doesn't exist
        if self.index_name not in pinecone.list_indexes():
            pinecone.create_index(
                name=self.index_name,
                dimension=768,  # all-mpnet-base-v2 dimension
                metric="cosine"
            )

        self.index = pinecone.Index(self.index_name)

        # HuggingFace API setup
        self.hf_api_key = os.getenv("HUGGINGFACE_API_KEY")
        self.hf_model = "sentence-transformers/all-MiniLM-L6-v2"

        # OpenRouter setup
        openai.api_key = os.getenv("OPENROUTER_API_KEY")
        openai.api_base = "https://openrouter.ai/api/v1"

        self.conversations = {}  # Simple in-memory storage

    async def create_embeddings(self, chunks: List[Dict], document_name: str) -> List[str]:
        """Create embeddings and store in Pinecone"""
        vectors_to_upsert = []

        for chunk in chunks:
            # Get embedding from HuggingFace
            embedding = await self._get_embedding(chunk["text"])

            vector_id = f"{document_name}_{chunk['chunk_id']}"

            vectors_to_upsert.append({
                "id": vector_id,
                "values": embedding,
                "metadata": {
                    "text": chunk["text"],
                    "document_name": document_name,
                    "chunk_id": chunk["chunk_id"],
                    **chunk["metadata"]
                }
            })

        # Upsert to Pinecone in batches
        batch_size = 100
        for i in range(0, len(vectors_to_upsert), batch_size):
            batch = vectors_to_upsert[i:i + batch_size]
            self.index.upsert(vectors=batch)

        return [v["id"] for v in vectors_to_upsert]

    async def _get_embedding(self, text: str) -> List[float]:
        """Get embedding from HuggingFace API"""
        headers = {
            "Authorization": f"Bearer {self.hf_api_key}",
            "Content-Type": "application/json"
        }

        response = requests.post(
            f"https://api-inference.huggingface.co/pipeline/feature-extraction/{self.hf_model}",
            headers=headers,
            json={"inputs": text}
        )

        if response.status_code == 200:
            return response.json()[0]  # Return the embedding vector
        else:
            raise Exception(f"HuggingFace API error: {response.text}")

    async def query(self, question: str, conversation_id: Optional[str] = None, top_k: int = 5) -> Dict:
        """Query the RAG system"""

        # Get conversation history
        if not conversation_id:
            conversation_id = str(uuid.uuid4())

        conversation = self.conversations.get(conversation_id, [])

        # Get question embedding
        question_embedding = await self._get_embedding(question)

        # Search Pinecone for relevant chunks
        search_results = self.index.query(
            vector=question_embedding,
            top_k=top_k,
            include_metadata=True
        )

        # Extract context and sources
        context_chunks = []
        sources = []

        for match in search_results["matches"]:
            context_chunks.append(match["metadata"]["text"])
            sources.append({
                "document_name": match["metadata"]["document_name"],
                "score": float(match["score"]),
                "text_preview": match["metadata"]["text"][:200] + "..."
            })

        # Combine context
        context = "\n\n".join(context_chunks)

        # Generate answer using OpenRouter
        answer = await self._generate_answer(question, context, conversation)

        # Update conversation history
        conversation.append({"question": question, "answer": answer})
        self.conversations[conversation_id] = conversation[-10:]  # Keep last 10 exchanges

        return {
            "answer": answer,
            "sources": sources,
            "conversation_id": conversation_id
        }

    async def _generate_answer(self, question: str, context: str, conversation: List[Dict]) -> str:
        """Generate answer using OpenRouter"""

        # Build conversation context
        conversation_context = ""
        for exchange in conversation[-3:]:  # Last 3 exchanges
            conversation_context += f"Q: {exchange['question']}\nA: {exchange['answer']}\n\n"

        system_prompt = """You are an FDA regulatory expert assistant. Use the provided FDA document context to answer questions accurately and helpfully.

IMPORTANT:
- Only use information from the provided context
- If the context doesn't contain enough information, say so
- Always cite your sources when possible
- Add appropriate disclaimers for regulatory advice
- Be specific and detailed when the context supports it"""

        user_prompt = f"""Context from FDA documents:
{context}

Previous conversation:
{conversation_context}

Current question: {question}

Please provide a comprehensive answer based on the FDA document context above."""

        try:
            response = openai.ChatCompletion.create(
                model="anthropic/claude-3-sonnet",  # or "openai/gpt-4-turbo"
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.1
            )

            answer = response.choices[0].message.content

            # Add compliance disclaimer
            disclaimer = "\n\n⚠️ This information is for educational purposes only. Always consult official FDA resources and qualified regulatory professionals for compliance matters."

            return answer + disclaimer

        except Exception as e:
            return f"I apologize, but I encountered an error generating a response: {str(e)}"

    async def delete_document_embeddings(self, document_name: str):
        """Delete all embeddings for a document"""
        # This is a simplified approach - in production you'd want better indexing
        self.index.delete(filter={"document_name": document_name})
```

---

## Phase 2: Frontend Setup (Next.js + React)

### 2.1 Initialize Next.js Project

```bash
npx create-next-app@latest fda-rag-frontend --typescript --tailwind --eslint --app
cd fda-rag-frontend

# Install additional dependencies
npm install @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-button
npm install lucide-react
npm install axios
npm install react-dropzone
npm install @types/file-saver file-saver
```

### 2.2 Project Structure

```
frontend/
├── app/
│   ├── page.tsx (main chat interface)
│   ├── upload/
│   │   └── page.tsx (document upload)
│   └── layout.tsx
├── components/
│   ├── ChatInterface.tsx
│   ├── DocumentUpload.tsx
│   ├── MessageBubble.tsx
│   └── SourceCard.tsx
├── lib/
│   └── api.ts
└── types/
    └── index.ts
```

### 2.3 API Client

```typescript
// lib/api.ts
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
});

export interface ChatMessage {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  response: string;
  sources: Array<{
    document_name: string;
    score: number;
    text_preview: string;
  }>;
  conversation_id: string;
}

export interface DocumentInfo {
  filename: string;
  original_name: string;
  size: number;
  type: string;
}

export const chatAPI = {
  sendMessage: async (message: ChatMessage): Promise<ChatResponse> => {
    const response = await api.post('/chat', message);
    return response.data;
  },

  uploadDocuments: async (files: File[]): Promise<any> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await api.post('/upload-documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getDocuments: async (): Promise<{documents: DocumentInfo[]}> => {
    const response = await api.get('/documents');
    return response.data;
  },

  deleteDocument: async (filename: string): Promise<void> => {
    await api.delete(`/documents/${filename}`);
  },
};
```

### 2.4 Main Layout

```typescript
// app/layout.tsx
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <nav className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900">
                    🏛️ FDA RAG Assistant
                  </h1>
                </div>
                <div className="flex items-center space-x-4">
                  <Link
                    href="/"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Chat
                  </Link>
                  <Link
                    href="/upload"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Upload Documents
                  </Link>
                </div>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
```

### 2.5 Chat Interface

```typescript
// components/ChatInterface.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { chatAPI, ChatResponse } from '@/lib/api'
import MessageBubble from './MessageBubble'
import SourceCard from './SourceCard'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  sources?: ChatResponse['sources']
  timestamp: Date
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await chatAPI.sendMessage({
        message: input.trim(),
        conversation_id: conversationId
      })

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.response,
        sources: response.sources,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      setConversationId(response.conversation_id)

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-lg shadow-lg">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <h3 className="text-lg font-medium mb-2">Welcome to FDA RAG Assistant</h3>
            <p className="text-sm">Ask me questions about FDA regulations and I'll search through your uploaded documents to provide answers.</p>
            <div className="mt-4 text-xs">
              <p className="font-medium">Example questions:</p>
              <ul className="mt-2 space-y-1">
                <li>"What are the phases of clinical trials?"</li>
                <li>"What documentation is required for 510(k) submission?"</li>
                <li>"How long does FDA drug approval take?"</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            <MessageBubble message={message} />
            {message.sources && message.sources.length > 0 && (
              <div className="ml-12 space-y-2">
                <p className="text-xs font-medium text-gray-600">Sources:</p>
                {message.sources.map((source, index) => (
                  <SourceCard key={index} source={source} />
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center justify-start">
            <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about FDA regulations..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 2.6 Document Upload Component

```typescript
// components/DocumentUpload.tsx
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, Trash2, CheckCircle, AlertCircle } from 'lucide-react'
import { chatAPI, DocumentInfo } from '@/lib/api'

export default function DocumentUpload() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{type: 'success' | 'error', message: string} | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true)
    setUploadStatus(null)

    try {
      const result = await chatAPI.uploadDocuments(acceptedFiles)

      setUploadStatus({
        type: 'success',
        message: `Successfully uploaded ${acceptedFiles.length} document(s)`
      })

      // Refresh document list
      loadDocuments()

    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: 'Failed to upload documents. Please try again.'
      })
    } finally {
      setIsUploading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  })

  const loadDocuments = async () => {
    try {
      const response = await chatAPI.getDocuments()
      setDocuments(response.documents)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const deleteDocument = async (filename: string) => {
    try {
      await chatAPI.deleteDocument(filename)
      setDocuments(prev => prev.filter(doc => doc.filename !== filename))
      setUploadStatus({
        type: 'success',
        message: 'Document deleted successfully'
      })
    } catch (error) {
      setUploadStatus({
        type: 'error',
        message: 'Failed to delete document'
      })
    }
  }

  // Load documents on component mount
  useState(() => {
    loadDocuments()
  })

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Upload FDA Documents</h2>

        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} disabled={isUploading} />

          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />

          {isDragActive ? (
            <p className="text-blue-600">Drop the files here...</p>
          ) : (
            <div>
              <p className="text-gray-600 mb-2">
                Drag & drop FDA documents here, or click to select files
              </p>
              <p className="text-sm text-gray-500">
                Supports PDF, TXT, and DOCX files (max 10MB each)
              </p>
            </div>
          )}

          {isUploading && (
            <div className="mt-4">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-blue-600">Processing documents...</span>
              </div>
            </div>
          )}
        </div>

        {/* Upload Status */}
        {uploadStatus && (
          <div className={`
            mt-4 p-3 rounded-lg flex items-center space-x-2
            ${uploadStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}
          `}>
            {uploadStatus.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="text-sm">{uploadStatus.message}</span>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Uploaded Documents</h3>

        {documents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No documents uploaded yet. Upload some FDA documents to get started.
          </p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.filename} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <File className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{doc.original_name}</p>
                    <p className="text-sm text-gray-500">
                      {(doc.size / 1024 / 1024).toFixed(2)} MB • {doc.type.toUpperCase()}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => deleteDocument(doc.filename)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### 2.7 Message and Source Components

```typescript
// components/MessageBubble.tsx
interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  return (
    <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`
        max-w-3xl px-4 py-2 rounded-lg
        ${message.type === 'user'
          ? 'bg-blue-500 text-white'
          : 'bg-gray-100 text-gray-900'
        }
      `}>
        <div className="whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs mt-1 ${
          message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
        }`}>
          {message.timestamp.toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

// components/SourceCard.tsx
interface Source {
  document_name: string
  score: number
  text_preview: string
}

interface SourceCardProps {
  source: Source
}

export default function SourceCard({ source }: SourceCardProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900">{source.document_name}</span>
        <span className="text-xs text-gray-500">
          {(source.score * 100).toFixed(1)}% relevance
        </span>
      </div>
      <p className="text-gray-600 text-xs leading-relaxed">
        {source.text_preview}
      </p>
    </div>
  )
}
```

### 2.8 Main Pages

```typescript
// app/page.tsx
import ChatInterface from '@/components/ChatInterface'

export default function HomePage() {
  return (
    <div className="px-4">
      <ChatInterface />
    </div>
  )
}

// app/upload/page.tsx
import DocumentUpload from '@/components/DocumentUpload'

export default function UploadPage() {
  return (
    <div className="px-4">
      <DocumentUpload />
    </div>
  )
}
```

---

## Phase 3: Quick Setup Instructions

### 3.1 Environment Setup

```bash
# 1. Clone/create project structure
mkdir fda-rag-prototype
cd fda-rag-prototype
mkdir backend frontend

# 2. Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Frontend setup
cd ../frontend
npx create-next-app@latest . --typescript --tailwind --eslint --app
npm install @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-button lucide-react axios react-dropzone

# 4. Create .env file with your API keys
```

### 3.2 API Keys Setup

Get these API keys (most have free tiers):

1. **HuggingFace**: https://huggingface.co/settings/tokens
2. **OpenRouter**: https://openrouter.ai/keys
3. **Pinecone**: https://app.pinecone.io/ (free tier: 1M vectors)

### 3.3 Quick Start Commands

```bash
# Terminal 1 - Backend
cd backend
python main.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 3.4 Usage Flow

1. **Upload Documents**: Go to `/upload` and drag-drop FDA PDFs
2. **Chat**: Go to `/` and ask questions about your documents
3. **Sources**: Each answer shows which documents were used

## Next Steps & Enhancements

### Immediate Improvements
- Add user authentication
- Implement conversation persistence
- Add document preview functionality
- Improve error handling and loading states

### Production Considerations
- Replace in-memory conversation storage with Redis
- Add rate limiting and input validation
- Implement proper logging and monitoring
- Use environment-specific API keys

This prototype gives you a fully functional RAG system in about 2-3 hours of setup time!