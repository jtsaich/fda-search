export interface DocxSourcePayload {
  title?: string;
  filename?: string;
  score?: number;
  text?: string;
}

export interface DocxExportPayload {
  title?: string;
  content: string;
  sources?: DocxSourcePayload[];
}

export type DocxReportArtifactPayload = DocxExportPayload;

export interface RagSourceMetadata {
  score?: number;
  text?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const CHART_SPEC_BLOCK_REGEX = /CHART_SPEC:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
const DEFAULT_DOCX_FILENAME = "fda-search-answer.docx";

export function stripChartSpecs(text: string): string {
  return text.replace(CHART_SPEC_BLOCK_REGEX, "").trim();
}


export function getDocxReportFromParts(
  parts: readonly unknown[]
): DocxReportArtifactPayload | null {
  for (const part of parts) {
    if (!isRecord(part) || part.type !== "data-docx-report" || !isRecord(part.data)) {
      continue;
    }

    const content = getStringField(part.data, "content");
    if (!content) return null;

    const sources = Array.isArray(part.data.sources)
      ? part.data.sources.map(getDocxSourcePayload).filter((source) => source !== null)
      : undefined;

    return {
      title: getStringField(part.data, "title") || "Generated Report",
      content,
      sources,
    };
  }

  return null;
}


export function getRagSourceMetadata(providerMetadata: unknown): RagSourceMetadata {
  if (!isRecord(providerMetadata) || !isRecord(providerMetadata.rag)) {
    return {};
  }

  return {
    score: getNumberField(providerMetadata.rag, "score"),
    text: getStringField(providerMetadata.rag, "text"),
  };
}

export async function downloadDocxExport(payload: DocxExportPayload): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/export/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getExportErrorMessage(response));
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error("DOCX export returned an empty file");
  }

  const filename =
    getFilenameFromContentDisposition(response.headers.get("Content-Disposition")) ||
    DEFAULT_DOCX_FILENAME;
  triggerBrowserDownload(blob, filename);
  return filename;
}

export function getFilenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;

  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].trim());

  const quotedMatch = header.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();

  const plainMatch = header.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) return plainMatch[1].trim();

  return null;
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

async function getExportErrorMessage(response: Response): Promise<string> {
  const fallback = `DOCX export failed (${response.status})`;

  try {
    const errorBody = await response.json();
    if (isRecord(errorBody) && typeof errorBody.detail === "string") {
      return `${errorBody.detail} (${response.status})`;
    }
  } catch {
    // Non-JSON backend errors still surface with the HTTP status below.
  }

  return fallback;
}

function getDocxSourcePayload(value: unknown): DocxSourcePayload | null {
  if (!isRecord(value)) return null;

  const source: DocxSourcePayload = {
    title: getStringField(value, "title"),
    filename: getStringField(value, "filename"),
    score: getNumberField(value, "score"),
    text: getStringField(value, "text"),
  };

  return Object.values(source).some((value) => value !== undefined && value !== "")
    ? source
    : null;
}

function getStringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getNumberField(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
