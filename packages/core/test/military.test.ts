import { describe, expect, it } from "vitest";
import { MILITARY_COLLEGE_IDS, SERVICE_ACADEMIES, fitsSchoolType, militaryLabel, militaryTodoDates } from "../src";

describe("military paths", () => {
  it("lists five academies and fifteen schools in all", () => {
    expect(SERVICE_ACADEMIES).toHaveLength(5);
    expect(new Set(MILITARY_COLLEGE_IDS).size).toBe(15);
    expect(SERVICE_ACADEMIES.filter((a) => !a.nomination).map((a) => a.short)).toEqual(["Coast Guard Academy"]);
  });
  it("labels and filters military colleges", () => {
    expect(militaryLabel(197036)).toBe("Service academy");
    expect(militaryLabel(482680)).toBe("Senior military college");
    expect(militaryLabel(485111)).toBe("Military junior college");
    expect(militaryLabel(139959)).toBeNull();
    expect(fitsSchoolType({ id: 482680, ownership: 1 }, "military")).toBe(true);
    expect(fitsSchoolType({ id: 139959, ownership: 1 }, "military")).toBe(false);
  });
  it("dates the steps for a sophomore in the fall", () => {
    const d = militaryTodoDates(10, "2026-11-06");
    expect(d.find((x) => x.key === "summer")?.due).toBe("2028-01-15"); // grade 11 is 2027-28
    expect(d.find((x) => x.key === "rotc")?.due).toBe("2028-07-01"); // summer before grade 12
    expect(d.find((x) => x.key === "nomination-due")?.due).toBe("2028-09-15");
    expect(d.find((x) => x.key === "asvab")?.due).toBe("2027-10-01"); // next date in grade 10 has passed, so grade 11
  });
  it("leaves out steps already past for a senior", () => {
    const d = militaryTodoDates(12, "2026-11-06");
    expect(d.map((x) => x.key)).toEqual(["finish"]);
  });
});
