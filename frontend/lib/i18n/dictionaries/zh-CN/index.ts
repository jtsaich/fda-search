import type { en } from "../en";
import { common } from "./common";
import { auth } from "./auth";
import { nav } from "./nav";
import { chat } from "./chat";
import { documents } from "./documents";
import { users } from "./users";
import { roles } from "./roles";
import { systemPrompt } from "./systemPrompt";
import { roleLabels } from "./roleLabels";

/**
 * Simplified Chinese. Typed against the English key set so the build fails if
 * any key is left untranslated.
 */
export const zhCN: Record<keyof typeof en, string> = {
  ...common,
  ...auth,
  ...nav,
  ...chat,
  ...documents,
  ...users,
  ...roles,
  ...systemPrompt,
  ...roleLabels,
};
