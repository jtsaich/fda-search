import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    console.log("Exchanging code for session:", code);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Code exchange error:", error);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    } else {
      console.log("Code exchange success, session user:", data.session?.user.email);
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else {
    console.log("No code found in URL");
  }

  // return the user to an error page with instructions
  console.log("Redirecting to login with error");
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`);
}

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
