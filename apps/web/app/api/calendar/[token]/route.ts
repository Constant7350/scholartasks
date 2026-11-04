import { createClient } from "@supabase/supabase-js";
import { buildIcs } from "../../../../lib/ics";

// A family member's private calendar feed (see migration 0027). Calendar apps
// fetch it every few hours, so deadlines added in ScholarTasks show up there
// by themselves. The token in the link is the only key; it can be replaced
// from the To-do list page.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("Not found", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return new Response("Calendar feed isn't switched on yet.", { status: 503 });
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.rpc("calendar_items", { p_token: token });
  if (error) return new Response("Try again later.", { status: 502 });
  const rows = (data as { item_type: string; item_id: string; student_first_name: string; title: string; due_on: string; url: string | null; done: boolean }[]) ?? [];
  const many = new Set(rows.map((r) => r.student_first_name)).size > 1;
  const appUrl = process.env.APP_URL ?? "https://scholartasks.com";
  const ics = buildIcs("ScholarTasks deadlines", rows.map((r) => ({
    uid: `${r.item_type}-${r.item_id}`,
    title: `${r.done ? "✓ " : ""}${many ? `${r.student_first_name}: ` : ""}${r.title}`,
    date: r.due_on,
    description: `Due for ${r.student_first_name}. Open your plan: ${appUrl}/todo`,
    url: r.url,
  })));
  return new Response(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" } });
}
