import { UIMessage } from "ai";
import { supabase } from "./supabase";

// Type for message parts in UIMessage
interface MessagePart {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export async function createChat(): Promise<string> {
  console.log('createChat: Starting chat creation...');
  console.log('createChat: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

  try {
    const { data, error } = await supabase
      .from("chats")
      .insert({})
      .select("id")
      .single();

    if (error) {
      console.error("createChat: Supabase error:", error);
      console.error("createChat: Error details:", JSON.stringify(error, null, 2));
      throw new Error(`Failed to create chat: ${error.message}`);
    }

    if (!data || !data.id) {
      console.error("createChat: No data returned from insert");
      throw new Error("Failed to create chat: No ID returned");
    }

    console.log('createChat: Successfully created chat with ID:', data.id);
    return data.id;
  } catch (err) {
    console.error("createChat: Caught exception:", err);
    throw err;
  }
}

export async function loadChat(id: string): Promise<UIMessage[]> {
  console.log("Loading chat with ID:", id);

  const { data, error } = await supabase
    .from("messages")
    .select("content")
    .eq("chat_id", id)
    .order("sequence_number", { ascending: true });

  if (error) {
    console.error("Error loading chat:", error);
    throw new Error("Failed to load chat");
  }

  console.log("Raw data from Supabase:", data);
  console.log("Number of messages loaded:", data?.length || 0);

  if (!data || data.length === 0) {
    console.warn("No messages found for chat ID:", id);
    return [];
  }

  // Parse the content JSONB field back to UIMessage[]
  const messages = data.map((row) => row.content as UIMessage);
  console.log("Parsed messages:", messages);

  return messages;
}

export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  console.log("Saving chat:", chatId);
  console.log("Number of messages to save:", messages.length);
  console.log("Messages to save:", messages);

  // Delete existing messages for this chat to avoid duplicates
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("chat_id", chatId);

  if (deleteError) {
    console.error("Error deleting old messages:", deleteError);
    throw new Error("Failed to delete old messages");
  }

  // Insert all messages with sequence numbers
  const messagesWithSequence = messages.map((msg, idx) => ({
    id: msg.id,
    chat_id: chatId,
    role: msg.role,
    content: msg, // Store the entire UIMessage object as JSONB
    sequence_number: idx,
  }));

  console.log("Prepared messages for insert:", messagesWithSequence.length);

  const { data: insertData, error: insertError } = await supabase
    .from("messages")
    .insert(messagesWithSequence)
    .select();

  if (insertError) {
    console.error("Error saving messages:", insertError);
    throw new Error("Failed to save messages");
  }

  console.log("Successfully saved messages:", insertData?.length || 0);

  // Update the chat's updated_at timestamp
  const { error: updateError } = await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);

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
  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, created_at, updated_at, title")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error listing chats:", error);
    throw new Error("Failed to list chats");
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
  const { error } = await supabase.from("chats").delete().eq("id", id);

  if (error) {
    console.error("Error deleting chat:", error);
    throw new Error("Failed to delete chat");
  }
}
