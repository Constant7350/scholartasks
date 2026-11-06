// Language: English or Spanish. The choice is kept in a cookie so the server
// (AI features) and every page see the same choice. Works with no sign-in.
export type Lang = "en" | "es";
export const LANG_COOKIE = "st-lang";

export function langFromCookie(cookie: string | null | undefined): Lang {
  const m = (cookie ?? "").match(/(?:^|;\s*)st-lang=(en|es)\b/);
  return m?.[1] === "es" ? "es" : "en";
}

export const langOf = (req: Request): Lang => langFromCookie(req.headers.get("cookie"));

/** Added to an AI system prompt so the reply comes back in the family's language. */
export function aiLanguageNote(req: Request): string {
  return langOf(req) === "es"
    ? "\n\nLANGUAGE: The family uses ScholarTasks in Spanish. Write every word a person will read (including every text field in JSON) in clear, warm, plain Latin American Spanish. Keep official names as they are (FAFSA, HOPE, Zell Miller, GAfutures, SAT, ACT, AP, Common App) and explain them in Spanish the first time."
    : "";
}
