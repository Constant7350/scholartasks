import type { SupabaseClient } from "@supabase/supabase-js";
import type { CollegeFacts, CostInput, CourseGrade, IncomeBand } from "@scholartasks/core";
import { checkStatePrograms, packFor } from "./state-packs";

/** A row of the colleges table (College Scorecard data). */
export interface CollegeRow {
  id: number; name: string; city: string | null; state: string; url: string | null; price_calc_url: string | null;
  ownership: number; degree: number | null; size: number | null; admit_rate: number | null; sat_avg: number | null; act_mid: number | null;
  tuition_in: number | null; tuition_out: number | null; cost_attendance: number | null; avg_net_price: number | null;
  net_price: (number | null)[]; grad_rate: number | null; earnings: number | null; median_debt: number | null;
  programs: Record<string, number>; data_year: string | null;
  /** Scorecard religious affiliation code (null when none); see faithLabel in core. */
  religious_affiliation?: number | null;
}

export const toFacts = (r: CollegeRow): CollegeFacts => ({
  id: r.id, name: r.name, state: r.state, ownership: r.ownership, size: r.size,
  admitRate: r.admit_rate == null ? null : Number(r.admit_rate), satAvg: r.sat_avg, actMid: r.act_mid,
  tuitionIn: r.tuition_in, tuitionOut: r.tuition_out, costOfAttendance: r.cost_attendance, avgNetPrice: r.avg_net_price,
  netPriceByIncome: r.net_price ?? [], programs: r.programs ?? {}, religiousAffiliation: r.religious_affiliation ?? null,
});

export const OWNERSHIP: Record<number, string> = { 1: "Public", 2: "Private", 3: "For-profit" };
export const money = (n: number | null | undefined) => (n == null ? "—" : `$${Math.round(n).toLocaleString()}`);
export const pct = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(Number(n) * 100)}%`);

export interface CostStudent {
  id: string; state: string; grade_level: number; sat: number | null; act: number | null;
  income_band: IncomeBand | null; outside_awards?: number | null; permissions?: Record<string, boolean>;
}

/**
 * What the cost estimate needs about this student: home state, income range
 * (only when this viewer may see it), state scholarship standing (HOPE, Bright Futures...) and outside awards.
 */
export async function costInput(sb: SupabaseClient, s: CostStudent, mayUseIncome: boolean): Promise<CostInput> {
  const pack = packFor(s.state);
  let statePrograms: CostInput["statePrograms"] = [];
  if (pack) {
    const { data } = await sb.from("course_grades").select("term, course, grade, level, core, grade_level").eq("student_id", s.id);
    const grades: CourseGrade[] = ((data as { term: string; course: string; grade: CourseGrade["grade"]; level: CourseGrade["level"]; core: boolean; grade_level: number }[]) ?? [])
      .map((g) => ({ term: g.term, course: g.course, grade: g.grade, level: g.level, core: g.core, gradeLevel: g.grade_level }));
    statePrograms = checkStatePrograms(s, grades);
  }
  return {
    homeState: s.state,
    incomeBand: mayUseIncome ? s.income_band : null,
    statePrograms,
    pack,
    outsideAwards: s.outside_awards ?? null,
  };
}

/** Typeahead search by name; biggest colleges first. */
export async function searchColleges(sb: SupabaseClient, q: string, limit = 8): Promise<CollegeRow[]> {
  const term = q.trim().replace(/[%_,()]/g, " ");
  if (term.length < 2) return [];
  const { data } = await sb.from("colleges").select("*").ilike("name", `%${term.split(/\s+/).join("%")}%`).order("size", { ascending: false, nullsFirst: false }).limit(limit);
  return (data as CollegeRow[]) ?? [];
}
