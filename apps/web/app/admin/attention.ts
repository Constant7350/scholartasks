"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { LESSONS } from "../study/lessons";
import { mondayOf } from "./marketing/social";

/**
 * How many things on each team page still need someone to look at them.
 * Shown as a red number in the team menu and on the Team admin home cards.
 * Each rule matches what the page itself calls "waiting". A count that can't be
 * read (for example, a database update not run yet) counts as 0.
 */
export type Attention = Record<string, number>;

const n = (r: { count: number | null; error: unknown }) => (r.error ? 0 : r.count ?? 0);
const head = { count: "exact" as const, head: true };

export async function loadAttention(sb: SupabaseClient): Promise<Attention> {
  const weekAgo = Date.now() - 7 * 86400000;
  const [answers, questions, lessons, schUpdates, schNew, trades, openPending, openReported, employers, schools, consents, social] = await Promise.all([
    sb.from("answer_bank").select("id", head).eq("status", "pending"),
    sb.from("practice_questions").select("id", head).eq("status", "pending"),
    sb.from("lesson_reviews").select("lesson_id, status"),
    sb.from("scholarship_updates").select("id", head).eq("status", "pending"),
    sb.from("scholarships").select("id", head).in("status", ["pending", "found"]),
    sb.from("trade_checks").select("subject", head).eq("status", "review"),
    sb.from("local_openings").select("id", head).eq("status", "pending"),
    sb.from("local_openings").select("id", head).eq("status", "hidden").gt("reports", 0),
    sb.from("employers").select("id", head).eq("status", "pending"),
    sb.rpc("schools_for_review"),
    sb.rpc("consent_audit_trail", { p_limit: 500 }),
    sb.from("social_items").select("id", head).eq("week_of", mondayOf(new Date())).eq("status", "draft"),
  ]);

  const approved = new Set(((lessons.data as { lesson_id: string; status: string }[] | null) ?? []).filter((r) => r.status === "approved").map((r) => r.lesson_id));
  const rows = <T,>(r: { data: unknown; error: unknown }) => (r.error || !Array.isArray(r.data) ? [] : (r.data as T[]));

  return {
    "/admin/answers": n(answers),
    "/admin/questions": n(questions),
    "/admin/lessons": lessons.error ? 0 : LESSONS.filter((l) => !approved.has(l.id)).length,
    "/admin/scholarships": n(schUpdates) + n(schNew),
    "/admin/trades": n(trades),
    "/admin/openings": n(openPending) + n(openReported) + n(employers),
    "/admin/schools": rows<{ status: string }>(schools).filter((s) => s.status === "pending").length,
    "/admin/consents": rows<{ action: string; at: string }>(consents).filter((r) => r.action === "consent_identity_failed" && new Date(r.at).getTime() > weekAgo).length,
    "/admin/marketing": n(social),
  };
}

/** Words for the red number, for screen readers and the hover tip. */
export function attentionLabel(href: string, count: number): string {
  const what: Record<string, string> = {
    "/admin/consents": "failed identity checks this week",
    "/admin/marketing": "social media drafts this week to read",
  };
  return `${count} ${what[href] ?? "waiting for review"}`;
}
