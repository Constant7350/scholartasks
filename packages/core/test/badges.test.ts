import { describe, expect, it } from "vitest";
import { badges, weekOf, weeklyStreak } from "../src";

describe("weekly streak", () => {
  it("finds the Monday of a week", () => expect(weekOf("2026-11-04")).toBe("2026-11-02"));
  it("counts weeks in a row up to this week", () => {
    expect(weeklyStreak(["2026-10-20", "2026-10-27", "2026-11-03"], "2026-11-04")).toEqual({ current: 3, best: 3, thisWeek: true });
  });
  it("doesn't break the streak before this week is over", () => {
    expect(weeklyStreak(["2026-10-20", "2026-10-27"], "2026-11-02").current).toBe(2);
  });
  it("breaks after a missed week but keeps the best", () => {
    const s = weeklyStreak(["2026-09-01", "2026-09-08", "2026-09-15", "2026-11-03"], "2026-11-04");
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });
});

describe("badges", () => {
  const none = { days: [], collegesOnList: 0, collegesSubmitted: 0, scholarshipsSaved: 0, activities: 0, essaysFinished: 0, coursesEntered: 0, practiceAnswered: 0, aidStepsDone: 0, lessonsDone: 0 };
  it("starts with nothing earned", () => expect(badges(none, "2026-11-04").filter((b) => b.earned)).toHaveLength(0));
  it("earns badges and shows progress toward the rest", () => {
    const b = badges({ ...none, days: ["2026-11-03"], activities: 3, collegesOnList: 2 }, "2026-11-04");
    expect(b.find((x) => x.id === "resume")?.earned).toBe(true);
    expect(b.find((x) => x.id === "first-step")?.earned).toBe(true);
    expect(b.find((x) => x.id === "list")?.progress).toBe("2 of 5");
  });
});
