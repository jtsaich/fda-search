"use client";

import { useEffect, useState } from "react";
import { listChats, deleteChat } from "@/lib/chat-store";
import { MessageSquare, Plus, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Chat {
  id: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  lastMessage?: string;
}

export function ChatSidebar() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const params = useParams();
  const router = useRouter();
  const currentChatId = params.id as string;

  useEffect(() => {
    loadChats();

    // Listen for custom events to refresh chat list
    const handleChatUpdate = () => {
      console.log("Chat update event received, refreshing sidebar");
      loadChats();
    };

    window.addEventListener("chatUpdated", handleChatUpdate);
    return () => window.removeEventListener("chatUpdated", handleChatUpdate);
  }, []);

  // Refresh chat list when chat ID changes (new chat created or switched)
  useEffect(() => {
    if (currentChatId) {
      // Small delay to ensure database has been written
      const timer = setTimeout(() => {
        loadChats();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentChatId]);

  async function loadChats() {
    try {
      const chatList = await listChats();
      setChats(chatList);
    } catch (error) {
      console.error("Error loading chats:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteChat(chatId: string, e: React.MouseEvent) {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();

    if (!confirm("Delete this chat? This cannot be undone.")) {
      return;
    }

    setDeletingId(chatId);
    try {
      await deleteChat(chatId);
      setChats(chats.filter((c) => c.id !== chatId));

      // If deleting current chat, redirect to new chat
      if (chatId === currentChatId) {
        router.push("/chat");
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
      alert("Failed to delete chat");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  function getChatTitle(chat: Chat) {
    // Use custom title if set
    if (chat.title) return chat.title;

    // Use last message preview if available
    if (chat.lastMessage) {
      const trimmed = chat.lastMessage.trim();
      // Limit to 40 characters for better display
      if (trimmed.length > 40) {
        return trimmed.substring(0, 37) + "...";
      }
      return trimmed;
    }

    // Fallback for empty chats
    return "New chat";
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <Link
          href="/chat/new"
          className="flex items-center gap-2 w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="h-5 w-5" />
          New Chat
        </Link>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : chats.length === 0 ? (
          <div className="text-center py-8 px-4">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No chat history yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Start a conversation to see it here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {chats.map((chat) => (
              <Link
                key={chat.id}
                href={`/chat/${chat.id}`}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${
                  currentChatId === chat.id
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "hover:bg-gray-100 text-gray-700 border border-transparent"
                }`}
              >
                <MessageSquare
                  className={`h-4 w-4 flex-shrink-0 ${
                    currentChatId === chat.id
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {getChatTitle(chat)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(chat.updated_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  disabled={deletingId === chat.id}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-opacity"
                  title="Delete chat"
                >
                  {deletingId === chat.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                  )}
                </button>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <p className="text-xs text-gray-500 text-center">
          {chats.length} chat{chats.length !== 1 ? "s" : ""} saved
        </p>
      </div>
    </div>
  );
}
