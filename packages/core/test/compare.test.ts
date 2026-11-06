import { describe, expect, it } from "vitest";
import { DEFAULT_IMPORTANCE, compareColleges, ordinal, placeAmong, type CompareItem } from "../src";

const base: Omit<CompareItem, "id"> = { major: 50, cost: 20000, finish: 0.5, pay: 50000, debt: 20000, admit: 0.8, satAvg: 1100 };

describe("compareColleges", () => {
  it("ranks each criterion and overall, 1 = best", () => {
    const rows = compareColleges([
      { id: 1, ...base, cost: 10000, major: 40 },
      { id: 2, ...base, cost: 30000, major: 90, pay: 70000 },
    ], DEFAULT_IMPORTANCE);
    expect(rows[0]!.scores.cost).toBe(100);
    expect(rows[1]!.scores.cost).toBe(33);
    expect(rows[0]!.ranks.cost).toBe(1);
    expect(rows[1]!.ranks.major).toBe(1);
    expect(rows[1]!.ranks.pay).toBe(1);
    expect(rows[0]!.ranks.finish).toBe(1); // tie shares 1st
    expect(rows[1]!.ranks.finish).toBe(1);
  });
  it("uses the family's importance and skips what's left out", () => {
    const items = [{ id: 1, ...base, cost: 10000, major: 10 }, { id: 2, ...base, cost: 40000, major: 95 }];
    const costOnly = compareColleges(items, { major: 0, cost: 3, finish: 0, pay: 0, debt: 0, fit: 0 });
    expect(costOnly[0]!.overallRank).toBe(1);
    const majorOnly = compareColleges(items, { major: 3, cost: 0, finish: 0, pay: 0, debt: 0, fit: 0 });
    expect(majorOnly[1]!.overallRank).toBe(1);
  });
  it("missing data gets no score or rank", () => {
    const rows = compareColleges([{ id: 1, ...base, debt: null }, { id: 2, ...base }], DEFAULT_IMPORTANCE);
    expect(rows[0]!.scores.debt).toBeNull();
    expect(rows[0]!.ranks.debt).toBeNull();
  });
  it("adjusts chance of getting in by SAT", () => {
    const [a] = compareColleges([{ id: 1, ...base, admit: 0.5, satAvg: 1200 }], DEFAULT_IMPORTANCE, 1400);
    expect(a!.scores.fit).toBe(100);
  });
});

describe("ordinal", () => {
  it("writes places", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 25, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "25th", "101st", "111th"]);
  });
});

describe("placeAmong", () => {
  const all = [
    { id: 1, state: "GA", value: 80 }, { id: 2, state: "GA", value: 60 }, { id: 3, state: "FL", value: 90 },
    { id: 4, state: "GA", value: 60 }, { id: 5, state: "FL", value: null },
  ];
  it("places a college in its state and nationwide", () => {
    expect(placeAmong(all, 2)).toEqual({ state: { at: 2, of: 3 }, nation: { at: 3, of: 4 } });
    expect(placeAmong(all, 3)).toEqual({ state: { at: 1, of: 1 }, nation: { at: 1, of: 4 } });
  });
  it("lower can be better (debt)", () => {
    expect(placeAmong(all, 2, false)).toEqual({ state: { at: 1, of: 3 }, nation: { at: 1, of: 4 } });
  });
  it("no number, no place", () => {
    expect(placeAmong(all, 5)).toBeNull();
    expect(placeAmong(all, 9)).toBeNull();
  });
});
