import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createChat } from "@/lib/chat-server";

export default async function NewChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to authenticate user:", error);
    redirect("/login");
  }

  if (!user) {
    redirect("/login");
  }

  // Always create a new chat
  const id = await createChat(user);
  redirect(`/chat/${id}`);
}
