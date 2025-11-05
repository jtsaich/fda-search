"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type CookieOptions = {
  domain?: string;
  expires?: string | number | Date;
  maxAge?: number;
  httpOnly?: boolean;
  partitioned?: boolean;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  priority?: "low" | "medium" | "high";
};

type SupabaseCookie = {
  name: string;
  value: string;
  options?: CookieOptions;
};

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables");
}

let client: SupabaseClient | undefined;

function serializeCookie(
  name: string,
  value: string,
  options?: CookieOptions
): string {
  const encodedName = encodeURIComponent(name);
  const encodedValue = encodeURIComponent(value);
  const parts = [`${encodedName}=${encodedValue}`];

  if (options?.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  if (options?.expires) {
    const expires =
      typeof options.expires === "string"
        ? options.expires
        : typeof options.expires === "number"
        ? new Date(options.expires).toUTCString()
        : options.expires instanceof Date
        ? options.expires.toUTCString()
        : undefined;

    if (expires) {
      parts.push(`Expires=${expires}`);
    }
  }

  parts.push(`Path=${options?.path ?? "/"}`);

  if (options?.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options?.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  if (options?.secure) {
    parts.push("Secure");
  }

  if (options?.httpOnly) {
    parts.push("HttpOnly");
  }

  if (options?.priority) {
    parts.push(`Priority=${options.priority}`);
  }

  if (options?.partitioned) {
    parts.push("Partitioned");
  }

  return parts.join("; ");
}

function getAllCookies(): SupabaseCookie[] {
  if (typeof document === "undefined" || !document.cookie) {
    return [];
  }

  return document.cookie.split("; ").reduce<SupabaseCookie[]>((acc, entry) => {
    if (!entry) {
      return acc;
    }

    const [rawName, ...rest] = entry.split("=");
    const rawValue = rest.join("=");

    if (!rawName) {
      return acc;
    }

    acc.push({
      name: decodeURIComponent(rawName),
      value: decodeURIComponent(rawValue ?? ""),
    });

    return acc;
  }, []);
}

export function createClient() {
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll(): SupabaseCookie[] {
          return getAllCookies();
        },
        setAll(cookies: SupabaseCookie[]) {
          if (typeof document === "undefined") {
            return;
          }

          cookies.forEach(({ name, value, options }) => {
            document.cookie = serializeCookie(name, value, options);
          });
        },
      },
    });
  }

  return client;
}
