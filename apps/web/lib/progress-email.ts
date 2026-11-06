// The weekly Homework Helper progress email for parents. Server only.
//
// The numbers come from homework_log (the same short lines parents see on the Homework
// Helper page: subject, topic, hints, finished or not, and when the helper said no). The
// trend (better, steady, slipping, quiet) is worked out here from those numbers, never by
// the AI, so praise is only given for real progress. The AI (claude-haiku-5-5) then writes
// a few warm sentences: specific praise when things improved, and when they didn't, one
// different tactic for the parent to try this week. Full chats are never stored or sent.

export type MailLang = "en" | "es";
export type Trend = "better" | "steady" | "slipping" | "quiet" | "new";

export interface LogLine { created_at: string; subject: string; topic: string | null; hints: number; solved: boolean; said_no: string | null; safety: boolean }

export interface WeekStats {
  replies: number;
  finished: number;
  /** Finished problems by hints used: none, 1, 2, 3 or more. */
  byHints: [number, number, number, number];
  /** Average hints per finished problem, or null when nothing was finished. */
  avgHints: number | null;
  /** Share (0 to 100) of finished problems done with no hints or one hint. */
  independent: number | null;
  subjects: { subject: string; count: number; topics: string[] }[];
  askedForAnswers: number;
  saidNo: number;
  safety: number;
  days: number;
}

export interface Progress { thisWeek: WeekStats; before: WeekStats; trend: Trend; reasons: string[] }

const DAY = 86400000;

export function weekStats(rows: LogLine[]): WeekStats {
  const done = rows.filter((r) => r.solved);
  const by: [number, number, number, number] = [0, 0, 0, 0];
  for (const r of done) by[Math.min(3, Math.max(0, r.hints)) as 0 | 1 | 2 | 3] += 1;
  const subj = new Map<string, { count: number; topics: Set<string> }>();
  for (const r of rows) {
    const s = subj.get(r.subject) ?? { count: 0, topics: new Set<string>() };
    s.count++;
    if (r.topic) s.topics.add(r.topic.slice(0, 60));
    subj.set(r.subject, s);
  }
  return {
    replies: rows.length,
    finished: done.length,
    byHints: by,
    avgHints: done.length ? Math.round((done.reduce((a, r) => a + r.hints, 0) / done.length) * 10) / 10 : null,
    independent: done.length ? Math.round(((by[0] + by[1]) / done.length) * 100) : null,
    subjects: [...subj.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 6).map(([subject, v]) => ({ subject, count: v.count, topics: [...v.topics].slice(0, 4) })),
    askedForAnswers: rows.filter((r) => r.said_no === "answer" || r.said_no === "writing" || r.said_no === "test").length,
    saidNo: rows.filter((r) => r.said_no).length,
    safety: rows.filter((r) => r.safety).length,
    days: new Set(rows.map((r) => r.created_at.slice(0, 10))).size,
  };
}

/**
 * Compares the week that just ended with the three weeks before it.
 * weekStart is the Monday (YYYY-MM-DD, UTC) the finished week began.
 */
export function progressFor(rows: LogLine[], weekStart: string): Progress {
  const start = Date.parse(`${weekStart}T00:00:00Z`);
  const end = start + 7 * DAY;
  const from = start - 21 * DAY;
  const at = (r: LogLine) => Date.parse(r.created_at);
  const thisWeek = weekStats(rows.filter((r) => at(r) >= start && at(r) < end));
  const before = weekStats(rows.filter((r) => at(r) >= from && at(r) < start));
  const reasons: string[] = [];
  let trend: Trend;
  if (thisWeek.replies === 0) {
    trend = "quiet";
    reasons.push("No Homework Helper use this week, after using it in the weeks before.");
  } else if (before.replies === 0 || before.finished === 0) {
    trend = "new";
    reasons.push("First week with enough to compare, so there is no trend yet.");
  } else if (thisWeek.finished === 0) {
    trend = "slipping";
    reasons.push("Used the helper this week but didn't finish a problem with it.");
  } else {
    const dInd = (thisWeek.independent ?? 0) - (before.independent ?? 0);
    const dAvg = (thisWeek.avgHints ?? 0) - (before.avgHints ?? 0);
    const answersPerWeekBefore = before.askedForAnswers / 3;
    let up = 0, down = 0;
    if (dInd >= 10) { up++; reasons.push(`Finished more problems with 0 or 1 hint (${thisWeek.independent}% this week, ${before.independent}% before).`); }
    if (dInd <= -10) { down++; reasons.push(`Fewer problems finished with 0 or 1 hint (${thisWeek.independent}% this week, ${before.independent}% before).`); }
    if (dAvg <= -0.5) { up++; reasons.push(`Fewer hints per finished problem (${thisWeek.avgHints} this week, ${before.avgHints} before).`); }
    if (dAvg >= 0.5) { down++; reasons.push(`More hints per finished problem (${thisWeek.avgHints} this week, ${before.avgHints} before).`); }
    if (thisWeek.askedForAnswers >= 2 && thisWeek.askedForAnswers >= answersPerWeekBefore + 2) { down++; reasons.push(`Asked the helper for the answer ${thisWeek.askedForAnswers} times this week.`); }
    trend = up > down ? "better" : down > up ? "slipping" : "steady";
    if (trend === "steady") reasons.push("About the same as the weeks before.");
  }
  return { thisWeek, before, trend, reasons };
}

/** The Monday (UTC date) that began last full week, for a given day in Eastern time (YYYY-MM-DD). */
export function lastWeekStart(todayEastern: string): string {
  const d = new Date(`${todayEastern}T00:00:00Z`);
  const monday = d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY;
  return new Date(monday - 7 * DAY).toISOString().slice(0, 10);
}

// ---------- The AI part ----------

export const PROGRESS_MODEL = "claude-haiku-5-5";

export const NOTE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    note: { type: "string" },
    try_this: { type: "string" },
    tactic_short: { type: "string" },
  },
  required: ["headline", "note", "try_this", "tactic_short"],
  additionalProperties: false,
};

export const NOTE_SYSTEM = `You write one short weekly note to a parent about their child's week with a homework helper inside a college and career planning app. The helper gives hints and never answers, so fewer hints per finished problem means more independent thinking.

You get the numbers for the week that just ended, the three weeks before it, the trend (already decided from the numbers; never change it), the reasons for the trend, and the tactic suggested last week if there was one.

Write:
- headline: max 10 words, warm and specific, no exclamation overload. Use STUDENT for the child's name.
- note: 2 or 3 short sentences to the parent. Trend "better": name the exact improvement from the numbers and praise the effort and thinking (not "smart"). "steady": say what is going well and what would be the next step. "slipping": calm, no blame, say plainly what the numbers show. "quiet": no guilt, a gentle nudge that a few short sessions help. "new": welcome, describe what you see so far.
- try_this: ONE concrete thing the parent can do this week, 1 or 2 sentences, takes under 10 minutes. If progress stalled or slipped and a tactic was suggested last week, pick a clearly DIFFERENT approach. Ideas to adapt: ask STUDENT to teach you one problem at dinner; a 10-minute try-it-alone timer before opening the helper; ask for a guess first; celebrate each no-hint problem; one problem with the phone off then check it together; break homework into short blocks; talk about why the struggle is where learning happens when they asked for answers. If things improved, the tactic keeps the momentum going.
- tactic_short: the try_this idea in max 12 words, for our records.

Rules: only use facts in the numbers; never invent grades, scores, test results or feelings. Never shame, threaten, compare to other kids, or suggest punishments or taking help away. No medical or learning-disability guesses. Don't mention AI models, prompts or cost. Plain words a busy parent reads in 20 seconds. Write in the language given (Spanish: natural Latin American Spanish, use "tú"). Always write STUDENT where the child's name goes.`;

export interface NoteInput { grade: number; lang: MailLang; progress: Progress; lastTactic: string | null; lastTrend: string | null }

export function noteMessage(i: NoteInput): string {
  const fmt = (w: WeekStats) =>
    `helper replies ${w.replies}, days used ${w.days}, problems finished ${w.finished} (no hints ${w.byHints[0]}, 1 hint ${w.byHints[1]}, 2 hints ${w.byHints[2]}, 3 or more ${w.byHints[3]}), ` +
    `average hints per finished problem ${w.avgHints ?? "n/a"}, finished with 0 or 1 hint ${w.independent ?? "n/a"}%, asked for answers or writing ${w.askedForAnswers}, ` +
    `subjects: ${w.subjects.map((s) => `${s.subject} (${s.count}${s.topics.length ? `: ${s.topics.join(", ")}` : ""})`).join("; ") || "none"}`;
  return [
    `Language: ${i.lang === "es" ? "Spanish" : "English"}`,
    `Grade: ${i.grade}`,
    `Trend: ${i.progress.trend}`,
    `Reasons: ${i.progress.reasons.join(" ")}`,
    `This week: ${fmt(i.progress.thisWeek)}`,
    `Three weeks before (total): ${fmt(i.progress.before)}`,
    i.lastTactic ? `Tactic suggested last week (trend then: ${i.lastTrend ?? "unknown"}): ${i.lastTactic}` : "No tactic suggested before.",
  ].join("\n");
}

export interface Note { headline: string; note: string; try_this: string; tactic_short: string }

/** Used when the AI is off or fails, so the email still goes out with honest words. */
export function fallbackNote(trend: Trend, lang: MailLang): Note {
  const en: Record<Trend, Note> = {
    better: { headline: "STUDENT is thinking more on their own", note: "STUDENT finished more problems with fewer hints this week. That's real progress in working things out on their own.", try_this: "Ask STUDENT to show you one problem they solved without a hint and explain how they did it.", tactic_short: "Ask STUDENT to explain one no-hint problem" },
    steady: { headline: "A steady week for STUDENT", note: "STUDENT kept using the helper about the same as before. Steady practice is how thinking skills grow.", try_this: "Before opening the helper, have STUDENT try each problem alone for 10 minutes and write a first guess.", tactic_short: "10-minute try-alone timer before the helper" },
    slipping: { headline: "STUDENT needed more hints this week", note: "This week STUDENT leaned on hints more than before. That happens with new or harder topics.", try_this: "Sit with STUDENT for one problem and ask them to say each step out loud before they ask for a hint.", tactic_short: "Say each step out loud before asking for a hint" },
    quiet: { headline: "A quiet week for STUDENT", note: "STUDENT didn't use the Homework Helper this week. A few short sessions keep the habit going.", try_this: "Pick one homework night and ask STUDENT to try one problem with the helper, then tell you what they learned.", tactic_short: "One short helper session on a set night" },
    new: { headline: "STUDENT's first weeks with the Homework Helper", note: "STUDENT has started using the Homework Helper. Over the next weeks you'll see whether they need fewer hints.", try_this: "Ask STUDENT to show you how the helper works with one problem they did this week.", tactic_short: "Have STUDENT show you one problem" },
  };
  const es: Record<Trend, Note> = {
    better: { headline: "STUDENT está pensando más por su cuenta", note: "Esta semana STUDENT terminó más problemas con menos pistas. Es un avance real en resolver las cosas por su cuenta.", try_this: "Pídele a STUDENT que te muestre un problema que resolvió sin pistas y te explique cómo lo hizo.", tactic_short: "STUDENT explica un problema sin pistas" },
    steady: { headline: "Una semana estable para STUDENT", note: "STUDENT usó el ayudante más o menos igual que antes. La práctica constante es lo que desarrolla el pensamiento.", try_this: "Antes de abrir el ayudante, que STUDENT intente cada problema solo durante 10 minutos y escriba una primera respuesta.", tactic_short: "10 minutos solo antes del ayudante" },
    slipping: { headline: "STUDENT necesitó más pistas esta semana", note: "Esta semana STUDENT se apoyó más en las pistas que antes. Pasa con temas nuevos o más difíciles.", try_this: "Siéntate con STUDENT en un problema y pídele que diga cada paso en voz alta antes de pedir una pista.", tactic_short: "Decir cada paso en voz alta antes de pedir pista" },
    quiet: { headline: "Una semana tranquila para STUDENT", note: "STUDENT no usó el Ayudante de tareas esta semana. Unas sesiones cortas mantienen el hábito.", try_this: "Elige una noche de tareas y pídele a STUDENT que haga un problema con el ayudante y te cuente qué aprendió.", tactic_short: "Una sesión corta en una noche fija" },
    new: { headline: "Las primeras semanas de STUDENT con el Ayudante de tareas", note: "STUDENT empezó a usar el Ayudante de tareas. En las próximas semanas verás si necesita menos pistas.", try_this: "Pídele a STUDENT que te muestre cómo funciona el ayudante con un problema de esta semana.", tactic_short: "STUDENT te muestra un problema" },
  };
  return (lang === "es" ? es : en)[trend];
}

/** Keeps the AI's words short and in plain text. */
export function cleanNote(n: Note, fallback: Note): Note {
  const t = (s: unknown, max: number, fb: string) => {
    const v = typeof s === "string" ? s.replace(/[<>]/g, "").replace(/\s+/g, " ").trim() : "";
    return v ? v.slice(0, max) : fb;
  };
  return { headline: t(n.headline, 120, fallback.headline), note: t(n.note, 600, fallback.note), try_this: t(n.try_this, 400, fallback.try_this), tactic_short: t(n.tactic_short, 120, fallback.tactic_short) };
}
