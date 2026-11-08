// Subject mastery levels. Every student starts at Core in each class. Three
// right answers in a row at your level (or harder) moves you up; two misses in
// a row at your level (or easier) moves you down. These are levels of how well
// you know a class right now, never a measure of how smart you are.
export const LEVELS = ["Foundation", "Core", "Strong", "Advanced", "Expert"] as const;
export const levelName = (n: number) => LEVELS[Math.min(5, Math.max(1, n)) - 1]!;

export interface QMeta { id: string; subject: string; topic: string; level: number; kind: "mc" | "written"; status: string }
export interface Attempt { question_id: string; correct: boolean; created_at: string }

export interface SubjectState {
  level: number;
  best: number;
  answered: number;
  right: number;
  /** Per question: was the last try right? */
  last: Map<string, boolean>;
  /** Per level: right / answered, for the report. */
  byLevel: Record<number, { right: number; total: number }>;
  topics: Record<string, { right: number; total: number }>;
}

const UP = 3;
const DOWN = 2;

/** Replays a student's answers in time order to get their level in every subject. */
export function subjectStates(meta: Map<string, QMeta>, attempts: Attempt[]): Map<string, SubjectState> {
  const out = new Map<string, SubjectState>();
  const streak = new Map<string, { up: number; down: number }>();
  const ordered = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const a of ordered) {
    const q = meta.get(a.question_id);
    if (!q) continue;
    let s = out.get(q.subject);
    if (!s) { s = { level: 2, best: 2, answered: 0, right: 0, last: new Map(), byLevel: {}, topics: {} }; out.set(q.subject, s); }
    s.last.set(q.id, a.correct);
    s.answered++;
    if (a.correct) s.right++;
    const t = (s.topics[q.topic] ??= { right: 0, total: 0 });
    t.total++; if (a.correct) t.right++;
    const l = (s.byLevel[q.level] ??= { right: 0, total: 0 });
    l.total++; if (a.correct) l.right++;
    if (q.kind !== "mc") continue;
    const st = streak.get(q.subject) ?? { up: 0, down: 0 };
    if (a.correct && q.level >= Math.max(s.level, 2)) { st.up++; st.down = 0; }
    else if (!a.correct && q.level <= Math.max(s.level, 2)) { st.down++; st.up = 0; }
    if (st.up >= UP && s.level < 5) { s.level++; st.up = 0; st.down = 0; }
    if (st.down >= DOWN && s.level > 1) { s.level--; st.up = 0; st.down = 0; }
    s.best = Math.max(s.best, s.level);
    streak.set(q.subject, st);
  }
  return out;
}

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/**
 * Picks a round: mostly questions at the student's level, a few from the next
 * level up to stretch, and one written question. New questions come first,
 * then ones missed last time, then the rest.
 */
export function pickRound(pool: QMeta[], state: SubjectState | undefined, size = 10): QMeta[] {
  const level = state?.level ?? 2;
  const core = Math.max(level, 2);
  const stretch = level >= 2 && level < 5 ? core + 1 : null;
  const last = state?.last ?? new Map<string, boolean>();
  const rank = (q: QMeta) => (last.has(q.id) ? (last.get(q.id) ? 2 : 1) : 0);
  const order = (list: QMeta[]) => shuffle(list).sort((a, b) => rank(a) - rank(b));
  const mc = pool.filter((q) => q.kind === "mc");
  const wantStretch = stretch ? 2 : 0;
  const picked: QMeta[] = [];
  const take = (list: QMeta[], n: number) => { for (const q of order(list)) { if (picked.length >= n || picked.includes(q)) continue; picked.push(q); } };
  if (stretch) take(mc.filter((q) => q.level === stretch), wantStretch);
  take(mc.filter((q) => q.level === core), size - 1);
  // Not enough at this level yet: fill from the nearest levels.
  for (let d = 1; d <= 4 && picked.length < size - 1; d++) take(mc.filter((q) => q.level === core - d || q.level === core + d), size - 1);
  const written = order(pool.filter((q) => q.kind === "written"));
  if (written[0]) picked.push(written[0]);
  return shuffle(picked.filter((q) => q.kind === "mc")).concat(picked.filter((q) => q.kind === "written"));
}

/** Badges: one per class reached Expert, plus milestones across classes. */
export function badges(states: Map<string, SubjectState>, mine: string[]): { icon: string; label: string }[] {
  const experts = [...states.entries()].filter(([, s]) => s.best >= 5).map(([name]) => name);
  const out = experts.map((name) => ({ icon: "🏆", label: name }));
  const n = experts.length;
  if (n >= 3) out.unshift({ icon: "🥉", label: "Expert in 3 classes" });
  if (n >= 5) out.unshift({ icon: "🥈", label: "Expert in 5 classes" });
  if (n >= 10) out.unshift({ icon: "🥇", label: "Expert in 10 classes" });
  if (mine.length >= 3 && mine.every((m) => experts.includes(m))) out.unshift({ icon: "👑", label: "Expert in every class I take" });
  return out;
}
