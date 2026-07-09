import type { documents as EnDocuments } from "../en/documents";

export const documents: Record<keyof typeof EnDocuments, string> = {
  "documents.uploadFailed": "上传失败",
  "documents.dropFilesHere": "将文件拖放到这里……",
  "documents.dragDropHere": "将文档拖放到这里",
  "documents.clickToSelect": "或点击选择文件（PDF、TXT、DOCX、CSV、XLSX）",
  "documents.filesHeading": "文件",
  "documents.uploaded": "✓ 已上传",
  "documents.failed": "失败",
  "documents.uploading": "上传中……",
  "documents.uploadOneFile": "上传 {n} 个文件",
  "documents.uploadManyFiles": "上传 {n} 个文件",
  "documents.confirmDelete":
    "确定要删除“{filename}”吗？这将从数据库中移除所有相关的向量。此操作无法撤销。",
  "documents.deleteFailed": "删除文档失败：{detail}",
  "documents.unknownError": "未知错误",
  "documents.deleteFailedRetry": "删除文档失败，请重试。",
  "documents.noDocuments": "尚未上传文档",
  "documents.uploadToStart": "上传文档以开始使用",
  "documents.uploadedDocuments": "已上传的文档",
  "documents.colDocument": "文档",
  "documents.colSize": "大小",
  "documents.colChunks": "分块",
  "documents.colUploaded": "上传时间",
  "documents.colActions": "操作",
  "documents.idLabel": "ID：{id}",
  "documents.deleteTitle": "删除文档",
};
