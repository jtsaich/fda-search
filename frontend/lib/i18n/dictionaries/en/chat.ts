export const chat = {
  // Agent-step labels (getAgentLabel)
  "chat.agentGenerator": "Generator",
  "chat.agentToolRunner": "Tool runner",
  "chat.agentEvaluator": "Evaluator",
  "chat.agentDefault": "Agent",
  // Agent-step sentences (getAgentStepText)
  "chat.generatedByLlm": "LLM",
  "chat.generatedByRule": "Rule",
  "chat.intentUnknown": "unknown",
  "chat.generatorSelectedIntent": '{source} generator selected intent "{intent}."',
  "chat.clarified": " Clarified: {q}.",
  "chat.toolsFragment": " Tools: {tools}.",
  "chat.ranTools": "Ran {tools}.",
  "chat.noEvidenceTools": "No evidence tools were run.",
  "chat.evidenceRejected": "Evidence rejected: {issues}",
  "chat.evidenceApproved": "Evidence approved for answer generation.",
  "chat.stepCompleted": "Step completed.",
  // Toasts
  "chat.downloadedToast": "Downloaded {filename}",
  "chat.docxDownloadFailed": "DOCX download failed",
  // Query-mode toggle
  "chat.queryMode": "Query Mode:",
  "chat.useEvidenceTools": "Use Evidence Tools",
  "chat.modelOnly": "Model Only",
  "chat.evidenceToolsHint": "Agent can use SQL and knowledge-base tools",
  "chat.modelOnlyHint": "No tools, model-only response",
  // Report / agent process
  "chat.reportDocx": "Report DOCX",
  "chat.downloadReportDocxTitle": "Download generated report as DOCX",
  "chat.agentProcess": "Agent process",
  // Token usage
  "chat.inputTokens": "Input: {n} tokens",
  "chat.outputTokens": "Output: {n} tokens",
  // Sources
  "chat.sourcesReferenced": "Sources Referenced:",
  "chat.untitledSource": "Untitled source",
  "chat.sourceScore": "- Score: {n}",
  "chat.fileLabel": "File:",
  "chat.unknownFilename": "Unknown",
  "chat.noContentAvailable": "No content available",
  // Messages / input
  "chat.uploadedImageAlt": "Uploaded image",
  "chat.startTyping": "Start typing to ask questions",
  "chat.toggleHint": "Toggle between evidence tools and model-only responses",
  "chat.inputPlaceholder":
    "Ask questions about pharmaceutical development and regulations...",
  // ChartRenderer
  "chat.unsupportedChartType": "Unsupported chart type: {type}",
  "chat.downloadChartPngTitle": "Download chart as PNG",
  "chat.pngButton": "PNG",
  "chat.chartSource": "Source: {filename}",
  // Chat page / upload page
  "chat.loadingChat": "Loading chat...",
  "chat.uploadDocuments": "Upload Documents",
} as const;
