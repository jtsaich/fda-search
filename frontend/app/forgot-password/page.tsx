"use client";

import { useState, FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/components/i18n-provider";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const { t } = useTranslation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setMessage(t("auth.checkEmailReset"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.sendResetFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg border border-gray-200">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("auth.backToLogin")}
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          {t("auth.resetYourPassword")}
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          {t("auth.resetInstructions")}
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t("common.email")}
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
            {t("auth.sendResetLink")}
          </button>
        </form>
      </div>
    </div>
  );
}
