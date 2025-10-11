"use client";

import { useState, useRef } from "react";
import { Send, Loader2, BookOpen, MessageCircle, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: "rag" | "direct";
  sources?: Array<{
    filename: string;
    similarity_score: number;
  }>;
  attachments?: Array<{
    name: string;
    type: string;
    size: number;
  }>;
}

interface ChatInterfaceProps {
  selectedModel: string;
}

export function ChatInterface({ selectedModel }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useRAG, setUseRAG] = useState(true);
  const [useSystemPrompt, setUseSystemPrompt] = useState(true);
  const [files, setFiles] = useState<FileList | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() && !files) return;

    // Prepare attachment metadata
    const attachments = files ? Array.from(files).map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
    })) : undefined;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      attachments,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const endpoint = useRAG ? "/query" : "/query-direct";

      // Prepare FormData if there are files
      let requestBody: string | FormData;
      const headers: HeadersInit = {};

      if (files && files.length > 0) {
        const formData = new FormData();
        formData.append("query", text);
        formData.append("model", selectedModel);
        formData.append("use_system_prompt", useSystemPrompt.toString());

        // Append all files
        Array.from(files).forEach((file) => {
          formData.append("files", file);
        });

        requestBody = formData;
        // Don't set Content-Type - browser will set it with boundary
      } else {
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify({
          query: text,
          model: selectedModel,
          use_system_prompt: useSystemPrompt,
        });
      }

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: "POST",
        headers,
        body: requestBody,
      });

      const responseData = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseData.answer || "No response received",
        mode: useRAG ? "rag" : "direct",
        sources: useRAG ? responseData.sources : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Clear files after sending
      setFiles(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I apologize, but I encountered an error. Please try again.",
        mode: useRAG ? "rag" : "direct",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto border rounded-lg shadow-lg">
      {/* Toggle Control */}
      <div className="border-b p-3 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Query Mode:</span>
            <button
              onClick={() => setUseRAG(!useRAG)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors",
                useRAG
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              <BookOpen className="h-4 w-4" />
              RAG Mode
            </button>
            <button
              onClick={() => setUseRAG(!useRAG)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors",
                !useRAG
                  ? "bg-purple-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              <MessageCircle className="h-4 w-4" />
              Direct LLM
            </button>
          </div>
          <div className="text-xs text-gray-500">
            {useRAG ? "Using embeddings + context" : "Direct model response"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">System Prompt:</span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSystemPrompt}
              onChange={(e) => setUseSystemPrompt(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Use FDA regulatory assistant prompt</span>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg font-semibold">
              Welcome to FDA RAG Assistant
            </p>
            <p className="text-sm mt-2">
              Ask questions about FDA regulations and processes
            </p>
            <p className="text-xs mt-4 text-gray-400">
              Toggle between RAG and Direct mode to compare results
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex flex-col",
                message.role === "user" ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-2",
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-900"
                )}
              >
                {message.role === "assistant" && message.mode && (
                  <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-300">
                    {message.mode === "rag" ? (
                      <>
                        <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-600">RAG Mode</span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-600">Direct LLM</span>
                      </>
                    )}
                  </div>
                )}
                <div className={cn(
                  "prose prose-sm max-w-none",
                  message.role === "user" ? "prose-invert" : "prose-gray"
                )}>
                  {message.role === "assistant" ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <>
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {message.attachments.map((attachment, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs bg-white/20 rounded px-2 py-1">
                              <Paperclip className="h-3 w-3" />
                              <span>{attachment.name}</span>
                              <span className="text-white/70">({(attachment.size / 1024).toFixed(1)} KB)</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </>
                  )}
                </div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-300">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Sources:</p>
                    {message.sources.slice(0, 3).map((source, idx) => (
                      <div key={idx} className="text-xs text-gray-500 ml-2">
                        • {source.filename} ({(source.similarity_score * 100).toFixed(1)}% match)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim() || files) {
            sendMessage(input);
            setInput("");
          }
        }}
        className="border-t p-4"
      >
        {/* File attachments preview */}
        {files && files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {Array.from(files).map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 text-sm">
                <Paperclip className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-gray-700">{file.name}</span>
                <span className="text-gray-400 text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                <button
                  type="button"
                  onClick={() => {
                    setFiles(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setFiles(e.target.files);
              }
            }}
            multiple
            accept=".pdf,.txt,.docx,.doc,.png,.jpg,.jpeg"
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors"
          >
            <Paperclip className="h-5 w-5" />
          </label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask questions about FDA regulations..."
            className="flex-1 px-4 py-2 border rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !files)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
