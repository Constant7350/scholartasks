import { describe, expect, it } from "vitest";
import { COMMON_APP_PROMPTS, checkActivity, checkHonor, commonAppReadiness, essayStatus } from "../src/common-app";

const act = (over = {}) => ({ position: "Captain", organization: "Varsity soccer", description: "Led 22 players; organized a summer camp for 40 kids.", grades: [10, 11, 12], hours_per_week: 10, weeks_per_year: 30, ...over });
const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("checkActivity", () => {
  it("passes a complete activity within the limits", () => {
    expect(checkActivity(act(), 0).ready).toBe(true);
  });
  it("flags a description over 150 characters", () => {
    const c = checkActivity(act({ description: "x".repeat(151) }), 0);
    expect(c.ready).toBe(false);
    expect(c.issues).toEqual([{ field: "description", length: 151, limit: 150 }]);
  });
  it("lists missing fields", () => {
    const c = checkActivity(act({ organization: "", hours_per_week: null }), 0);
    expect(c.missing).toEqual(["organization name", "hours per week and weeks per year"]);
  });
});

describe("checkHonor", () => {
  it("flags a title over 100 characters and a missing level", () => {
    const c = checkHonor({ position: "y".repeat(101), grades: [11], recognition: null }, 0);
    expect(c.issues[0]?.limit).toBe(100);
    expect(c.missing).toEqual(["level of recognition"]);
  });
});

describe("essayStatus", () => {
  it("needs a real prompt and 250 to 650 words", () => {
    expect(essayStatus({ prompt: COMMON_APP_PROMPTS[6]!, draft: words(400) }).ready).toBe(true);
    expect(essayStatus({ prompt: COMMON_APP_PROMPTS[6]!, draft: words(700) }).note).toMatch(/50 words over/);
    expect(essayStatus({ prompt: "My own", draft: words(400) }).ready).toBe(false);
    expect(essayStatus(null).note).toBe("Not started");
  });
});

describe("commonAppReadiness", () => {
  it("is 100% when every section is ready", () => {
    const r = commonAppReadiness({
      profile: { highSchool: true, gradYear: true }, hasGrades: true, hasTests: false,
      activities: [act()], honors: [], essay: { prompt: COMMON_APP_PROMPTS[0]!, draft: words(500) }, supplements: { done: 0, total: 0 },
    });
    expect(r.percent).toBe(100);
  });
  it("notes more than 10 activities and counts only the top 10", () => {
    const r = commonAppReadiness({
      profile: { highSchool: false, gradYear: false }, hasGrades: false, hasTests: false,
      activities: Array.from({ length: 12 }, () => act()), honors: [], essay: null, supplements: { done: 1, total: 3 },
    });
    const a = r.sections.find((s) => s.key === "activities")!;
    expect(a.total).toBe(10);
    expect(a.notes[0]).toMatch(/You have 12/);
    expect(r.percent).toBeLessThan(100);
  });
});
