import { describe, expect, it } from "vitest";
import { CHRISTIAN_CODES, CHURCH_FAMILIES, faithCodes, faithLabel, fitsSchoolType, isChristian, matchScore, type CollegeFacts } from "../src";

describe("Christian colleges", () => {
  it("knows which affiliations are Christian", () => {
    expect(isChristian(75)).toBe(true); // Southern Baptist
    expect(isChristian(30)).toBe(true); // Catholic
    expect(isChristian(80)).toBe(false); // Jewish
    expect(isChristian(null)).toBe(false);
  });
  it("every church family code is a Christian code", () => {
    for (const f of CHURCH_FAMILIES) for (const c of f.codes) expect(CHRISTIAN_CODES).toContain(c);
  });
  it("narrows to one church family", () => {
    expect(faithCodes("catholic")).toEqual([30]);
    expect(faithCodes(null)).toBe(CHRISTIAN_CODES);
  });
  it("labels a college", () => {
    expect(faithLabel(75)).toBe("Christian (Southern Baptist)");
    expect(faithLabel(108)).toBe("Christian (Nondenominational)");
    expect(faithLabel(101)).toBe("Ecumenical Christian");
    expect(faithLabel(null)).toBeNull();
  });
  it("filters by school type", () => {
    const pub = { ownership: 1, religiousAffiliation: null };
    const baptist = { ownership: 2, religiousAffiliation: 54 };
    const secular = { ownership: 2, religiousAffiliation: null };
    expect(fitsSchoolType(pub, "public")).toBe(true);
    expect(fitsSchoolType(baptist, "private")).toBe(true);
    expect(fitsSchoolType(secular, "christian")).toBe(false);
    expect(fitsSchoolType(baptist, "christian")).toBe(true);
    expect(fitsSchoolType(baptist, "christian", "baptist")).toBe(true);
    expect(fitsSchoolType(baptist, "christian", "catholic")).toBe(false);
  });
  it("match quiz keeps only Christian colleges when asked", () => {
    const base: CollegeFacts = { id: 1, name: "X", state: "GA", ownership: 2, size: 3000, admitRate: 0.7, satAvg: null, actMid: null, tuitionIn: 30000, tuitionOut: 30000, costOfAttendance: 45000, avgNetPrice: 20000, netPriceByIncome: [], programs: {} };
    const a = { where: "home" as const, size: "any" as const, type: "christian" as const, interests: [], budget: null };
    expect(matchScore(base, a, "GA", null)).toBeNull();
    expect(matchScore({ ...base, religiousAffiliation: 75 }, a, "GA", null)).not.toBeNull();
  });
});
