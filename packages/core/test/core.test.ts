import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildReminders,
  checkStatePack,
  computeGpa,
  displayGpa,
  evaluateStatePrograms,
  loadPacks,
  regionsForState,
  selectableStates,
  type CourseGrade,
  type StatePack,
} from "../src/node";

const packs = loadPacks(resolve(dirname(fileURLToPath(import.meta.url)), "../../../packs"));
const GA = packs.states.find((s) => s.state === "GA")!;
const hope = GA.gpa_formulas.ga_hope_gpa!;

const course = (grade: CourseGrade["grade"], level: CourseGrade["level"] = "standard", extra: Partial<CourseGrade> = {}): CourseGrade => ({
  term: "2026-fall",
  course: "x",
  grade,
  level,
  core: true,
  gradeLevel: 10,
  ...extra,
});

describe("packs", () => {
  it("loads and validates every pack", () => {
    expect(GA.programs.map((p) => p.id)).toEqual(["ga-hope", "ga-zell"]);
    expect(regionsForState(packs, "GA").map((r) => r.id)).toEqual(["ACM"]);
  });

  it("only lists live states at sign-up, beta states for invited schools", () => {
    const live = { ...GA, status: "live" as const };
    const beta = { ...GA, state: "FL", status: "beta" as const };
    const set = { states: [GA, live, beta], regions: packs.regions };
    expect(selectableStates(set).map((s) => s.status)).toEqual(["live"]);
    expect(selectableStates(set, { invited: true }).map((s) => s.state)).toEqual(["GA", "FL"]);
  });

  it("refuses a live pack that was never verified", () => {
    const bad: StatePack = { ...GA, status: "live" };
    expect(checkStatePack(bad)).toContain("a live pack must have verification.last_verified");
  });

  it("catches a program that points to a missing GPA formula", () => {
    const bad: StatePack = { ...GA, programs: [{ ...GA.programs[0]!, rules: { gpa_formula: "nope", min_gpa: 3 } }] };
    expect(checkStatePack(bad)).toContain("ga-hope: unknown gpa_formula nope");
  });
});

describe("Georgia HOPE GPA", () => {
  it("uses a flat 4.0 scale", () => {
    expect(computeGpa([course("A"), course("B"), course("C")], hope).gpa).toBe(3);
  });

  it("adds 0.5 to B-F grades in AP, IB and dual enrollment, but not to A", () => {
    expect(computeGpa([course("A", "AP")], hope).gpa).toBe(4);
    expect(computeGpa([course("B", "AP")], hope).gpa).toBe(3.5);
    expect(computeGpa([course("C", "DE")], hope).gpa).toBe(2.5);
  });

  it("gives honors classes no extra weight", () => {
    expect(computeGpa([course("B", "honors")], hope).gpa).toBe(3);
  });

  it("ignores non-core courses and grades before 9th", () => {
    const r = computeGpa([course("A"), course("F", "standard", { core: false }), course("F", "standard", { gradeLevel: 8 })], hope);
    expect(r).toEqual({ gpa: 4, coursesCounted: 1 });
  });

  it("never rounds up: 2.996 shows as 2.99", () => {
    expect(displayGpa(2.996)).toBe("2.99");
  });
});

describe("eligibility", () => {
  const strong = [course("A", "AP"), course("A", "AP"), course("A", "IB"), course("B", "DE"), course("A")];

  it("Zell Miller needs the test score too", () => {
    const res = evaluateStatePrograms({ state: "GA", gradeLevel: 12, grades: strong, sat: 1150 }, GA);
    const [h, z] = res;
    expect(h!.status).toBe("eligible");
    expect(z!.status).toBe("on_track");
    expect(z!.gaps.map((g) => g.message)).toEqual(["Needs 1200 SAT or 25 ACT."]);
  });

  it("either SAT or ACT is enough", () => {
    const res = evaluateStatePrograms({ state: "GA", gradeLevel: 12, grades: strong, act: 26 }, GA);
    expect(res.every((r) => r.status === "eligible")).toBe(true);
  });

  it("explains every gap for a student who is not there yet", () => {
    const grades = [course("B"), course("C"), course("B", "AP")];
    const zell = evaluateStatePrograms({ state: "GA", gradeLevel: 10, grades }, GA)[1]!;
    expect(zell.gaps.map((g) => g.kind)).toEqual(["gpa", "rigor", "test"]);
    expect(zell.gaps[0]!.message).toBe("Needs a 3.7 GPA; currently 2.83.");
  });

  it("asks for grades when none are entered", () => {
    const h = evaluateStatePrograms({ state: "GA", gradeLevel: 9, grades: [] }, GA)[0]!;
    expect(h.gaps[0]!.message).toBe("Enter grades to check the 3.0 GPA requirement.");
  });
});

describe("reminders", () => {
  it("schedules a heads-up and an opening-day reminder for the FAFSA", () => {
    const r = buildReminders(GA.deadlines, { today: "2027-09-01", gradeLevel: 12 }).filter((x) => x.deadlineId.includes("fafsa"));
    expect(r.map((x) => x.sendOn)).toEqual(["2027-09-24", "2027-10-01"]);
    expect(r[1]!.what).toBe("FAFSA is open today. File the 2028-29 FAFSA (needed for Pell Grants; also counts for HOPE).");
    expect(r[0]!.documents.length).toBeGreaterThan(0);
  });

  it("uses the 30/14/7/2/1/0-day schedule for real deadlines and skips past dates", () => {
    const d = [{ id: "x", title: "Scholarship X", form: "X", date: "2027-03-01", kind: "deadline" as const, where: "https://example.org", documents: [], grade_levels: [12] }];
    const r = buildReminders(d, { today: "2027-02-20", gradeLevel: 12 });
    expect(r.map((x) => x.daysBefore)).toEqual([7, 2, 1, 0]);
    expect(r[0]!.what).toBe("Scholarship X is due in 7 days.");
  });

  it("does not send senior reminders to a 10th grader", () => {
    expect(buildReminders(GA.deadlines, { today: "2027-09-01", gradeLevel: 10 })).toEqual([]);
  });
});
