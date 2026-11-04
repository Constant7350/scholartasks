import type { Deadline } from "./schema";
import { classOf } from "./aid";

export interface Reminder {
  deadlineId: string;
  /** ISO date the reminder should be sent. */
  sendOn: string;
  daysBefore: number;
  title: string;
  what: string;
  where: string;
  documents: string[];
  dueOn: string;
}

/** Days before a due date to remind; the schedule from the build spec. */
export const DEFAULT_OFFSETS = [30, 14, 7, 2, 1, 0];
/** Forms that open (rather than close) get a heads-up and a "now open" reminder. */
export const OPENS_OFFSETS = [7, 0];

const DAY = 86_400_000;
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** A pack date applies to a student by graduating class when it names one, otherwise by grade. */
export function deadlineAppliesTo(d: Deadline, gradeLevel: number, today: string): boolean {
  return d.class_of !== undefined ? d.class_of === classOf(gradeLevel, today) : d.grade_levels.includes(gradeLevel);
}

/**
 * Turns deadlines from state packs (and later, colleges and scholarships)
 * into dated reminders. Pure function: the caller decides channels and time zone.
 */
export function buildReminders(
  deadlines: Deadline[],
  opts: { today: string; gradeLevel: number; offsets?: number[] },
): Reminder[] {
  const today = toDay(opts.today);
  const out: Reminder[] = [];
  for (const d of deadlines) {
    if (!deadlineAppliesTo(d, opts.gradeLevel, opts.today)) continue;
    const due = toDay(d.date);
    if (due < today) continue;
    const offsets = d.kind === "opens" ? OPENS_OFFSETS : (opts.offsets ?? DEFAULT_OFFSETS);
    for (const n of offsets) {
      const send = due - n * DAY;
      if (send < today) continue;
      const what =
        d.kind === "opens"
          ? n === 0
            ? `${d.form} is open today. ${d.title}.`
            : `${d.form} opens in ${n} days. ${d.title}.`
          : n === 0
            ? `${d.title} is due today.`
            : `${d.title} is due in ${n} day${n === 1 ? "" : "s"}.`;
      out.push({
        deadlineId: d.id,
        sendOn: toIso(send),
        daysBefore: n,
        title: d.title,
        what,
        where: d.where,
        documents: d.documents,
        dueOn: d.date,
      });
    }
  }
  return out.sort((a, b) => a.sendOn.localeCompare(b.sendOn) || a.deadlineId.localeCompare(b.deadlineId));
}
