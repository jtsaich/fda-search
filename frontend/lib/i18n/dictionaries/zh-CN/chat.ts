import type { chat as EnChat } from "../en/chat";

export const chat: Record<keyof typeof EnChat, string> = {
  // Agent-step labels (getAgentLabel)
  "chat.agentGenerator": "生成器",
  "chat.agentToolRunner": "工具执行器",
  "chat.agentEvaluator": "评估器",
  "chat.agentDefault": "智能体",
  // Agent-step sentences (getAgentStepText)
  "chat.generatedByLlm": "LLM",
  "chat.generatedByRule": "规则",
  "chat.intentUnknown": "未知",
  "chat.generatorSelectedIntent": "{source}生成器选择了意图“{intent}”。",
  "chat.clarified": " 已澄清：{q}。",
  "chat.toolsFragment": " 工具：{tools}。",
  "chat.ranTools": "已运行 {tools}。",
  "chat.noEvidenceTools": "未运行任何证据工具。",
  "chat.evidenceRejected": "证据被拒绝：{issues}",
  "chat.evidenceApproved": "证据已通过，可用于生成答案。",
  "chat.stepCompleted": "步骤已完成。",
  // Toasts
  "chat.downloadedToast": "已下载 {filename}",
  "chat.docxDownloadFailed": "DOCX 下载失败",
  // Query-mode toggle
  "chat.queryMode": "查询模式：",
  "chat.useEvidenceTools": "使用证据工具",
  "chat.modelOnly": "仅模型",
  "chat.evidenceToolsHint": "智能体可使用 SQL 和知识库工具",
  "chat.modelOnlyHint": "不使用工具，仅模型回复",
  // Report / agent process
  "chat.reportDocx": "报告 DOCX",
  "chat.downloadReportDocxTitle": "将生成的报告下载为 DOCX",
  "chat.agentProcess": "智能体处理过程",
  // Token usage
  "chat.inputTokens": "输入：{n} 个 token",
  "chat.outputTokens": "输出：{n} 个 token",
  // Sources
  "chat.sourcesReferenced": "引用来源：",
  "chat.untitledSource": "未命名来源",
  "chat.sourceScore": "- 相关度：{n}",
  "chat.fileLabel": "文件：",
  "chat.unknownFilename": "未知",
  "chat.noContentAvailable": "暂无内容",
  // Messages / input
  "chat.uploadedImageAlt": "上传的图片",
  "chat.startTyping": "开始输入以提出问题",
  "chat.toggleHint": "在证据工具与仅模型回复之间切换",
  "chat.inputPlaceholder": "询问有关药物开发和法规的问题……",
  // ChartRenderer
  "chat.unsupportedChartType": "不支持的图表类型：{type}",
  "chat.downloadChartPngTitle": "将图表下载为 PNG",
  "chat.pngButton": "PNG",
  "chat.chartSource": "来源：{filename}",
  // Chat page / upload page
  "chat.loadingChat": "正在加载对话……",
  "chat.uploadDocuments": "上传文档",
};
