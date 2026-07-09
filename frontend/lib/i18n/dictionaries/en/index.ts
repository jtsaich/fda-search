import { common } from "./common";
import { auth } from "./auth";
import { nav } from "./nav";
import { chat } from "./chat";
import { documents } from "./documents";
import { users } from "./users";
import { roles } from "./roles";
import { systemPrompt } from "./systemPrompt";
import { roleLabels } from "./roleLabels";

/** English is the source of truth: its keys define the translation contract. */
export const en = {
  ...common,
  ...auth,
  ...nav,
  ...chat,
  ...documents,
  ...users,
  ...roles,
  ...systemPrompt,
  ...roleLabels,
} as const;
