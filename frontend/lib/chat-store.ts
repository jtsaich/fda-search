import type { SupabaseClient } from "@supabase/supabase-js";
import { UIMessage } from "ai";
import { createClient } from "@/utils/supabase/client";

// Type for message parts in UIMessage
interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

// Token usage data structure
interface UsageData {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// Extract token usage from message parts
function extractTokenUsage(msg: UIMessage): UsageData | null {
  if (!msg.parts) return null;

  const usagePart = msg.parts.find(
    (part: MessagePart) => part.type === "data-usage"
  ) as { type: string; data?: UsageData } | undefined;

  if (usagePart?.data) {
    return {
      prompt_tokens: usagePart.data.prompt_tokens,
      completion_tokens: usagePart.data.completion_tokens,
      total_tokens: usagePart.data.total_tokens,
    };
  }

  return null;
}

async function getAuthedClient() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error("Failed to determine current user");
  }

  if (!user) {
    throw new Error("Not authenticated");
  }

  return { supabase, user };
}

async function assertChatOwnership(
  supabase: SupabaseClient,
  chatId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify chat ownership:", error);
    throw new Error("Unable to verify chat access");
  }

  if (!data) {
    throw new Error("Chat not found");
  }
}

export async function loadChat(id: string): Promise<UIMessage[]> {
  const { supabase, user } = await getAuthedClient();

  await assertChatOwnership(supabase, id, user.id);

  const { data, error } = await supabase
    .from("messages")
    .select("content")
    .eq("chat_id", id)
    .order("sequence_number", { ascending: true });

  if (error) {
    console.error("Error loading chat:", error);
    throw new Error("Failed to load chat");
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Parse the content JSONB field back to UIMessage[]
  return data.map((row) => row.content as UIMessage);
}

export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  const { supabase, user } = await getAuthedClient();

  await assertChatOwnership(supabase, chatId, user.id);

  // Delete existing messages for this chat to avoid duplicates
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId);

  if (deleteError) {
    console.error("Error deleting old messages:", deleteError);
    throw new Error("Failed to delete old messages");
  }

  // Insert all messages with sequence numbers and token usage
  const messagesWithSequence = messages.map((msg, idx) => {
    const usage = extractTokenUsage(msg);
    return {
      id: msg.id,
      chat_id: chatId,
      role: msg.role,
      content: msg, // Store the entire UIMessage object as JSONB
      sequence_number: idx,
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      total_tokens: usage?.total_tokens ?? null,
    };
  });

  const { error: insertError } = await supabase
    .from("messages")
    .insert(messagesWithSequence)
    .select();

  if (insertError) {
    console.error("Error saving messages:", insertError);
    throw new Error("Failed to save messages");
  }

  // Update the chat's updated_at timestamp
  const { error: updateError } = await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId)
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Error updating chat timestamp:", updateError);
    // Non-critical error, don't throw
  }
}

export async function listChats(): Promise<
  Array<{
    id: string;
    created_at: string;
    updated_at: string;
    title: string | null;
    lastMessage?: string;
  }>
> {
  const { supabase, user } = await getAuthedClient();

  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, created_at, updated_at, title")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error listing chats:", error);
    throw new Error("Failed to list chats");
  }

  if (!chats || chats.length === 0) {
    return [];
  }

  // Fetch the last message for each chat
  const chatsWithMessages = await Promise.all(
    chats.map(async (chat) => {
      const { data: messages } = await supabase
        .from("messages")
        .select("content")
        .eq("chat_id", chat.id)
        .order("sequence_number", { ascending: false })
        .limit(1);

      let lastMessage = "";
      if (messages && messages.length > 0) {
        const messageContent = messages[0].content;
        // Extract text from the message
        if (messageContent.content) {
          lastMessage = messageContent.content;
        } else if (messageContent.parts) {
          // Find the first text part
          const textPart = messageContent.parts.find(
            (p: MessagePart) => p.type === "text"
          );
          if (textPart && textPart.text) {
            lastMessage = textPart.text;
          }
        }
      }

      return {
        ...chat,
        lastMessage,
      };
    })
  );

  return chatsWithMessages;
}

export async function deleteChat(id: string): Promise<void> {
  const { supabase, user } = await getAuthedClient();

  const { error } = await supabase
    .from("chats")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting chat:", error);
    throw new Error("Failed to delete chat");
  }
}
