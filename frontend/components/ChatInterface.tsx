"use client";

import { useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  Send,
  Loader2,
  BookOpen,
  MessageCircle,
  Activity,
  Paperclip,
  X,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DefaultChatTransport, UIMessage } from "ai";
import { saveChat } from "@/lib/chat-store";
import {
  downloadDocxExport,
  getDocxSourcesFromParts,
  getRagSourceMetadata,
  getVisibleAssistantText,
  stripChartSpecs,
} from "@/lib/docx-export";
import { SystemPromptManager } from "./SystemPromptManager";
import { ChartRenderer, type ChartData } from "./ChartRenderer";

interface ChatInterfaceProps {
  id?: string;
  initialMessages?: UIMessage[];
  selectedModel: string;
}


// Token usage data from the backend
interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface AgentStep {
  agent?: string;
  status?: string;
  generated_by?: string;
  intent?: string;
  clarified_question?: string;
  tools?: string[];
  tool_reason?: string;
  issues?: string[];
}

const DEFAULT_SYSTEM_PROMPT =
  "You are an expert AI researcher in pharmaceutical development, specializing in process optimization and automation.";

const CHART_SPEC_REGEX = /CHART_SPEC:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/g;

/** Extract ChartData[] from raw text parts (fallback when data-chart parts are missing after reload) */
function parseChartSpecsFromText(parts: readonly unknown[]): ChartData[] {
  const charts: ChartData[] = [];
  for (const part of parts) {
    if (!isRecord(part) || part.type !== "text" || typeof part.text !== "string") {
      continue;
    }
    const regex = new RegExp(CHART_SPEC_REGEX.source, "g");
    let match;
    while ((match = regex.exec(part.text)) !== null) {
      try {
        const spec: unknown = JSON.parse(match[1]);
        if (!isRecord(spec)) continue;

        charts.push({
          chartType: getStringValue(spec.chartType, "bar"),
          title: getStringValue(spec.title, ""),
          data: Array.isArray(spec.data) ? spec.data.filter(isRecord) : [],
          xAxis: getStringValue(spec.xAxis, ""),
          yAxis: Array.isArray(spec.yAxis)
            ? spec.yAxis.filter((value) => typeof value === "string")
            : getStringValue(spec.yAxis, ""),
          filename: typeof spec.filename === "string" ? spec.filename : undefined,
        });
      } catch {
        // skip invalid JSON
      }
    }
  }
  return charts;
}

function getAgentLabel(agent?: string) {
  if (agent === "contract_generator") return "Generator";
  if (agent === "tool_runner") return "Tool runner";
  if (agent === "evidence_evaluator") return "Evaluator";
  return agent || "Agent";
}

function getAgentStepText(step: AgentStep) {
  if (step.agent === "contract_generator") {
    const tools = step.tools?.length ? ` Tools: ${step.tools.join(", ")}.` : "";
    const clarified = step.clarified_question
      ? ` Clarified: ${step.clarified_question}.`
      : "";
    return `${step.generated_by === "llm" ? "LLM" : "Rule"} generator selected intent "${step.intent || "unknown"}."${clarified}${tools}`;
  }
  if (step.agent === "tool_runner") {
    return step.tools?.length
      ? `Ran ${step.tools.join(", ")}.`
      : "No evidence tools were run.";
  }
  if (step.agent === "evidence_evaluator") {
    return step.issues?.length
      ? `Evidence rejected: ${step.issues.join("; ")}`
      : "Evidence approved for answer generation.";
  }
  return step.status || "Step completed.";
}

interface ChartDataPart {
  key: string | number;
  chart: ChartData;
}

interface SourceDisplayData {
  title?: string;
  filename?: string;
  score?: number;
  text?: string;
}


function getUsageData(part: unknown): UsageData | null {
  if (!isRecord(part) || part.type !== "data-usage") return null;
  return isUsageData(part.data) ? part.data : null;
}

function getAgentStepData(part: unknown): AgentStep | null {
  if (!isRecord(part) || part.type !== "data-agent-step" || !isRecord(part.data)) {
    return null;
  }

  return {
    agent: getOptionalString(part.data.agent),
    status: getOptionalString(part.data.status),
    generated_by: getOptionalString(part.data.generated_by),
    intent: getOptionalString(part.data.intent),
    clarified_question: getOptionalString(part.data.clarified_question),
    tools: Array.isArray(part.data.tools)
      ? part.data.tools.filter((tool) => typeof tool === "string")
      : undefined,
    tool_reason: getOptionalString(part.data.tool_reason),
    issues: Array.isArray(part.data.issues)
      ? part.data.issues.filter((issue) => typeof issue === "string")
      : undefined,
  };
}


function getChartDataPart(part: unknown, fallbackKey: number): ChartDataPart | null {
  if (!isRecord(part) || part.type !== "data-chart" || !isChartData(part.data)) {
    return null;
  }

  return {
    key: typeof part.id === "string" ? part.id : fallbackKey,
    chart: part.data,
  };
}

function getSourceDisplayData(part: unknown): SourceDisplayData | null {
  if (!isRecord(part) || part.type !== "source-document") return null;

  const rag = getRagSourceMetadata(part.providerMetadata);
  return {
    title: getOptionalString(part.title),
    filename: getOptionalString(part.filename),
    score: rag.score,
    text: rag.text,
  };
}

function isUsageData(value: unknown): value is UsageData {
  return (
    isRecord(value) &&
    typeof value.prompt_tokens === "number" &&
    typeof value.completion_tokens === "number" &&
    typeof value.total_tokens === "number"
  );
}

function isChartData(value: unknown): value is ChartData {
  return (
    isRecord(value) &&
    typeof value.chartType === "string" &&
    typeof value.title === "string" &&
    Array.isArray(value.data) &&
    typeof value.xAxis === "string" &&
    (typeof value.yAxis === "string" ||
      (Array.isArray(value.yAxis) &&
        value.yAxis.every((axis) => typeof axis === "string"))) &&
    (value.filename === undefined || typeof value.filename === "string")
  );
}

function getStringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ChatInterface({
  id,
  initialMessages,
  selectedModel,
}: ChatInterfaceProps) {
  const [useEvidenceTools, setUseEvidenceTools] = useState(true);
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);

  const [input, setInput] = useState("");
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [docxDownloadingMessageIds, setDocxDownloadingMessageIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, status } = useChat({
    id, // Use the chat ID for persistence
    messages: initialMessages, // Load initial messages
    transport: new DefaultChatTransport({
      api: `${
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"
      }/api/chat`,
    }),
    onData: (dataPart) => console.log("data", dataPart),
    onError: (options) => console.log("error", options),
    onFinish: async (options) => {
      console.log("finish", options);
      // Save messages to Supabase
      if (id && options.messages) {
        try {
          await saveChat({ chatId: id, messages: options.messages });
          console.log("Chat saved successfully");

          // Notify sidebar to refresh
          window.dispatchEvent(new CustomEvent("chatUpdated"));
        } catch (error) {
          console.error("Error saving chat:", error);
        }
      }
      // Clear files after message is sent
      setFiles(undefined);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
  });
  const handleDownloadDocx = async (message: UIMessage) => {
    const content = getVisibleAssistantText(message.parts);
    if (!content || docxDownloadingMessageIds.has(message.id)) return;

    setDocxDownloadingMessageIds((current) => {
      const next = new Set(current);
      next.add(message.id);
      return next;
    });

    try {
      await downloadDocxExport({
        title: "FDA Search Answer",
        content,
        sources: getDocxSourcesFromParts(message.parts),
      });
    } catch (error) {
      console.error("DOCX download failed:", error);
    } finally {
      setDocxDownloadingMessageIds((current) => {
        const next = new Set(current);
        next.delete(message.id);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col w-full bg-white">
      {/* Toggle Control */}
      <div className="border-b p-3 bg-gray-50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              Query Mode:
            </span>
            <button
              onClick={() => setUseEvidenceTools(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors",
                useEvidenceTools
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              <BookOpen className="h-4 w-4" />
              Use Evidence Tools
            </button>
            <button
              onClick={() => setUseEvidenceTools(false)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors",
                !useEvidenceTools
                  ? "bg-purple-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              )}
            >
              <MessageCircle className="h-4 w-4" />
              Model Only
            </button>
          </div>
          <div className="text-xs text-gray-500">
            {useEvidenceTools ? "Agent can use SQL and knowledge-base tools" : "No tools, model-only response"}
          </div>
        </div>

        <SystemPromptManager
          systemPrompt={systemPrompt}
          onSystemPromptChange={setSystemPrompt}
          defaultPrompt={DEFAULT_SYSTEM_PROMPT}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm mt-2">Start typing to ask questions</p>
            <p className="text-xs mt-4 text-gray-400">
              Toggle between evidence tools and model-only responses
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
                <div
                  className={cn(
                    "prose prose-sm max-w-none",
                    message.role === "user" ? "prose-invert" : "prose-gray"
                  )}
                >
                  {message.role === "assistant" ? (
                    <>
                      {/* Download visible assistant answer as DOCX */}
                      {(() => {
                        const visibleText = getVisibleAssistantText(message.parts);
                        if (!visibleText) return null;

                        const isDocxDownloading = docxDownloadingMessageIds.has(message.id);
                        return (
                          <div className="not-prose mb-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                void handleDownloadDocx(message);
                              }}
                              disabled={isDocxDownloading}
                              title="Download answer as DOCX"
                              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isDocxDownloading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                              DOCX
                            </button>
                          </div>
                        );
                      })()}

                      {/* Render streamed agent process steps */}
                      {(() => {
                        const agentStepParts = message.parts
                          .map((part) => getAgentStepData(part))
                          .filter((step) => step !== null);
                        if (agentStepParts.length === 0) return null;

                        return (
                          <div className="mb-3 rounded-md border border-slate-200 bg-white/70 p-2 text-xs text-slate-700">
                            <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-slate-800">
                              <Activity className="h-3.5 w-3.5" />
                              Agent process
                            </div>
                            <div className="space-y-1.5">
                              {agentStepParts.map((step, idx) => (
                                <div key={idx} className="flex gap-2">
                                  <span className="min-w-20 font-medium text-slate-600">
                                    {getAgentLabel(step.agent)}
                                  </span>
                                  <span className="text-slate-700">
                                    {getAgentStepText(step)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Render text content (strip CHART_SPEC blocks) */}
                      {message.parts
                        .filter((part) => part.type === "text")
                        .map((part, idx) => {
                          const cleaned = stripChartSpecs(part.text);
                          if (!cleaned) return null;
                          return (
                            <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
                              {cleaned}
                            </ReactMarkdown>
                          );
                        })}

                      {/* Render token usage */}
                      {message.parts.map((part, idx) => {
                        const usage = getUsageData(part);
                        if (!usage) return null;

                        return (
                          <div
                            key={idx}
                            className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500 flex gap-3"
                          >
                            <span>Input: {usage.prompt_tokens} tokens</span>
                            <span>Output: {usage.completion_tokens} tokens</span>
                          </div>
                        );
                      })}

                      {/* Render chart-data parts (AI SDK DataUIPart or fallback from CHART_SPEC in text) */}
                      {(() => {
                        const dataChartParts = message.parts
                          .map((part, idx) => getChartDataPart(part, idx))
                          .filter((part) => part !== null);
                        if (dataChartParts.length > 0) {
                          return dataChartParts.map((part) => (
                            <ChartRenderer key={part.key} chart={part.chart} />
                          ));
                        }
                        // Fallback: parse CHART_SPEC from text (e.g. after page refresh)
                        const parsed = parseChartSpecsFromText(message.parts);
                        return parsed.map((chart, idx) => (
                          <ChartRenderer key={`parsed-${idx}`} chart={chart} />
                        ));
                      })()}

                      {/* Render source-document parts */}
                      {(() => {
                        const sourceParts = message.parts
                          .map((part) => getSourceDisplayData(part))
                          .filter((source) => source !== null);
                        if (sourceParts.length === 0) return null;

                        return (
                          <div className="mt-4 pt-3 border-t border-gray-300">
                            <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              Sources Referenced:
                            </div>
                            <div className="space-y-2">
                              {sourceParts.map((source, idx) => (
                                <details
                                  key={idx}
                                  className="text-xs bg-blue-50 rounded p-2 border border-blue-200"
                                >
                                  <summary className="cursor-pointer font-medium text-blue-700 hover:text-blue-900">
                                    {source.title || source.filename || "Untitled source"} - Score:{" "}
                                    {source.score ?? 0}
                                  </summary>
                                  <div className="mt-2 space-y-1">
                                    <div className="text-gray-600">
                                      <span className="font-semibold">File:</span>{" "}
                                      {source.filename || "Unknown"}
                                    </div>
                                    <div className="text-gray-700 whitespace-pre-wrap border-t pt-2">
                                      {source.text || "No content available"}
                                    </div>
                                  </div>
                                </details>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
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
              <Loader2 className="h-4 w-4 text-gray-900 animate-spin" />
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
                  ...(selectedModel ? { model: selectedModel } : {}),
                  use_evidence_tools: useEvidenceTools,
                  system_prompt: systemPrompt,
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
            accept=".pdf,.txt,.docx,.doc,.png,.jpg,.jpeg,.csv,.xlsx"
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
            placeholder="Ask questions about pharmaceutical development and regulations..."
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
