import { redirect } from "next/navigation";
import { createChat } from "@/lib/chat-server";
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

  const id = await createChat(user);
  redirect(`/chat/${id}`);
}
