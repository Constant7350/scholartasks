import { describe, expect, it } from "vitest";
import { checkOpening, cleanUrl, openingReviewFlags, PART_TIME_POST_FEE, sortOpenings, TEEN_JOB_RULES } from "../src";

const today = new Date("2026-11-06T12:00:00Z");
const slugs = ["electrician", "welder"];
const good = {
  kind: "apprenticeship", title: " Electrical  apprentice ", trade_slug: "electrician",
  company_name: "Peach State Electric", company_website: "peachelectric.com",
  contact_name: "Dana Ruiz", contact_email: "Dana@PeachElectric.com", city: "Macon", state: "ga", zip: "31201",
  min_age: "18", description: "Learn residential wiring on the job with a licensed electrician. Paid from day one.",
  how_to_apply: "Email jobs@peachelectric.com with your name and phone.", agree: "on",
};

describe("company listings", () => {
  it("accepts and cleans a normal listing", () => {
    const r = checkOpening(good, { tradeSlugs: slugs, today });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.opening).toMatchObject({
      title: "Electrical apprentice", state: "GA", contact_email: "dana@peachelectric.com",
      company_website: "https://peachelectric.com/", min_age: 18, show_until: "2027-02-04", registered_apprenticeship: false,
    });
  });
  it("needs the rules agreed, a way to apply and a real state", () => {
    expect(checkOpening({ ...good, agree: undefined }, { tradeSlugs: slugs, today }).ok).toBe(false);
    expect(checkOpening({ ...good, how_to_apply: "" }, { tradeSlugs: slugs, today }).ok).toBe(false);
    expect(checkOpening({ ...good, how_to_apply: "", apply_url: "peachelectric.com/jobs" }, { tradeSlugs: slugs, today }).ok).toBe(true);
    expect(checkOpening({ ...good, state: "Georgia" }, { tradeSlugs: slugs, today }).ok).toBe(false);
    expect(checkOpening({ ...good, min_age: "12" }, { tradeSlugs: slugs, today }).ok).toBe(false);
    expect(checkOpening({ ...good, trade_slug: "astronaut" }, { tradeSlugs: slugs, today }).ok).toBe(false);
    expect(checkOpening(null, { tradeSlugs: slugs, today }).ok).toBe(false);
  });
  it("caps how long a listing stays up", () => {
    const r = checkOpening({ ...good, show_until: "2030-01-01" }, { tradeSlugs: slugs, today });
    expect(r.ok && r.opening.show_until).toBe("2027-05-05");
  });
  it("keeps the Registered Apprenticeship number only for apprenticeships", () => {
    const r = checkOpening({ ...good, registered_apprenticeship: "yes", rapids_number: "2024-GA-12345" }, { tradeSlugs: slugs, today });
    expect(r.ok && r.opening.rapids_number).toBe("2024-GA-12345");
    const j = checkOpening({ ...good, kind: "job", registered_apprenticeship: "yes", rapids_number: "x" }, { tradeSlugs: slugs, today });
    expect(j.ok && j.opening.registered_apprenticeship).toBe(false);
  });
  it("flags the hidden trap field as spam", () => {
    expect(checkOpening({ ...good, website: "x" }, { tradeSlugs: slugs, today })).toMatchObject({ ok: false, spam: true });
  });
  it("refuses links that aren't web pages", () => {
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("localhost")).toBeNull();
    expect(cleanUrl("http://shop.example.com/jobs")).toBe("http://shop.example.com/jobs");
  });
});

describe("weekend and holiday jobs", () => {
  it("accepts the new kinds", () => {
    expect(checkOpening({ ...good, kind: "weekend", min_age: "16" }, { tradeSlugs: slugs, today }).ok).toBe(true);
    expect(checkOpening({ ...good, kind: "holiday", min_age: "14" }, { tradeSlugs: slugs, today }).ok).toBe(true);
  });
  it("keeps the fee a free placeholder while we launch", () => {
    expect(PART_TIME_POST_FEE.freeWhileLaunching).toBe(true);
    expect(TEEN_JOB_RULES[0]).toMatch(/parent/);
  });
});

describe("review flags", () => {
  const base = { min_age: 18, kind: "job" as const, registered_apprenticeship: false, rapids_number: null, description: "Shop helper.", how_to_apply: "Call us.", company_website: "https://x.com" };
  it("is quiet for a plain adult listing", () => expect(openingReviewFlags(base)).toEqual([]));
  it("asks for the child labor check under 18 and 16", () => {
    expect(openingReviewFlags({ ...base, min_age: 16 })).toHaveLength(1);
    expect(openingReviewFlags({ ...base, min_age: 15 })).toHaveLength(2);
  });
  it("spots fees and requests for private details", () => {
    const f = openingReviewFlags({ ...base, description: "A $50 deposit for your starter kit. Bring your social security card." });
    expect(f.join(" ")).toMatch(/pay/);
    expect(f.join(" ")).toMatch(/private/);
  });
});

describe("home state first, then nationwide", () => {
  const row = (id: string, state: string, approved_at: string) => ({ id, kind: "job" as const, title: id, trade_slug: null, company_name: "C", city: "X", state, min_age: 18, approved_at });
  it("splits and orders", () => {
    const { home, elsewhere } = sortOpenings([row("a", "TN", "2026-11-01"), row("b", "GA", "2026-10-01"), row("c", "GA", "2026-11-02"), row("d", "AL", "2026-11-03")], "ga");
    expect(home.map((r) => r.id)).toEqual(["c", "b"]);
    expect(elsewhere.map((r) => r.id)).toEqual(["d", "a"]);
  });
  it("puts Featured listings first in each group", () => {
    const rows = [row("a", "GA", "2026-11-05"), { ...row("b", "GA", "2026-10-01"), featured: true }, row("c", "TN", "2026-11-04"), { ...row("d", "WY", "2026-09-01"), featured: true }];
    const { home, elsewhere } = sortOpenings(rows, "GA");
    expect(home.map((r) => r.id)).toEqual(["b", "a"]);
    expect(elsewhere.map((r) => r.id)).toEqual(["d", "c"]);
  });
});
