import type { SupabaseClient } from "@supabase/supabase-js";
import { compile, lookup, type Dict } from "./i18n/core";

// Reminder emails and texts in each person's language (saved when they pick English
// or Español in the menu). The English lines are translated with the same Spanish word
// list as the app, including our reviewers' fixes from the check page. Server only.

export type MailLang = "en" | "es";

/** Each person's saved language; English when they never picked one. */
export async function langsFor(sb: SupabaseClient, userIds: string[]): Promise<Map<string, MailLang>> {
  const out = new Map<string, MailLang>();
  if (!userIds.length) return out;
  const { data } = await sb.from("user_settings").select("user_id, lang").in("user_id", userIds);
  for (const r of (data as { user_id: string; lang: string }[] | null) ?? []) out.set(r.user_id, r.lang === "es" ? "es" : "en");
  return out;
}

/** Returns a function that turns an English line into the person's language. */
export async function wordsFor(sb: SupabaseClient, need: boolean): Promise<(lang: MailLang, en: string) => string> {
  if (!need) return (_l, en) => en;
  const { ES } = await import("./i18n/es");
  const fixes: Dict = {};
  const { data } = await sb.rpc("i18n_fixes");
  for (const r of (data as { en: string; es: string }[] | null) ?? []) fixes[r.en] = r.es;
  const c = compile({ ...ES, ...fixes });
  return (lang, en) => (lang === "es" ? lookup(c, en) ?? en : en);
}

export const whenDue = (n: number, l: MailLang) =>
  l === "es" ? (n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`) : n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;

/** College deadlines are named in the database as "UGA application (EA)". */
export const itemTitle = (title: string, l: MailLang) =>
  l === "es" ? title.replace(/^(.*) application( \([^)]*\))?$/, "Solicitud a $1$2") : title;
