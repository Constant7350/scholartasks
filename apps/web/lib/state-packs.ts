import { StateAgencies, classOf, evaluateStatePrograms, primaryGpa, type CourseGrade, type GpaFormula, type ProgramResult, type StatePack } from "@scholartasks/core";
import AL from "../../../packs/states/AL.json";
import AR from "../../../packs/states/AR.json";
import FL from "../../../packs/states/FL.json";
import GA from "../../../packs/states/GA.json";
import KY from "../../../packs/states/KY.json";
import LA from "../../../packs/states/LA.json";
import MS from "../../../packs/states/MS.json";
import NC from "../../../packs/states/NC.json";
import SC from "../../../packs/states/SC.json";
import TN from "../../../packs/states/TN.json";
import VA from "../../../packs/states/VA.json";
import agenciesJson from "../../../packs/federal/state-agencies.json";
import { STATE_NAMES } from "./trades";

/**
 * Every state pack the app knows. Adding a state = add packs/states/XX.json and one import above
 * (a core test fails if a pack file is missing here). Nothing else in the app names a state.
 */
export const STATE_PACKS: Record<string, StatePack> = Object.fromEntries(
  [AL, AR, FL, GA, KY, LA, MS, NC, SC, TN, VA].map((p) => [p.state, p as unknown as StatePack]),
);

const AGENCIES = StateAgencies.parse(agenciesJson).agencies;

/** The pack for a student's state, or null when the state has no pack yet. */
export function packFor(state: string | null | undefined): StatePack | null {
  return (state && STATE_PACKS[state.toUpperCase()]) || null;
}

export const stateName = (state: string | null | undefined) => (state ? STATE_NAMES[state.toUpperCase()] ?? state : "your state");

/** States with full state aid details, sorted by name, for pickers and lists. */
export const PACKED_STATES = Object.values(STATE_PACKS).sort((a, b) => a.name.localeCompare(b.name));

/** Where a family in any state finds its state aid office (pack agency, the directory, or a search). */
export function aidOfficeFor(state: string | null | undefined): { name: string; url: string; programs: string[]; site?: { name: string; url: string } } {
  const pack = packFor(state);
  if (pack) return { name: pack.agency.name, url: pack.agency.url, programs: pack.programs.map((p) => p.name), site: pack.aid_site };
  const a = AGENCIES.find((x) => x.state === state?.toUpperCase());
  if (a) return { name: a.name, url: a.url, programs: a.programs };
  const n = stateName(state);
  return { name: `${n} state financial aid office`, url: `https://www.google.com/search?q=${encodeURIComponent(`${n} state student financial aid agency`)}`, programs: [] };
}

/** Name families know for the state's scholarship GPA ("HOPE GPA", "Bright Futures GPA"), or a plain "GPA". */
export function gpaLabel(state: string | null | undefined): string {
  return primaryGpa(packFor(state))?.label ?? "GPA";
}

/** The state's grade-based scholarships in a few words, e.g. "HOPE Scholarship and Zell Miller Scholarship". */
export function meritNames(pack: StatePack | null): string {
  if (!pack) return "state scholarships";
  const names = pack.programs.filter((p) => p.rules.gpa_formula || p.rules.tests_any).map((p) => p.name.replace(/ \(.*\)$/, ""));
  if (!names.length) return `${pack.name} grants`;
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and more`;
}

/** Checks the state's grade-based scholarships for one student (empty when the state has no pack). */
export function checkStatePrograms(
  s: { state: string; grade_level: number; sat?: number | null; act?: number | null },
  grades: CourseGrade[],
  today = new Date().toLocaleDateString("en-CA"),
): ProgramResult[] {
  const pack = packFor(s.state);
  if (!pack) return [];
  return evaluateStatePrograms(
    { state: pack.state, gradeLevel: s.grade_level, grades, sat: s.sat ?? undefined, act: s.act ?? undefined, classOf: classOf(s.grade_level, today) },
    pack,
  );
}

/** For states with no grade-based state scholarship: every course, unweighted. */
export const PLAIN_GPA: GpaFormula = {
  label: "GPA", description: "Every course, unweighted (A = 4).", courses: "all", grade_levels: [6, 7, 8, 9, 10, 11, 12],
  scale: { A: 4, B: 3, C: 2, D: 1, F: 0 }, weights: [], rounding: "none",
};
