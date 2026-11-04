import { describe, expect, it } from "vitest";
import { GROUP_TAGS, matchScholarship, normalizeProfile, type MatchStudent, type Scholarship } from "../src/scholarships";

const senior: MatchStudent = {
  gradeLevel: 12, state: "GA", hopeGpa: 3.4, unweightedGpa: 3.6, weightedGpa: 3.9, sat: 1250, act: null,
  incomeBand: "60_110k", profile: { interests: ["STEM"], citizen: "yes", groups_answered: true, groups: [], plan: "four_year" },
};
const base: Scholarship = { id: "x", name: "X", scope: "US", grades: [12] };
const today = new Date("2026-11-04T12:00:00");

describe("matchScholarship", () => {
  it("is a match when every rule is met", () => {
    const r = matchScholarship({ ...base, min_gpa: 3.0, citizen_required: true, interests: ["STEM"] }, senior, today);
    expect(r.status).toBe("match");
    expect(r.met.length).toBe(4);
  });
  it("only rules out other interests once some are picked", () => {
    expect(matchScholarship({ ...base, interests: ["Music"] }, senior, today).status).toBe("no");
    const none = { ...senior, profile: { ...senior.profile, interests: [] } };
    expect(matchScholarship({ ...base, interests: ["Music"] }, none, today).status).toBe("maybe");
  });
  it("uses the right GPA", () => {
    expect(matchScholarship({ ...base, min_gpa: 3.5, gpa_kind: "hope" }, senior, today).status).toBe("no");
    expect(matchScholarship({ ...base, min_gpa: 3.5, gpa_kind: "unweighted" }, senior, today).status).toBe("match");
  });
  it("is a maybe when we don't know something yet", () => {
    const r = matchScholarship({ ...base, min_gpa: 3.0 }, { ...senior, unweightedGpa: null }, today);
    expect(r.status).toBe("maybe");
    expect(r.unknown[0]).toMatch(/add grades/);
    expect(matchScholarship({ ...base, need_based: true }, senior, today).status).toBe("maybe");
  });
  it("checks income bands against the limit", () => {
    expect(matchScholarship({ ...base, max_income: 95000 }, senior, today).status).toBe("maybe");
    expect(matchScholarship({ ...base, max_income: 120000 }, senior, today).status).toBe("match");
    expect(matchScholarship({ ...base, max_income: 50000 }, senior, today).status).toBe("no");
    expect(matchScholarship({ ...base, max_income: 50000 }, { ...senior, incomeBand: null }, today).status).toBe("maybe");
  });
  it("either test score counts", () => {
    const z = { ...base, scope: "GA", min_sat: 1200, min_act: 25 };
    expect(matchScholarship(z, senior, today).status).toBe("match");
    expect(matchScholarship(z, { ...senior, sat: 1100 }, today).status).toBe("no");
    expect(matchScholarship(z, { ...senior, sat: 1100, act: 26 }, today).status).toBe("match");
  });
  it("shows younger students what's coming, with what to work on", () => {
    const r = matchScholarship({ ...base, min_gpa: 3.8 }, { ...senior, gradeLevel: 10 }, today);
    expect(r.status).toBe("later");
    expect(r.missing[0]).toMatch(/3.8/);
  });
  it("hard limits are a no even for younger students", () => {
    expect(matchScholarship({ ...base, scope: "FL" }, { ...senior, gradeLevel: 10 }, today).status).toBe("no");
    expect(matchScholarship({ ...base, grades: [11] }, senior, today).status).toBe("no");
  });
  it("groups are only used when the family answered", () => {
    const s = { ...base, groups: ["Hispanic or Latino"] };
    expect(matchScholarship(s, { ...senior, profile: { ...senior.profile, groups_answered: false } }, today).status).toBe("maybe");
    expect(matchScholarship(s, senior, today).status).toBe("no");
    expect(matchScholarship(s, { ...senior, profile: { ...senior.profile, groups: ["Hispanic or Latino"] } }, today).status).toBe("match");
  });
  it("awards for women or men use the separate sex answer", () => {
    const women = { ...base, groups: ["Woman"] }, men = { ...base, groups: ["Man"] };
    const as = (sex?: "female" | "male" | "prefer_not") => ({ ...senior, profile: { ...senior.profile, sex } });
    expect(matchScholarship(women, as("female"), today).status).toBe("match");
    expect(matchScholarship(women, as("female"), today).met).toContain("Open to women");
    expect(matchScholarship(women, as("male"), today).status).toBe("no");
    expect(matchScholarship(men, as("male"), today).status).toBe("match");
    // Not answered or prefer not to say: still shown as something to check, never hidden.
    expect(matchScholarship(women, as(undefined), today).status).toBe("maybe");
    expect(matchScholarship(women, as("prefer_not"), today).status).toBe("maybe");
    // Old profiles that picked the "Woman" chip still match.
    expect(matchScholarship(women, { ...senior, profile: { groups: ["Woman"], groups_answered: true } }, today).status).toBe("match");
  });
  it("old group labels still match after the 2024 label update", () => {
    const old = { ...base, groups: ["Asian American or Pacific Islander"] };
    const prof = (groups: string[]) => ({ ...senior, profile: { ...senior.profile, groups } });
    expect(matchScholarship(old, prof(["Native Hawaiian or Pacific Islander"]), today).status).toBe("match");
    expect(matchScholarship({ ...base, groups: ["Asian or Asian American"] }, prof(["Asian American or Pacific Islander"]), today).status).toBe("match");
    expect(normalizeProfile({ groups: ["Woman", "Asian American or Pacific Islander"] })).toEqual({
      groups: ["Asian or Asian American", "Native Hawaiian or Pacific Islander"], sex: "female",
    });
    expect(GROUP_TAGS).toContain("Woman");
  });
  it("rules out a passed deadline, or moves it to next year", () => {
    const r = matchScholarship({ ...base, deadline: "2026-09-30" }, senior, today);
    expect(r.status).toBe("no");
    expect(r.missing[0]).toMatch(/passed/);
    const junior = { ...senior, gradeLevel: 11 };
    expect(matchScholarship({ ...base, grades: [11, 12], deadline: "2026-09-30" }, junior, today).status).toBe("later");
    expect(matchScholarship({ ...base, deadline: "2026-12-30" }, senior, today).status).toBe("match");
  });
});

describe("college-only awards", () => {
  it("matches when the college is on the list", () => {
    const s = { ...base, college: "University of Georgia" };
    expect(matchScholarship(s, senior, today).status).toBe("maybe");
    expect(matchScholarship(s, { ...senior, colleges: ["university of georgia"] }, today).status).toBe("match");
    const o = matchScholarship({ ...base, other_requirements: "Nominated by your school" }, senior, today);
    expect(o.check).toContain("Nominated by your school");
    expect(o.status).toBe("match");
  });
});

describe("test scores", () => {
  it("an ACT-only student isn't ruled out by an SAT-only rule", () => {
    expect(matchScholarship({ ...base, min_sat: 1200 }, { ...senior, sat: null, act: 27 }, today).status).toBe("maybe");
  });
});
