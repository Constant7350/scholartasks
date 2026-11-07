/**
 * What the AI counselor and the Homework Helper are told about a student's stage and dreams
 * (Constant, 2026-11-07: one app, same AI background, but each grade only hears about its own step).
 * Safe to import on the server: no React, no browser APIs.
 */
import { stageOf, type Stage } from "../app/nav";

/** Dream board saved in students.match_profile.dreams (set from Home / the career quiz result). */
export interface DreamBoard {
  /** Up to three careers or dreams in the student's own words. */
  wants: string[];
  /** Someone they admire and why, optional. */
  admire?: string;
  /** ISO date it was last updated. */
  at: string;
}

const STAGE_TEXT: Record<Stage, string> = {
  explore:
    "Stage: EXPLORE (grades 6 to 8). Lead with interests, study habits, reading, clubs, sports, summer ideas and what to try next. " +
    "Turn any career dream into plain next steps for this year and into which high school classes and activities lead there. " +
    "Do not bring up admissions odds, test scores, deadlines, FAFSA or college costs unless the parent asks; if they ask, answer fully and then return to this year's step. " +
    "Praise effort and curiosity, keep answers short and concrete, and suggest one thing to try this week.",
  build:
    "Stage: BUILD (grades 9 and 10). Lead with course choices and rigor, depth in two or three activities, a service log, the PSAT, dual enrollment and career pathway classes, " +
    "and a first honest look at what college or training costs and how state aid works. Keep college lists and deadlines light: a wish list is enough until grade 11.",
  apply:
    "Stage: APPLY (grades 11 and 12). Full college, trade, military and aid advice: college list and deadlines, essays, recommendations, tests, scholarships, FAFSA and offers.",
};

/** One paragraph for the system briefing: the student's stage and how to talk at it. */
export function stageBrief(grade: number | null | undefined): string {
  return STAGE_TEXT[stageOf(grade)];
}

/** One line about the student's dream board, or null when they have not filled it in yet. */
export function dreamLine(profile: { dreams?: DreamBoard | null } | null | undefined): string | null {
  const d = profile?.dreams;
  const wants = (d?.wants ?? []).map((w) => w.trim()).filter(Boolean);
  if (!wants.length && !d?.admire) return null;
  const parts = [];
  if (wants.length) parts.push(`Dream board (${d!.at}): ${wants.join("; ")}.`);
  if (d?.admire) parts.push(`Someone they admire: ${d.admire}.`);
  parts.push("Connect advice back to these dreams when it fits (which classes, activities, training or colleges lead there), update them if the student says they have changed, and never treat them as a limit.");
  return parts.join(" ");
}
