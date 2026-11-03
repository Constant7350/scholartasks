import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildScorecard, loadPacks, type CourseGrade } from "../src/node";

const packs = loadPacks(resolve(dirname(fileURLToPath(import.meta.url)), "../../../packs"));
const hope = packs.states.find((s) => s.state === "GA")!.gpa_formulas.ga_hope_gpa!;
const c = (course: string, grade: CourseGrade["grade"], gradeLevel: number, extra: Partial<CourseGrade> = {}): CourseGrade => ({
  term: "Fall", course, grade, level: "standard", core: true, gradeLevel, ...extra,
});
const card = (grades: CourseGrade[], currentGrade = 10, target = 3) => buildScorecard(grades, { currentGrade, formula: hope, target, rigorNeeded: 4 });

describe("GPA scorecard", () => {
  it("shows no GPA before any course", () => {
    const s = card([]);
    expect(s).toMatchObject({ stateGpa: null, overallGpa: null, status: "none", attention: [], rigorDone: 0 });
  });

  it("leaves 8th grade and electives out of HOPE but keeps them in the overall GPA", () => {
    const s = card([c("Algebra", "A", 8), c("Biology", "B", 9), c("Band", "C", 9, { core: false })]);
    expect(s.stateGpa).toBe(3);
    expect(s.overallGpa).toBe(3);
  });

  it("shows the trend against earlier years", () => {
    const s = card([c("Biology", "B", 9), c("Chemistry", "A", 10)]);
    expect(s.stateGpaBefore).toBe(3);
    expect(s.stateGpa).toBe(3.5);
  });

  it("flags this year's D and F first, then core grades under the goal", () => {
    const s = card([c("Old", "C", 9), c("Math", "C", 10), c("PE", "D", 10, { core: false }), c("English", "B", 10), c("Art", "C", 10, { core: false })]);
    expect(s.attention.map((a) => [a.course, a.severity])).toEqual([["PE", "urgent"], ["Math", "watch"]]);
  });

  it("a higher goal flags a B, and the status shows how close the GPA is", () => {
    const s = card([c("Math", "B", 10), c("English", "B", 10), c("History", "A", 10), c("Science", "A", 10)], 10, 3.7);
    expect(s.attention.map((a) => a.course)).toEqual(["English", "Math"]);
    expect(s.status).toBe("close");
    expect(card([c("Math", "C", 10)], 10, 3).status).toBe("below");
  });

  it("uses the latest year with grades when this year has none yet", () => {
    const s = card([c("Math", "D", 9)], 10);
    expect(s.attention.map((a) => a.course)).toEqual(["Math"]);
  });

  it("counts rigor courses", () => {
    expect(card([c("AP Bio", "B", 11, { level: "AP" }), c("DE English", "A", 11, { level: "DE" })], 11).rigorDone).toBe(2);
  });
});
