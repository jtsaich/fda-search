import { redirect } from "next/navigation";
import { createChat, getLatestChat } from "@/lib/chat-server";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
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

  // Try to get the latest chat session first
  let id = await getLatestChat(user);

  // If no chat exists, create a new one
  if (!id) {
    id = await createChat(user);
  }

  redirect(`/chat/${id}`);
}
