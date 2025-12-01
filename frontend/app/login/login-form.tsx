"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";

type Mode = "signIn" | "signUp";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function syncServerAuth(
    event: "SIGNED_IN" | "TOKEN_REFRESHED",
    session: Session | null
  ): Promise<Response | null> {
    try {
      const response = await fetch("/auth/callback", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, session }),
      });
      return response;
    } catch (syncError) {
      console.error("Failed to sync auth session with server:", syncError);
      return null;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === "signIn") {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (signInError) {
          throw signInError;
        }

        const response = await syncServerAuth("SIGNED_IN", data.session);
        if (!response?.ok) {
          throw new Error("Failed to sync authentication session");
        }
        window.location.assign("/");
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.session) {
          const response = await syncServerAuth("SIGNED_IN", data.session);
          if (!response?.ok) {
            throw new Error("Failed to sync authentication session");
          }
          window.location.assign("/");
          return;
        }

        setMessage("Check your email to confirm your account.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-200">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {mode === "signIn" ? "Sign in to continue" : "Create your account"}
        </h1>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "signIn" ? "current-password" : "new-password"
              }
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {mode === "signIn" && (
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </Link>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signIn" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 text-center">
          {mode === "signIn" ? (
            <button
              type="button"
              onClick={() => {
                setMode("signUp");
                setError(null);
                setMessage(null);
              }}
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Need an account? Sign up
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("signIn");
                setError(null);
                setMessage(null);
              }}
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Already registered? Sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
