import { describe, expect, it } from "vitest";
import { fillDeadline, nextOn } from "../src/deadlines";

describe("deadline auto-fill", () => {
  it("picks the next time a month/day comes around", () => {
    expect(nextOn(11, 1, "2026-10-20")).toBe("2026-11-01");
    expect(nextOn(11, 1, "2026-11-01")).toBe("2026-11-01");
    expect(nextOn(11, 1, "2026-11-07")).toBe("2027-11-01");
    expect(nextOn(1, 4, "2026-11-07")).toBe("2027-01-04");
  });
  it("prefers the college's own date, then the typical one, and leaves rolling empty", () => {
    const uga = [{ college_id: 139959, plan: "EA", month: 10, day: 15, note: null }];
    expect(fillDeadline("EA", uga, "2026-09-01")).toEqual({ date: "2026-10-15", source: "college", note: null });
    expect(fillDeadline("RD", uga, "2026-09-01")).toEqual({ date: "2027-01-01", source: "typical", note: null });
    expect(fillDeadline("rolling", uga, "2026-09-01")).toBeNull();
  });
});
