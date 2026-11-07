import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A family's students who haven't graduated, oldest grade first. Graduated students keep their
 * account but don't count toward the Family plan price or level. Works before database update 67
 * (no graduated_on column yet) by counting everyone.
 */
export async function currentStudents<T extends { grade_level: number; first_name?: string }>(sb: SupabaseClient, familyId: string, cols: string): Promise<T[]> {
  const q = (c: string) => sb.from("students").select(c).eq("family_id", familyId)
    .order("grade_level", { ascending: false }).order("first_name");
  const r = await q(cols + ", graduated_on");
  if (!r.error) return ((r.data ?? []) as unknown as (T & { graduated_on: string | null })[]).filter((s) => !s.graduated_on);
  return ((await q(cols)).data ?? []) as unknown as T[];
}
