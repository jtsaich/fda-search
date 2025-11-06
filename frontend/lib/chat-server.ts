import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

export async function createChat(user?: User): Promise<string> {
  const supabase = await createClient();

  let authenticatedUser = user;

  if (!authenticatedUser) {
    const {
      data: { user: fetchedUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.error("Failed to retrieve Supabase user:", userError);
      throw new Error("Unable to authenticate request");
    }

    authenticatedUser = fetchedUser ?? undefined;
  }

  if (!authenticatedUser?.id) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("chats")
    .insert({ user_id: authenticatedUser.id })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating chat:", error);
    throw new Error("Failed to create chat");
  }

  if (!data?.id) {
    throw new Error("Supabase did not return a chat ID");
  }

  return data.id;
}
