import { redirect } from "next/navigation";
import { createChat } from "@/lib/chat-server";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const id = await createChat();
  redirect(`/chat/${id}`);
}
