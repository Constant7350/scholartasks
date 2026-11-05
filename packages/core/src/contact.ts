/** Who is writing in through the public contact form. */
export const CONTACT_TOPICS = ["Parent or family", "Student", "School or counselor", "Something else"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export interface ContactMessage { name: string; email: string; topic: ContactTopic; message: string; school?: string }

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * Checks a contact form before it is emailed to the team.
 * Returns the cleaned message, or a plain-language error to show the visitor.
 * `spam: true` means the hidden trap field was filled in (a bot): pretend it worked and drop it.
 */
export function checkContact(body: unknown): { ok: true; msg: ContactMessage } | { ok: false; error: string; spam?: boolean } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (clean(b.website, 200)) return { ok: false, error: "", spam: true };
  const name = clean(b.name, 100);
  const email = clean(b.email, 200);
  const school = clean(b.school, 150);
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 5000) : "";
  const topic = (CONTACT_TOPICS as readonly string[]).includes(b.topic as string) ? (b.topic as ContactTopic) : "Something else";
  if (!name) return { ok: false, error: "Please add your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Please check your email address so we can write back." };
  if (message.length < 5) return { ok: false, error: "Please write a short message." };
  // Links are the usual sign of spam; real questions rarely need more than a couple.
  if ((message.match(/https?:\/\//gi) ?? []).length > 3) return { ok: false, error: "Please take out some of the links and try again." };
  return { ok: true, msg: { name, email, topic, message, ...(school ? { school } : {}) } };
}
