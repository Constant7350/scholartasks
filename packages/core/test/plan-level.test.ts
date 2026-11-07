import { describe, expect, it } from "vitest";
import { extraStudents, familyPlanLevel, levelForGrade, levelStep, noticeShowing, type LevelNotice } from "../src";

describe("family plan level", () => {
  it("maps grades to levels", () => {
    expect([6, 8, 9, 10, 11, 12].map(levelForGrade)).toEqual(["explore", "explore", "build", "build", "apply", "apply"]);
  });
  it("is set by the oldest student, whatever the others' grades", () => {
    expect(familyPlanLevel([7, 12, 9])).toBe("apply");
    expect(familyPlanLevel([6, 9])).toBe("build");
    expect(familyPlanLevel([6])).toBe("explore");
  });
  it("is unknown with no students", () => expect(familyPlanLevel([])).toBeNull());
});

const B = (level: "explore" | "build" | "apply", extras = 0) => ({ level, extras });

describe("price level changes", () => {
  it("does nothing when nothing changed or no student has a grade", () => {
    expect(levelStep({ current: B("build"), target: B("build"), today: "2026-11-07", nextBill: "2026-11-20" })).toEqual({ action: "none" });
    expect(levelStep({ current: B("apply"), target: { level: null, extras: 0 }, today: "2026-11-07", nextBill: "2026-11-20" })).toEqual({ action: "none" });
  });
  it("does nothing for a plan that is ending", () => {
    expect(levelStep({ current: B("build"), target: B("apply"), today: "2026-11-07", nextBill: null })).toEqual({ action: "none" });
  });
  it("waits until about 30 days before the next bill", () => {
    expect(levelStep({ current: B("build"), target: B("apply"), today: "2026-08-15", nextBill: "2027-03-01" })).toEqual({ action: "wait", to: B("apply") });
  });
  it("tells the family and switches for the next bill inside the 30-day window", () => {
    expect(levelStep({ current: B("build"), target: B("apply"), today: "2027-01-30", nextBill: "2027-03-01" }))
      .toEqual({ action: "change", to: B("apply"), levelUp: true, levelDown: false, startsOn: "2027-03-01" });
  });
  it("lowers the same way when the oldest leaves", () => {
    expect(levelStep({ current: B("apply"), target: B("explore"), today: "2026-06-10", nextBill: "2026-06-25" }))
      .toEqual({ action: "change", to: B("explore"), levelUp: false, levelDown: true, startsOn: "2026-06-25" });
  });
  it("treats an added extra student the same way", () => {
    expect(levelStep({ current: B("build"), target: B("build", 1), today: "2026-06-10", nextBill: "2026-06-25" }))
      .toEqual({ action: "change", to: B("build", 1), levelUp: false, levelDown: false, startsOn: "2026-06-25" });
  });
  it("never gives less than 7 days notice; waits for the bill after", () => {
    expect(levelStep({ current: B("explore"), target: B("build"), today: "2026-08-20", nextBill: "2026-08-24" }).action).toBe("wait");
  });
});

describe("extra students", () => {
  it("includes two students", () => {
    expect([0, 1, 2, 3, 9].map(extraStudents)).toEqual([0, 0, 0, 1, 7]);
  });
});

describe("level notice", () => {
  const n: LevelNotice = { from: "build", to: "apply", student: "Emma", grade: 11, cents: 1299, interval: "month", starts_on: "2026-09-01", sent_on: "2026-08-05" };
  it("shows until the new price starts", () => {
    expect(noticeShowing(n, "2026-08-20")).toBe(true);
    expect(noticeShowing(n, "2026-09-01")).toBe(true);
    expect(noticeShowing(n, "2026-09-02")).toBe(false);
    expect(noticeShowing(null, "2026-08-20")).toBe(false);
  });
});
