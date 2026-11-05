import type { SupabaseClient } from "@supabase/supabase-js";
import { FAMILY_DAILY_LIMIT, FREE_DAILY_LIMIT, PAYWALL_ON, STUDY_COACH_DAILY_LIMIT } from "./prices";

/**
 * How many AI uses a day this person gets, from the family's plan. While
 * PAYWALL_ON is false (beta) everyone gets the Family plan's amount.
 * Pass tutor=true for practice-tutor help, which the Homework Helper add-on raises.
 */
export async function aiDailyLimit(sb: SupabaseClient, studentId: string | null, tutor = false): Promise<number> {
  const plan = await sb.rpc("my_plan", { p_student: studentId });
  const row = plan.error ? null : (plan.data as { family_plan: boolean; study_coach: boolean }[] | null)?.[0];
  if (tutor && row?.study_coach) return STUDY_COACH_DAILY_LIMIT;
  if (!PAYWALL_ON || row?.family_plan) return FAMILY_DAILY_LIMIT;
  return FREE_DAILY_LIMIT;
}
