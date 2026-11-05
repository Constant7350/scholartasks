import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { checkablePrograms, evaluateStatePrograms, loadPacks, primaryGpa, type CourseGrade, type StatePack } from "../src/node";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const packs = loadPacks(resolve(root, "packs"));
const pack = (st: string) => packs.states.find((s) => s.state === st)!;

const course = (grade: CourseGrade["grade"], level: CourseGrade["level"] = "standard"): CourseGrade => ({
  term: "fall", course: "x", grade, level, core: true, gradeLevel: 11,
});
const straight = (grade: CourseGrade["grade"], n = 8, level: CourseGrade["level"] = "standard") => Array.from({ length: n }, () => course(grade, level));
const check = (st: string, grades: CourseGrade[], scores: { sat?: number; act?: number; classOf?: number } = {}) =>
  Object.fromEntries(evaluateStatePrograms({ state: st, gradeLevel: 11, grades, ...scores }, pack(st)).map((r) => [r.programId, r]));

describe("Southeast state packs", () => {
  it("has every Southeast state", () => {
    expect(packs.states.map((s) => s.state).sort()).toEqual(["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "SC", "TN", "VA"]);
  });

  it("is wired into the website (apps/web/lib/state-packs.ts imports every pack file)", () => {
    const lib = readFileSync(resolve(root, "apps/web/lib/state-packs.ts"), "utf8");
    for (const f of readdirSync(resolve(root, "packs/states")).filter((f) => f.endsWith(".json")))
      expect(lib, `packs/states/${f} is not imported in apps/web/lib/state-packs.ts`).toContain(`packs/states/${f}`);
  });

  it("gives every pack an aid office, sources and a label for its scholarship GPA", () => {
    for (const p of packs.states) {
      expect(p.agency.url).toMatch(/^https:\/\//);
      for (const prog of p.programs) expect(prog.source_url).toMatch(/^https:\/\//);
      const main = primaryGpa(p as StatePack);
      if (main) expect(main.formula.label, p.state).toBeTruthy();
    }
  });

  it("lists need-based grants but only checks grade-based awards", () => {
    expect(checkablePrograms(pack("NC"))).toEqual([]);
    expect(primaryGpa(pack("NC"))).toBeNull();
    expect(check("NC", straight("A"))).toEqual({});
  });

  it("Tennessee HOPE: a 3.0 GPA or a 21 ACT is enough", () => {
    expect(check("TN", straight("B"))["tn-hope"]!.status).toBe("eligible");
    expect(check("TN", straight("C"), { act: 21 })["tn-hope"]!.status).toBe("eligible");
    const neither = check("TN", straight("C"), { act: 18 })["tn-hope"]!;
    expect(neither.status).toBe("on_track");
    expect(neither.gaps).toHaveLength(1);
    expect(neither.gaps[0]!.message).toMatch(/^Meet one of these: Needs a 3\.0 GPA.* or Needs 1060 SAT or 21 ACT\.$/);
  });

  it("South Carolina LIFE: 2 of 3 (GPA, test, class rank)", () => {
    const both = check("SC", straight("B"), { sat: 1100 })["sc-life"]!;
    expect(both.status).toBe("eligible");
    const oneOnly = check("SC", straight("B"), { sat: 1000 })["sc-life"]!;
    expect(oneOnly.status).toBe("on_track");
    expect(oneOnly.gaps[0]!.kind).toBe("check");
    expect(oneOnly.gaps[0]!.message).toMatch(/top 30%/);
    // Palmetto Fellows always needs the class rank as well.
    const palmetto = check("SC", straight("A", 8, "AP"), { sat: 1300 })["sc-palmetto"]!;
    expect(palmetto.status).toBe("on_track");
    expect(palmetto.gaps.map((g) => g.kind)).toEqual(["check"]);
  });

  it("Florida Bright Futures: honors weighting, service hours as a check, class of 2028 scores", () => {
    const fl = pack("FL");
    const gpa = check("FL", [...straight("B", 4, "honors"), ...straight("B", 4)])["fl-fas"]!.gpa;
    expect(gpa).toBeCloseTo(3.25);
    const fas27 = check("FL", straight("A"), { sat: 1340, classOf: 2027 })["fl-fas"]!;
    expect(fas27.status).toBe("eligible");
    expect(fas27.checks.join(" ")).toMatch(/100 hours/);
    const fas28 = check("FL", straight("A"), { sat: 1340, classOf: 2028 })["fl-fas"]!;
    expect(fas28.status).toBe("on_track");
    expect(fas28.gaps[0]!.message).toBe("Needs 1350 SAT or 29 ACT.");
    expect(primaryGpa(fl)!.label).toBe("Bright Futures GPA");
  });

  it("Louisiana TOPS: each level by GPA and ACT", () => {
    const r = check("LA", [...straight("B", 4), ...straight("A", 4)], { act: 23 });
    expect(r["la-tops-opportunity"]!.status).toBe("eligible");
    expect(r["la-tops-performance"]!.status).toBe("eligible");
    expect(r["la-tops-honors"]!.status).toBe("on_track");
  });

  it("Arkansas Challenge: a 19 ACT works with a GPA under 3.0", () => {
    expect(check("AR", straight("C"), { act: 19 })["ar-challenge"]!.status).toBe("eligible");
    expect(check("AR", straight("C"), { act: 17 })["ar-challenge"]!.status).toBe("on_track");
  });
});
