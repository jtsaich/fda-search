import { createClient } from "@/utils/supabase/client";

export interface SystemPrompt {
  id: string;
  name: string;
  description: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function listSystemPrompts(): Promise<SystemPrompt[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("system_prompts")
    .select("id, name, description, content, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error loading system prompts:", error);
    throw new Error("Failed to load system prompts");
  }

  return data ?? [];
}

export async function createSystemPrompt({
  name,
  description,
  content,
}: {
  name: string;
  description?: string;
  content: string;
}): Promise<SystemPrompt> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("system_prompts")
    .insert({ name, description, content })
    .select("id, name, description, content, created_at, updated_at")
    .single();

  if (error) {
    console.error("Error creating system prompt:", error);
    throw new Error(
      error.code === "23505"
        ? "A system prompt with that name already exists"
        : "Failed to create system prompt"
    );
  }

  if (!data) {
    throw new Error("Supabase did not return the new system prompt");
  }

  return data;
}

export async function updateSystemPrompt(
  id: string,
  {
    name,
    description,
    content,
  }: {
    name?: string;
    description?: string | null;
    content?: string;
  }
): Promise<SystemPrompt> {
  const supabase = createClient();
  const updates: Record<string, string | null | undefined> = {
    name,
    description,
    content,
  };

  // Remove undefined properties so we only send provided fields.
  Object.keys(updates).forEach((key) => {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  });

  const { data, error } = await supabase
    .from("system_prompts")
    .update(updates)
    .eq("id", id)
    .select("id, name, description, content, created_at, updated_at")
    .single();

  if (error) {
    console.error("Error updating system prompt:", error);
    throw new Error(
      error.code === "23505"
        ? "A system prompt with that name already exists"
        : "Failed to update system prompt"
    );
  }

  if (!data) {
    throw new Error("Supabase did not return the updated system prompt");
  }

  return data;
}

export async function deleteSystemPrompt(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("system_prompts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting system prompt:", error);
    throw new Error("Failed to delete system prompt");
  }
}
