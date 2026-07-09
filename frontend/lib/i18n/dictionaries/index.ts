import type { Locale } from "../config";
import { en } from "./en";
import { zhCN } from "./zh-CN";

export type TranslationKey = keyof typeof en;

export const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  "zh-CN": zhCN,
};
