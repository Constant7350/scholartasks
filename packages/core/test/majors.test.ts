import { describe, expect, it } from "vitest";
import { CAREERS, DEGREES, FIELDS, combinePrograms, findFields, rankPrograms, sortCareers, type ProgramFacts } from "../src";

describe("findFields", () => {
  it("finds what families type", () => {
    expect(findFields("vet")[0]?.id).toBe("veterinarian");
    expect(findFields("Marine Biology")[0]?.id).toBe("marine-biology");
    expect(findFields("nurse")[0]?.id).toBe("nursing");
    expect(findFields("horses")[0]?.id).toBe("animal-science");
    expect(findFields("zz")).toEqual([]);
  });
  it("every field points at real careers and 4-digit major codes", () => {
    for (const f of FIELDS) {
      for (const c of f.careers) expect(CAREERS[c], `${f.id} ${c}`).toBeTruthy();
      for (const g of f.groups) for (const cip of g.cips) expect(cip).toMatch(/^\d{4}$/);
    }
    expect(new Set(FIELDS.map((f) => f.id)).size).toBe(FIELDS.length);
  });
});

describe("rankPrograms", () => {
  const base: ProgramFacts = { collegeId: 1, state: "GA", grads: 100, earn1: 40000, earn4: 55000, debt: 20000, gradRate: 0.8, satAvg: 1300 };
  it("ranks a bigger, better-paying program higher and marks home state", () => {
    const r = rankPrograms([
      { ...base, collegeId: 1 },
      { ...base, collegeId: 2, state: "NC", grads: 5, earn4: 35000, gradRate: 0.4, satAvg: 1000 },
    ], "GA");
    expect(r[0]!.p.collegeId).toBe(1);
    expect(r[0]!.homeState).toBe(true);
    expect(r[0]!.score).toBeGreaterThan(r[1]!.score);
    expect(r[0]!.score).toBeLessThanOrEqual(100);
  });
  it("doesn't let a program with no data top the list", () => {
    const r = rankPrograms([
      { ...base, collegeId: 1 },
      { collegeId: 3, state: "GA", grads: 1, earn1: null, earn4: null, debt: null, gradRate: null, satAvg: null },
    ], "GA");
    expect(r[1]!.p.collegeId).toBe(3);
  });
});

describe("combinePrograms", () => {
  it("adds majors at the same college and weights pay by graduates", () => {
    const c = combinePrograms([
      { college_id: 1, grads: 30, earn_1yr: 40000, earn_4yr: null, debt: 10000 },
      { college_id: 1, grads: 10, earn_1yr: 80000, earn_4yr: 90000, debt: null },
      { college_id: 2, grads: 5, earn_1yr: null, earn_4yr: null, debt: null },
    ]);
    expect(c.find((x) => x.collegeId === 1)).toMatchObject({ grads: 40, earn1: 50000, earn4: 90000, debt: 10000 });
    expect(c.find((x) => x.collegeId === 2)?.earn1).toBeNull();
  });
});

describe("careers and degrees", () => {
  it("sorts careers by pay or by fastest start", () => {
    const pay = sortCareers(["vet", "vettech"], "pay");
    expect(pay[0]!.name).toBe("Veterinarian");
    expect(sortCareers(["vet", "vettech"], "fast")[0]!.name).toBe("Veterinary technician");
  });
  it("lists every degree level with years", () => {
    expect(DEGREES.map((d) => d.level)).toEqual([1, 2, 3, 5, 7, 6]);
    for (const d of DEGREES) expect(d.years).toBeTruthy();
  });
});
