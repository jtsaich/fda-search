"use client";

import { useEffect, useState } from "react";
import { loadChat } from "@/lib/chat-store";
import { ChatInterface } from "@/components/ChatInterface";
import { Loader2 } from "lucide-react";
import { UIMessage } from "ai";
import { useParams } from "next/navigation";

export default function ChatPageWithId() {
  const params = useParams();
  const id = params.id as string;
  const selectedModel = "google/gemma-3-27b-it:free";
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMessages() {
      setLoading(true);
      try {
        const messages = await loadChat(id);
        console.log("Setting initial messages:", messages);
        setInitialMessages(messages);
      } catch (error) {
        console.error("Error loading chat:", error);
        // Start with empty messages on error
        setInitialMessages([]);
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchMessages();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col py-6">
          <div className="flex h-full flex-1 min-h-0 flex-col">
            <ChatInterface
              key={id} // Force remount when chat ID changes
              id={id}
              initialMessages={initialMessages}
              selectedModel={selectedModel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
