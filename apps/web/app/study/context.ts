import type { SupabaseClient } from "@supabase/supabase-js";

export interface StudyStudent { id: string; first_name: string; grade_level: number }
export interface StudyContext { role: "parent" | "student" | null; students: StudyStudent[]; own: string | null; done: Record<string, string[]>; reviews: Record<string, "approved" | "changes"> }

/** Who is looking, their students, which lessons each finished, and which lessons a teacher approved. */
export async function loadStudy(sb: SupabaseClient, userId: string): Promise<StudyContext> {
  const [mem, st, pr, rv] = await Promise.all([
    sb.from("family_members").select("role, student_id").eq("user_id", userId),
    sb.from("students").select("id, first_name, grade_level").order("first_name"),
    sb.from("lesson_progress").select("student_id, lesson_id"),
    sb.from("lesson_reviews").select("lesson_id, status"),
  ]);
  const m = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
  const done: Record<string, string[]> = {};
  for (const r of (pr.data as { student_id: string; lesson_id: string }[]) ?? []) (done[r.student_id] ??= []).push(r.lesson_id);
  const reviews: StudyContext["reviews"] = {};
  for (const r of (rv.data as { lesson_id: string; status: "approved" | "changes" }[]) ?? []) reviews[r.lesson_id] = r.status;
  return {
    role: m.some((r) => r.role === "parent") ? "parent" : m.some((r) => r.role === "student") ? "student" : null,
    students: (st.data as StudyStudent[]) ?? [],
    own: m.find((r) => r.role === "student")?.student_id ?? null,
    done, reviews,
  };
}
