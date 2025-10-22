"use client";

import { useState } from "react";
import { ChatInterface } from "@/components/ChatInterface";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentList } from "@/components/DocumentList";
import { MessageSquare, Upload, FileText, ChevronDown } from "lucide-react";

type TabType = "chat" | "upload" | "documents";

const models = [
  { id: "google/gemma-3-27b-it:free", name: "Gemma 3 27B (Free)" },
  // { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B (Free)" },
  // { id: "anthropic/claude-3-haiku:beta", name: "Claude 3 Haiku" },
  // { id: "openai/gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  // { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [selectedModel, setSelectedModel] = useState(
    "google/gemma-3-27b-it:free"
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                FDA RAG Assistant
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                AI-powered regulatory document search and Q&A
              </p>
            </div>
            <div className="flex items-center gap-4">
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
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8 border-b">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "chat"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <MessageSquare className="h-5 w-5" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "upload"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <Upload className="h-5 w-5" />
            Upload Documents
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 ${
              activeTab === "documents"
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            }`}
          >
            <FileText className="h-5 w-5" />
            Document Library
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === "chat" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Ask Questions About FDA Documents
              </h2>
              <ChatInterface selectedModel={selectedModel} />
            </div>
          )}

          {activeTab === "upload" && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Upload FDA Documents
              </h2>
              <DocumentUpload />
            </div>
          )}

          {activeTab === "documents" && (
            <div>
              <DocumentList />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
