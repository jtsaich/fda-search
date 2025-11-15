"use client";

import { DocumentList } from "@/components/DocumentList";

export default function DocumentsPage() {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="mx-auto flex h-full min-h-0 w-full flex-col py-6">
          <div className="flex h-full flex-1 min-h-0">
            <div className="flex flex-1 flex-col overflow-auto bg-white">
              <DocumentList />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
