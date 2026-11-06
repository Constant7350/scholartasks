import { describe, expect, it } from "vitest";
import { collegeFit, estimateCost, matchScore, type CollegeFacts, type ProgramResult, type StatePack } from "../src";
import ga from "../../../packs/states/GA.json";

const GA = ga as unknown as StatePack;
const uga: CollegeFacts = {
  id: 139959, name: "University of Georgia", state: "GA", ownership: 1, size: 31000, admitRate: 0.37, satAvg: 1340, actMid: 30,
  tuitionIn: 10000, tuitionOut: 30000, costOfAttendance: 28000, avgNetPrice: 15000,
  netPriceByIncome: [8000, 9000, 12000, 18000, 22000], programs: { biological: 0.08, agriculture: 0.03 },
};
const priv: CollegeFacts = { ...uga, id: 2, name: "Private U", ownership: 2, tuitionIn: 50000, tuitionOut: 50000, costOfAttendance: 70000, netPriceByIncome: [15000, 18000, 22000, 30000, 45000], programs: { business_marketing: 0.3 } };
const hope = (status: ProgramResult["status"]): ProgramResult => ({ programId: "ga-hope", programName: "HOPE Scholarship", status, gpa: 3.4, gaps: [], checks: [], sourceUrl: "" });

describe("estimateCost", () => {
  it("uses what families at this income typically pay", () => {
    const e = estimateCost(uga, { homeState: "GA", incomeBand: "60_110k", statePrograms: [], pack: GA });
    expect(e.sticker).toBe(28000);
    expect(e.typical).toBe(15000); // average of the 48-75k and 75-110k bands
    expect(e.estimate).toBe(15000);
    expect(e.basis).toBe("typical");
  });
  it("uses HOPE when it beats the typical price", () => {
    const e = estimateCost(uga, { homeState: "GA", incomeBand: "110_200k", statePrograms: [hope("eligible")], pack: GA });
    expect(e.basis).toBe("state_award");
    expect(e.estimate).toBe(18000); // 28,000 minus 10,000 tuition
  });
  it("adds the out-of-state tuition difference at public colleges", () => {
    const e = estimateCost(uga, { homeState: "FL", incomeBand: null, statePrograms: [], pack: GA });
    expect(e.sticker).toBe(48000);
    expect(e.estimate).toBe(48000);
    expect(e.notes.join(" ")).toMatch(/Academic Common Market/);
  });
  it("uses the college's aid offer and outside scholarships", () => {
    const e = estimateCost(priv, { homeState: "GA", incomeBand: "60_110k", statePrograms: [], pack: GA, aidOffer: 40000, outsideAwards: 2000 });
    expect(e.basis).toBe("offer");
    expect(e.estimate).toBe(28000);
    expect(e.fourYears).toBe(112000);
  });
  it("tells a family what HOPE would save when they're still working toward it", () => {
    const e = estimateCost(priv, { homeState: "GA", incomeBand: null, statePrograms: [hope("on_track")], pack: GA });
    expect(e.estimate).toBe(70000);
    expect(e.notes[0]).toMatch(/HOPE Scholarship.*\$6,000/);
  });
});

describe("collegeFit", () => {
  it("labels very selective colleges a reach", () => expect(collegeFit({ admitRate: 0.08, satAvg: 1500, actMid: 34 }, { sat: 1600 })).toBe("reach"));
  it("labels a college likely when scores are well above average", () => expect(collegeFit({ admitRate: 0.8, satAvg: 1050, actMid: null }, { sat: 1200 })).toBe("likely"));
  it("labels a college a reach when scores are well below", () => expect(collegeFit(uga, { act: 22 })).toBe("reach"));
  it("falls back to the admit rate without scores", () => expect(collegeFit({ admitRate: 0.9, satAvg: null, actMid: null }, {})).toBe("likely"));
  it("uses GPA and rigor when there are no test scores", () => {
    const mid = { admitRate: 0.55, satAvg: 1200, actMid: null };
    expect(collegeFit(mid, { gpa: 3.9, rigor: 5 })).toBe("likely");
    expect(collegeFit(mid, { gpa: 3.4, rigor: 1 })).toBe("match");
    expect(collegeFit(mid, { gpa: 2.8 })).toBe("reach");
  });
  it("moves a test-score fit up for strong grades and rigor, down for weak grades", () => {
    const mid = { admitRate: 0.55, satAvg: 1200, actMid: null };
    expect(collegeFit(mid, { sat: 1210 })).toBe("match");
    expect(collegeFit(mid, { sat: 1210, gpa: 3.9, rigor: 6 })).toBe("likely");
    expect(collegeFit(mid, { sat: 1210, gpa: 2.7 })).toBe("reach");
    expect(collegeFit({ admitRate: 0.2, satAvg: 1400, actMid: null }, { sat: 1410, gpa: 4, rigor: 8 })).toBe("reach");
  });
});

describe("matchScore", () => {
  const answers = { where: "home" as const, size: "large" as const, type: "any" as const, interests: ["Animals and veterinary"], budget: null };
  it("rules out colleges outside the chosen area or without the interest", () => {
    expect(matchScore(uga, answers, "FL", null)).toBeNull();
    expect(matchScore(priv, answers, "GA", null)).toBeNull();
  });
  it("scores a college that fits", () => expect(matchScore(uga, answers, "GA", 15000)).toBeGreaterThan(70));
  it("drops colleges over budget", () => expect(matchScore(uga, { ...answers, budget: 10000 }, "GA", 15000)).toBeNull());
});
