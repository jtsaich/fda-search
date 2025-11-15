"use client";

import { DocumentUpload } from "@/components/DocumentUpload";

export default function UploadPage() {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="mx-auto flex h-full min-h-0 w-full flex-col px-4 py-6">
          <div className="flex h-full flex-1 min-h-0">
            <div className="flex flex-1 flex-col overflow-auto bg-white">
              <h2 className="mb-4 px-6 text-xl font-semibold text-gray-800">
                Upload Documents
              </h2>
              <DocumentUpload />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
