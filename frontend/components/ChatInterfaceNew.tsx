"use client";

import { useState, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import {
  Send,
  Loader2,
  BookOpen,
  MessageCircle,
  Paperclip,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DefaultChatTransport } from "ai";

interface ChatInterfaceProps {
  selectedModel: string;
}

// Matches the AI SDK SourceDocumentUIPart providerMetadata structure
interface SourceMetadata {
  rag: {
    chunk_index: number;
    score: number;
    text: string;
    document_id: string;
  };
}

export function ChatInterface({ selectedModel }: ChatInterfaceProps) {
  const [useRAG, setUseRAG] = useState(true);
  const [useSystemPrompt, setUseSystemPrompt] = useState(true);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: `${
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      }/api/chat`,
    }),
    onData: (dataPart) => console.log("data", dataPart),
    onError: (options) => console.log("error", options),
    onFinish: (options) => {
      console.log("finish", options);
      // Clear files after message is sent
      setFiles(undefined);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
  });

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto border rounded-lg shadow-lg">
      {/* Toggle Control */}
      <div className="border-b p-3 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Query Mode:
            </span>
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
          <span className="text-sm font-medium text-gray-700">
            System Prompt:
          </span>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useSystemPrompt}
              onChange={(e) => setUseSystemPrompt(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Use FDA regulatory assistant prompt
            </span>
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
            <p className="text-xs text-gray-400">
              Now with full conversation history support!
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
                {message.role === "assistant" && (
                  <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-gray-300">
                    {useRAG ? (
                      <>
                        <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                        <span className="text-xs font-semibold text-blue-600">
                          RAG Mode
                        </span>
                      </>
                    ) : (
                      <>
                        <MessageCircle className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-xs font-semibold text-purple-600">
                          Direct LLM
                        </span>
                      </>
                    )}
                  </div>
                )}
                <div
                  className={cn(
                    "prose prose-sm max-w-none",
                    message.role === "user" ? "prose-invert" : "prose-gray"
                  )}
                >
                  {message.role === "assistant" ? (
                    <>
                      {/* Render text content */}
                      {message.parts
                        .filter((part) => part.type === "text")
                        .map((part, idx) => (
                          <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
                            {part.text}
                          </ReactMarkdown>
                        ))}

                      {/* Render source-document parts */}
                      {message.parts.filter(
                        (part) => part.type === "source-document"
                      ).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-300">
                          <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            Sources Referenced:
                          </div>
                          <div className="space-y-2">
                            {message.parts
                              .filter((part) => part.type === "source-document")
                              .map((part, idx) => {
                                // AI SDK SourceDocumentUIPart
                                if (part.type !== "source-document") return null;
                                const metadata = part.providerMetadata as SourceMetadata | undefined;
                                const rag = metadata?.rag;
                                return (
                                  <details
                                    key={idx}
                                    className="text-xs bg-blue-50 rounded p-2 border border-blue-200"
                                  >
                                    <summary className="cursor-pointer font-medium text-blue-700 hover:text-blue-900">
                                      {part.title} - Score: {rag?.score ?? 0}
                                    </summary>
                                    <div className="mt-2 space-y-1">
                                      <div className="text-gray-600">
                                        <span className="font-semibold">File:</span> {part.filename}
                                      </div>
                                      <div className="text-gray-700 whitespace-pre-wrap border-t pt-2">
                                        {rag?.text || 'No content available'}
                                      </div>
                                    </div>
                                  </details>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {message.parts.map((part, idx) => {
                        if (part.type === "text") {
                          return (
                            <div key={idx} className="whitespace-pre-wrap">
                              {part.text}
                            </div>
                          );
                        }
                        if (
                          part.type === "file" &&
                          part.mediaType?.startsWith("image/")
                        ) {
                          return (
                            <div key={idx} className="mb-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={part.url}
                                alt="Uploaded image"
                                className="rounded-md max-w-xs"
                              />
                            </div>
                          );
                        }
                        return null;
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {status !== "ready" && (
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
          if (input.trim()) {
            sendMessage(
              { text: input, files },
              {
                body: {
                  model: selectedModel,
                  use_rag: useRAG,
                  use_system_prompt: useSystemPrompt,
                },
              }
            );
            setInput("");
          }
        }}
        className="border-t p-4"
      >
        {/* File attachments preview */}
        {files && files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {Array.from(files).map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5 text-sm"
              >
                <Paperclip className="h-3.5 w-3.5 text-gray-500" />
                <span className="text-gray-700">{file.name}</span>
                <span className="text-gray-400 text-xs">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFiles(undefined);
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
            disabled={status !== "ready"}
            placeholder="Ask questions about FDA regulations..."
            className="flex-1 px-4 py-2 border rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={status !== "ready" || (!input.trim() && !files)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status !== "ready" ? (
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
