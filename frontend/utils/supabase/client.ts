"use client";

import {
  createBrowserClient,
  type CookieMethodsBrowser,
  type CookieOptions,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
      options.expires instanceof Date
        ? options.expires.toUTCString()
        : typeof options.expires === "string"
        ? options.expires
        : typeof options.expires === "number"
        ? new Date(options.expires).toUTCString()
        : undefined;

    if (expires) {
      parts.push(`Expires=${expires}`);
    }
  }

  parts.push(`Path=${options?.path ?? "/"}`);

  if (options?.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options?.sameSite !== undefined) {
    const sameSite =
      options.sameSite === true
        ? "Strict"
        : options.sameSite === false
        ? undefined
        : options.sameSite === "lax"
        ? "Lax"
        : options.sameSite === "strict"
        ? "Strict"
        : options.sameSite === "none"
        ? "None"
        : options.sameSite;

    if (sameSite) {
      parts.push(`SameSite=${sameSite}`);
    }
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

const browserCookieMethods: CookieMethodsBrowser = {
  getAll() {
    if (typeof document === "undefined" || !document.cookie) {
      return [];
    }

    return document.cookie.split("; ").reduce<
      { name: string; value: string }[]
    >((acc, entry) => {
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
  },
  setAll(cookies) {
    if (typeof document === "undefined") {
      return;
    }

    cookies.forEach(({ name, value, options }) => {
      document.cookie = serializeCookie(name, value, options);
    });
  },
};

export function createClient() {
  if (!client) {
    client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: browserCookieMethods,
    });
  }

  return client;
}
