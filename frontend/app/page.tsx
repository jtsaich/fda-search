'use client';

import { useState } from 'react';
import { ChatInterface } from '@/components/ChatInterface';
import { DocumentUpload } from '@/components/DocumentUpload';
import { DocumentList } from '@/components/DocumentList';
import { MessageSquare, Upload, FileText } from 'lucide-react';

type TabType = 'chat' | 'upload' | 'documents';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('chat');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">FDA RAG Assistant</h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-powered regulatory document search and Q&A
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Powered by Vercel AI SDK
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'chat'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'upload'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <Upload className="h-5 w-5" />
            Upload Documents
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === 'documents'
                ? 'text-blue-600 border-blue-600'
                : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}
          >
            <FileText className="h-5 w-5" />
            Document Library
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'chat' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Ask Questions About FDA Documents
              </h2>
              <ChatInterface />
            </div>
          )}

          {activeTab === 'upload' && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Upload FDA Documents
              </h2>
              <DocumentUpload />
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              <DocumentList />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}