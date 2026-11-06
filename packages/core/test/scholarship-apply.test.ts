import { describe, expect, it } from "vitest";
import {
  applicationProgress, daysLeft, letterRequest, lettersNeeded, packetProblems, questionsFromPrompts,
  suggestAnswers, suggestedDocs, summarizeApplications,
} from "../src/scholarship-apply";

describe("applying in the app", () => {
  it("reads how many letters an award wants", () => {
    expect(lettersNeeded("Submit the form, a transcript and two letters of recommendation.")).toBe(2);
    expect(lettersNeeded("Include one teacher recommendation.")).toBe(1);
    expect(lettersNeeded("A letter of recommendation is required.")).toBe(1);
    expect(lettersNeeded("Apply online with an essay.")).toBe(0);
    expect(lettersNeeded(null)).toBe(0);
  });

  it("lists the papers to gather from the award's words", () => {
    const d = suggestedDocs("Send your transcript, resume and a copy of your FAFSA Student Aid Report. A photo is optional.");
    expect(d.map((x) => x.name)).toEqual([
      "Transcript (ask your school counselor for the official one)",
      "Resume or activities list",
      "FAFSA summary page that shows your Student Aid Index (SAI)",
      "A recent photo of you",
    ]);
    expect(d[0]!.link).toBe("/grades/record");
    expect(suggestedDocs("Write an essay.", { needBased: true }).map((x) => x.link)).toEqual(["/aid"]);
    expect(suggestedDocs("")).toEqual([]);
  });

  it("turns essay prompts into questions with word limits", () => {
    expect(questionsFromPrompts(["In 300 words, describe your goals.", " "])).toEqual([{ q: "In 300 words, describe your goals.", a: "", limit: 300 }]);
  });

  it("suggests saved answers that fit the question", () => {
    const saved = [
      { id: "1", title: "Career goals", prompt: "What are your career goals?", draft: "I want to be a vet." },
      { id: "2", title: "Community service", prompt: "Describe your volunteer work.", draft: "I help at the shelter." },
      { id: "3", title: "Leadership", prompt: "A time you led", draft: "" },
    ];
    expect(suggestAnswers("Tell us about your goals after you graduate.", saved).map((s) => s.id)).toEqual(["1"]);
    expect(suggestAnswers("How do you volunteer in your community?", saved)[0]!.id).toBe("2");
    expect(suggestAnswers("Describe your leadership.", saved)).toEqual([]);
  });

  it("counts days to the deadline", () => {
    const today = new Date(2026, 10, 6, 9);
    expect(daysLeft("2026-11-13", today)).toBe(7);
    expect(daysLeft("2026-11-05", today)).toBe(-1);
    expect(daysLeft(null, today)).toBeNull();
  });

  it("tracks progress and the next step", () => {
    const base = { status: "getting_ready" as const, answers: [{ q: "Why you?", a: "", limit: 5 }], docs: [{ name: "Transcript", done: true }], recommenders: [], lettersNeeded: 1 };
    let p = applicationProgress(base);
    expect(p).toEqual({ done: 1, total: 4, next: 'Answer "Why you?"' });
    p = applicationProgress({ ...base, answers: [{ q: "Why you?", a: "one two three four five six", limit: 5 }] });
    expect(p.next).toBe('Shorten your answer to "Why you?"');
    p = applicationProgress({ ...base, answers: [{ q: "Why you?", a: "Because." }], recommenders: [{ name: "Ms. Lee", received: false }] });
    expect(p.next).toBe("Ask Ms. Lee for a letter");
    p = applicationProgress({ ...base, status: "submitted", answers: [{ q: "Why you?", a: "Because." }], recommenders: [{ name: "Ms. Lee", asked_on: "2026-11-01", received: true }] });
    expect(p).toEqual({ done: 4, total: 4, next: null });
  });

  it("writes a polite letter request", () => {
    const r = letterRequest({ student: "Emma", recommender: "Ms. Lee", award: "Rotary Award", deadline: "2026-12-15" });
    expect(r.subject).toBe("Letter of recommendation for the Rotary Award");
    expect(r.body).toContain("due December 15, 2026");
    expect(r.body).toContain("by December 8");
    expect(r.body.endsWith("Emma")).toBe(true);
  });

  it("sums up applications", () => {
    expect(summarizeApplications([
      { status: "getting_ready" }, { status: "submitted" }, { status: "won", amount_won: 1000 }, { status: "won", amount_won: 500 }, { status: "not_won" },
    ])).toEqual({ gettingReady: 1, sent: 1, won: 2, notWon: 1, totalWon: 1500 });
  });

  it("checks a school packet before sending", () => {
    expect(packetProblems({ full_name: "Emma Smith", grade_level: 12, answers: [{ q: "Why?", a: "Because" }] })).toEqual([]);
    expect(packetProblems({ full_name: " ", grade_level: 12, answers: [{ q: "A", a: "" }, { q: "B", a: " " }], essay: { prompt: "Goals", text: "" } }))
      .toEqual(["Type your full name.", "2 questions have no answer yet.", "The essay is empty."]);
  });
});
