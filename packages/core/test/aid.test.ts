import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  AidGuide,
  aidCycleFor,
  aidProgress,
  aidSteps,
  buildReminders,
  checkAidGuide,
  classOf,
  documentsFor,
  fafsaContributors,
  fillCycle,
  loadPacks,
} from "../src/node";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packs");
const guide = AidGuide.parse(JSON.parse(readFileSync(resolve(root, "federal/aid-guide.json"), "utf8")));
const GA = loadPacks(root).states.find((s) => s.state === "GA")!;

describe("aid guide", () => {
  it("is valid together with the Georgia steps", () => {
    expect(checkAidGuide(guide, GA.aid_steps)).toEqual([]);
  });

  it("works out the graduating class from grade and date", () => {
    expect(classOf(12, "2026-11-04")).toBe(2027);
    expect(classOf(11, "2026-11-04")).toBe(2028);
    expect(classOf(12, "2027-03-01")).toBe(2027);
    expect(classOf(12, "2027-08-15")).toBe(2028);
  });

  it("gives a senior this fall the 2027-28 FAFSA using 2025 taxes", () => {
    const c = aidCycleFor(guide, 12, "2026-11-04")!;
    expect(c.id).toBe("2027-28");
    expect(c.tax_year).toBe(2025);
    expect(fillCycle("Parents' {tax_year} return for the {cycle} FAFSA, due {deadline}", c)).toBe(
      "Parents' 2025 return for the 2027-28 FAFSA, due June 30, 2028",
    );
    expect(aidCycleFor(guide, 11, "2026-11-04")!.id).toBe("2028-29");
  });

  it("puts Georgia steps among the federal ones, in stage order", () => {
    const ids = aidSteps(guide, GA.aid_steps).map((s) => s.id);
    expect(ids.indexOf("ga-gafutures-account")).toBeGreaterThan(ids.indexOf("parent-account"));
    expect(ids.indexOf("ga-gafutures-account")).toBeLessThan(ids.indexOf("household"));
    expect(ids.indexOf("ga-gsfapp")).toBeGreaterThan(ids.indexOf("fafsa-submitted"));
    expect(ids.at(-1)).toBe("refile");
  });

  it("builds the document list from household answers", () => {
    const c = aidCycleFor(guide, 12, "2026-11-04");
    const plain = documentsFor(guide, { parent_filed_taxes: "yes" }, c).map((d) => d.id);
    expect(plain).toContain("parent-1040");
    expect(plain).not.toContain("business");
    expect(plain).not.toContain("parent-w2-nofile");
    const farm = documentsFor(guide, { parent_filed_taxes: "no", business_or_farm: true, child_support: true }, c);
    expect(farm.map((d) => d.id)).toEqual(expect.arrayContaining(["parent-w2-nofile", "business", "child-support"]));
    expect(farm.find((d) => d.id === "child-support")!.text).toBe("Total child support received in 2025");
  });

  it("names the FAFSA contributors", () => {
    expect(fafsaContributors({ parents: "married", filed_jointly: true }).people).toHaveLength(2);
    expect(fafsaContributors({ parents: "married", filed_jointly: false }).people).toHaveLength(3);
    expect(fafsaContributors({ parents: "unmarried_together" }).people).toHaveLength(3);
    expect(fafsaContributors({ parents: "divorced_separated" }).people[1]).toMatch(/more financial support/);
    expect(fafsaContributors({ parents: "remarried", filed_jointly: false }).people).toContain("Their spouse (stepparent)");
    expect(fafsaContributors({}).people).toEqual(["The student"]);
  });

  it("counts progress and finds the next step", () => {
    const steps = aidSteps(guide, GA.aid_steps);
    const p = aidProgress(steps, [
      { step_id: "student-account", status: "done" },
      { step_id: "parent-account", status: "done" },
      { step_id: "css-profile", status: "skipped" },
    ]);
    expect(p.done).toBe(2);
    expect(p.skipped).toBe(1);
    expect(p.next!.id).toBe("ga-gafutures-account");
    expect(p.left).toBe(steps.length - 3);
  });
});

describe("FAFSA dates by graduating class", () => {
  it("reminds this year's seniors about the 2027-28 deadline, not next year's opening", () => {
    const ids = buildReminders(GA.deadlines, { today: "2026-11-04", gradeLevel: 12 }).map((r) => r.deadlineId);
    expect(ids).toContain("ga-fafsa-2027-28-deadline");
    expect(ids).not.toContain("ga-fafsa-2028-29-opens");
  });

  it("gives this year's juniors next year's opening", () => {
    const ids = buildReminders(GA.deadlines, { today: "2026-11-04", gradeLevel: 11 }).map((r) => r.deadlineId);
    expect(ids).toContain("ga-fafsa-2028-29-opens");
    expect(ids).not.toContain("ga-fafsa-2027-28-deadline");
  });
});
