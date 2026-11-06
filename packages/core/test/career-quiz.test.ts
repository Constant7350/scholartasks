import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CAREERS, CAREER_CODES, INTEREST_ITEMS, QUIZ_LENGTH, RIASEC, TRADE_CODES, VALUE_ITEMS, WORK_VALUES, drawQuiz, quizCareers, quizTrades, scoreQuiz, summarizeQuiz, quizLine, militaryFit, closeTypes, drawNarrowing, type Answer, type Trade } from "../src";

const trades = (JSON.parse(readFileSync(new URL("../../../packs/trades/trades.json", import.meta.url), "utf8")).trades ?? []) as Trade[];

/** Answers a whole bank: "Strongly like" for the given types, "Dislike" for the rest. */
function answerAs(likes: string, ids?: string[]): Record<string, Answer> {
  const out: Record<string, Answer> = {};
  for (const x of INTEREST_ITEMS) if (!ids || ids.includes(x.id)) out[x.id] = likes.includes(x.type) ? 4 : 1;
  for (const v of VALUE_ITEMS) if (!ids || ids.includes(v.id)) out[v.id] = 2;
  return out;
}

describe("career interest quiz bank", () => {
  it("has a big, balanced bank with unique ids and no repeats", () => {
    const ids = new Set([...INTEREST_ITEMS, ...VALUE_ITEMS].map((x) => x.id));
    expect(ids.size).toBe(INTEREST_ITEMS.length + VALUE_ITEMS.length);
    const texts = new Set(INTEREST_ITEMS.map((x) => x.text.toLowerCase()));
    expect(texts.size).toBe(INTEREST_ITEMS.length);
    for (const t of RIASEC) expect(INTEREST_ITEMS.filter((x) => x.type === t).length).toBeGreaterThanOrEqual(100);
    for (const v of Object.keys(WORK_VALUES)) expect(VALUE_ITEMS.filter((x) => x.value === v).length).toBeGreaterThanOrEqual(10);
  });
  it("never mentions race, ethnicity, sex or gender in a question", () => {
    const banned = /\b(boy|girl|man|men|woman|women|male|female|he|she|his|her|race|black|white|hispanic|latino|asian|gender)\b/i;
    for (const x of [...INTEREST_ITEMS, ...VALUE_ITEMS]) expect(x.text, x.id).not.toMatch(banned);
  });
  it("gives every career and trade a valid interest code", () => {
    for (const [k, code] of Object.entries(CAREER_CODES)) { expect(CAREERS, k).toHaveProperty(k); expect(code).toMatch(/^[RIASEC]{2,3}$/); }
    for (const t of trades) expect(TRADE_CODES[t.slug], t.slug).toMatch(/^[RIASEC]{2,3}$/);
  });
});

describe("drawing a quiz", () => {
  it("draws the same number from each type and a different mix each time", () => {
    const a = drawQuiz(1), b = drawQuiz(2);
    expect(a.interests).toHaveLength(QUIZ_LENGTH.perType * 6);
    expect(a.values).toHaveLength(QUIZ_LENGTH.perValue * 6);
    for (const t of RIASEC) expect(a.interests.filter((x) => x.type === t)).toHaveLength(QUIZ_LENGTH.perType);
    expect(a.interests.map((x) => x.id)).not.toEqual(b.interests.map((x) => x.id));
    expect(drawQuiz(1).interests.map((x) => x.id)).toEqual(a.interests.map((x) => x.id)); // resumable
  });
  it("holds back questions seen last time and never repeats a type three times in a row", () => {
    const first = drawQuiz(7);
    const next = drawQuiz(8, { avoid: first.interests.map((x) => x.id) });
    const seen = new Set(first.interests.map((x) => x.id));
    const repeats = next.interests.filter((x) => seen.has(x.id)).length;
    expect(repeats).toBeLessThan(first.interests.length / 2);
    for (let i = 2; i < next.interests.length; i++) {
      const [p, q, r] = [next.interests[i - 2]!.type, next.interests[i - 1]!.type, next.interests[i]!.type];
      expect(p === q && q === r).toBe(false);
    }
  });
});

describe("scoring", () => {
  it("finds the right code no matter which questions were drawn", () => {
    for (const seed of [3, 4, 5]) {
      const d = drawQuiz(seed);
      const r = scoreQuiz(answerAs("SI", [...d.interests, ...d.values].map((x) => x.id)));
      expect(r.code.slice(0, 2).split("").sort().join("")).toBe("IS");
    }
  });
  it("matches helpers who like science to health careers, and builders to trades", () => {
    const health = scoreQuiz(answerAs("SI"));
    expect(["rn", "pa", "pt", "ot", "np", "doctor", "resptherapist", "dietitian", "psychologist"]).toContain(quizCareers(health)[0]!.key);
    const builder = scoreQuiz(answerAs("RC"));
    expect(TRADE_CODES[quizTrades(builder, trades)[0]!.trade.slug]!.startsWith("R")).toBe(true);
  });
  it("warns when every answer is the same", () => {
    const all: Record<string, Answer> = {};
    for (const x of INTEREST_ITEMS) all[x.id] = 4;
    expect(scoreQuiz(all).notes.join(" ")).toMatch(/Almost every answer/);
  });
  it("saves a short summary the AI counselor can read", () => {
    const r = scoreQuiz(answerAs("RE"));
    const s = summarizeQuiz(r, trades, "2026-11-06");
    expect(JSON.stringify(s).length).toBeLessThan(800);
    expect(quizLine(s)).toMatch(/not a verdict/);
    expect(militaryFit(r)).toBeGreaterThan(50);
  });
});

describe("narrowing it down", () => {
  it("asks only about the close types, never repeats, and leaves clear results alone", () => {
    const d = drawQuiz(11);
    const ids = [...d.interests, ...d.values].map((x) => x.id);
    const close = scoreQuiz(answerAs("SI", ids));
    expect(closeTypes(close)?.sort().join("")).toBe("IS");
    const more = drawNarrowing(close, 12, ids);
    expect(more).toHaveLength(24);
    expect(more.every((x) => x.type === "S" || x.type === "I")).toBe(true);
    expect(more.some((x) => ids.includes(x.id))).toBe(false);
    const clear = scoreQuiz(answerAs("A", ids));
    expect(closeTypes(clear)).toBeNull();
    expect(drawNarrowing(clear, 1, ids)).toEqual([]);
  });
});
