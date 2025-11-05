import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { event, session } = await request.json();

  try {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      if (session) {
        await supabase.auth.setSession(session);
      }
    }

    if (event === "SIGNED_OUT" || !session) {
      await supabase.auth.signOut();
    }
  } catch (error) {
    console.error("Error handling Supabase auth callback:", error);
    return NextResponse.json({ error: "Auth callback failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
