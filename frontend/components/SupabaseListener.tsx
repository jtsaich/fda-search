"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

interface SupabaseListenerProps {
  serverAccessToken?: string;
}

export function SupabaseListener({ serverAccessToken }: SupabaseListenerProps) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const accessToken = session?.access_token;

      if (accessToken && accessToken !== serverAccessToken) {
        await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session }),
        });
        router.refresh();
      }

      if (!accessToken && serverAccessToken) {
        await fetch("/auth/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, session: null }),
        });
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, serverAccessToken, supabase]);

  return null;
}
