"use client";

import { useState, useEffect } from "react";
import { loadChat } from "@/lib/chat-store";
import { ChatInterface } from "@/components/ChatInterface";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentList } from "@/components/DocumentList";
import {
  MessageSquare,
  Upload,
  FileText,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { UIMessage } from "ai";
import { useParams } from "next/navigation";

type TabType = "chat" | "upload" | "documents";

const models = [
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B (Free)" },
];

export default function ChatPageWithId() {
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [selectedModel, setSelectedModel] = useState(
    "google/gemma-3-27b-it:free"
  );
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      setLoading(true);
      try {
        const messages = await loadChat(id);
        console.log('Setting initial messages:', messages);
        setInitialMessages(messages);
      } catch (error) {
        console.error("Error loading chat:", error);
        // Start with empty messages on error
        setInitialMessages([]);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchMessages();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header - Hidden on mobile (shown in layout) */}
      <header className="hidden lg:block bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                FDA RAG Assistant
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-powered regulatory document search and Q&A
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label
                htmlFor="global-model-select"
                className="text-sm font-medium text-gray-700"
              >
                AI Model:
              </label>
              <div className="relative">
                <select
                  id="global-model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none pr-8 min-w-[180px]"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b px-4 lg:px-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "chat"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            <span className="hidden sm:inline">Chat</span>
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "upload"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <Upload className="h-5 w-5" />
            <span className="hidden sm:inline">Upload</span>
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === "documents"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <FileText className="h-5 w-5" />
            <span className="hidden sm:inline">Documents</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto">
          {activeTab === "chat" && (
            <div>
              <ChatInterface
                key={id} // Force remount when chat ID changes
                id={id}
                initialMessages={initialMessages}
                selectedModel={selectedModel}
              />
            </div>
          )}

          {activeTab === "upload" && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Upload FDA Documents
              </h2>
              <DocumentUpload />
            </div>
          )}

          {activeTab === "documents" && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <DocumentList />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
