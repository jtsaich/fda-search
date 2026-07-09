import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from "@/utils/supabase/server";
import { SupabaseListener } from "@/components/SupabaseListener";
import { Toaster } from "@/components/ui/sonner";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/i18n-provider";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aves AI Hub",
  description: "",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  // Use getUser() for secure authentication check
  // Note: We still need getSession() for the access_token to pass to SupabaseListener
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider initialLocale={locale}>
          <SupabaseListener serverAccessToken={session?.access_token} />
          {children}
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
