import { describe, expect, it } from "vitest";
import { CAREERS } from "../src/majors";
import { CAREER_TAGS, bundleEssays, essayTheme, matchCareers, rankOffers, summarizeOffer, trimToWords, wordLimitFrom } from "../src/application";

describe("essay themes", () => {
  it("reads what a prompt asks", () => {
    expect(essayTheme("Describe your career goals and how this scholarship will help you reach them.")).toBe("goals");
    expect(essayTheme("Tell us about a challenge or obstacle you have overcome.")).toBe("challenge");
    expect(essayTheme("Describe your community service and volunteer work.")).toBe("service");
    expect(essayTheme("Explain your financial need.")).toBe("need");
    expect(essayTheme("How has FFA or 4-H shaped you?")).toBe("agriculture");
    expect(essayTheme("Why do you want to attend our university?")).toBe("why_school");
    expect(essayTheme("")).toBe("other");
  });
  it("finds word limits", () => {
    expect(wordLimitFrom("In 500 words or less, describe...")).toBe(500);
    expect(wordLimitFrom("Answer in 250-300 words.")).toBe(300);
    expect(wordLimitFrom("No limit")).toBeNull();
  });
  it("bundles essays that ask the same thing", () => {
    const { bundles, single } = bundleEssays([
      { key: "a", title: "A", prompt: "What are your career goals?", draft: "word ".repeat(300) },
      { key: "b", title: "B", prompt: "Describe your goals after you graduate (500 words).", draft: "" },
      { key: "c", title: "C", prompt: "Tell us about a leader you admire and your leadership.", draft: "" },
    ]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0]!.theme).toBe("goals");
    expect(bundles[0]!.withDraft).toBe(1);
    expect(bundles[0]!.empty).toBe(1);
    expect(bundles[0]!.items.find((i) => i.key === "b")!.limit).toBe(500);
    expect(single.map((s) => s.key)).toEqual(["c"]);
  });
  it("trims a draft near a word limit at a sentence end", () => {
    const t = "One two three. Four five six. Seven eight nine ten.";
    expect(trimToWords(t, 7)).toBe("One two three. Four five six.");
    expect(trimToWords(t, null)).toBe(t);
  });
});

describe("aid offers", () => {
  it("separates free money from loans", () => {
    const s = summarizeOffer({ coa: 30000, grants: 18000, student_loans: 5500, parent_loans: 4000, work_study: 2000 });
    expect(s.netPrice).toBe(12000);
    expect(s.stillToCover).toBe(500);
    expect(s.fourYearStudentDebt).toBe(22000);
    expect(s.freeShare).toBeCloseTo(0.6);
    expect(s.warnings.join(" ")).toMatch(/not aid/);
  });
  it("uses the federal cost when the letter has none", () => {
    expect(summarizeOffer({ grants: 5000 }, 25000).netPrice).toBe(20000);
    expect(summarizeOffer({ grants: 5000 }).warnings[0]).toMatch(/No cost/);
  });
  it("ranks by net price", () => {
    const r = rankOffers([
      { id: "x", summary: summarizeOffer({ coa: 40000, grants: 10000 }) },
      { id: "y", summary: summarizeOffer({ coa: 25000, grants: 5000 }) },
      { id: "z", summary: summarizeOffer({ grants: 5000 }) },
    ]);
    expect(r.map((o) => o.id)).toEqual(["y", "x", "z"]);
  });
});

describe("career quiz", () => {
  it("tags only real careers", () => {
    for (const k of Object.keys(CAREER_TAGS)) expect(CAREERS).toHaveProperty(k);
  });
  it("matches interests to careers and links a major", () => {
    const m = matchCareers(["animals", "science"]);
    expect(m[0]!.key).toBe("vet");
    expect(m[0]!.fieldId).toBe("veterinarian");
    expect(matchCareers([])).toEqual([]);
  });
});
