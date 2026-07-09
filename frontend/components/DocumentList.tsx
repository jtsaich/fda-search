"use client";

import { useState, useEffect } from "react";
import { Trash2, FileText, Loader2 } from "lucide-react";
import { useTranslation } from "@/components/i18n-provider";

interface Document {
  id: string;
  filename: string;
  upload_date: string;
  size: number;
  chunk_count: number;
}

export function DocumentList() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { t, locale } = useTranslation();

  const fetchDocuments = async () => {
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const deleteDocument = async (id: string, filename: string) => {
    if (!window.confirm(t("documents.confirmDelete", { filename }))) {
      return;
    }

    setDeletingId(id);
    try {
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/documents/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      } else {
        const error = await response
          .json()
          .catch(() => ({ detail: t("documents.unknownError") }));
        alert(t("documents.deleteFailed", { detail: error.detail }));
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
      alert(t("documents.deleteFailedRetry"));
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-lg font-semibold text-gray-700">
          {t("documents.noDocuments")}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          {t("documents.uploadToStart")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <h2 className="text-xl font-bold text-gray-800 mb-4 px-6">
        {t("documents.uploadedDocuments")}
      </h2>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("documents.colDocument")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("documents.colSize")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("documents.colChunks")}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("documents.colUploaded")}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t("documents.colActions")}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center max-w-md">
                    <FileText className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 truncate" title={doc.filename}>
                        {doc.filename}
                      </div>
                      <div className="text-xs text-gray-500 truncate" title={doc.id}>{t("documents.idLabel", { id: doc.id })}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatFileSize(doc.size)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {doc.chunk_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(doc.upload_date)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => deleteDocument(doc.id, doc.filename)}
                    disabled={deletingId === doc.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-white hover:bg-red-600 border border-red-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t("documents.deleteTitle")}
                  >
                    {deletingId === doc.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t("common.deleting")}</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        <span>{t("common.delete")}</span>
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
