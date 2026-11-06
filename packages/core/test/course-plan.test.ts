import { describe, expect, it } from "vitest";
import { bucketOf, checkPlan, languageOf, type PlanCourse } from "../src";

const year = (grade: number, extra: Partial<PlanCourse>[] = []): PlanCourse[] => [
  { grade, course: `English ${grade}`, subject: "English", level: "standard" },
  { grade, course: `Math ${grade}`, subject: "Math", level: "standard" },
  { grade, course: `Science ${grade}`, subject: "Science", level: "standard" },
  { grade, course: `History ${grade}`, subject: "Social Studies", level: "standard" },
  { grade, course: `Spanish ${grade}`, subject: "World Languages", level: "standard" },
  ...extra.map((e, i) => ({ grade, course: `Elective ${grade}-${i}`, subject: "Career and Electives", level: "standard" as const, ...e })),
];

describe("course planner", () => {
  it("sorts subjects into requirements", () => {
    expect(bucketOf("English")).toBe("english");
    expect(bucketOf("Computer Science")).toBe("pathway");
    expect(bucketOf("Science")).toBe("science");
    expect(bucketOf("Health and PE")).toBe("health_pe");
    expect(bucketOf(null)).toBe("elective");
    expect(languageOf("AP Spanish Language and Culture")).toBe("spanish");
  });

  it("passes a full Georgia plan with four rigor courses", () => {
    const plan = [
      ...year(9, [{ subject: "Health and PE", course: "Health" }]),
      ...year(10, [{}]),
      ...year(11, [{ course: "AP Biology", subject: "Science", level: "AP" }, { course: "AP US History", subject: "Social Studies", level: "AP" }]),
      ...year(12, [{ course: "AP Calculus AB", subject: "Math", level: "AP" }, { course: "AP Literature", subject: "English", level: "AP" }]),
    ];
    const c = checkPlan(plan, { state: "GA", rigorNeeded: 4, rigorLevels: ["AP", "IB", "DE"] });
    expect(c.rules.total).toBe(23);
    expect(c.rigorPlanned).toBe(4);
    expect(c.lines.find((l) => l.label === "Total credits")).toMatchObject({ planned: 26, ok: true });
    expect(c.ready).toBe(true);
    expect(c.sameLanguageYears).toBe(4);
  });

  it("flags missing credits, heavy years and no senior math", () => {
    const plan: PlanCourse[] = [
      ...year(9), ...year(10), ...year(11),
      ...["A", "B", "C", "D", "E"].map((x) => ({ grade: 12, course: `AP ${x}`, subject: "Science", level: "AP" as const })),
    ];
    const c = checkPlan(plan, { state: "GA", rigorNeeded: 4 });
    expect(c.ready).toBe(false);
    expect(c.lines.find((l) => l.label === "Health and PE")?.ok).toBe(false);
    expect(c.warnings.join(" ")).toMatch(/very heavy year/);
    expect(c.warnings.join(" ")).toMatch(/no math in grade 12/);
  });

  it("uses the typical plan for other states", () => {
    expect(checkPlan([], { state: "OH" }).rules.total).toBe(22);
  });
});
