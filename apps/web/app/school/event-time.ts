import { buildIcs } from "../../lib/ics";

/** A school event, as counselors post it and families see it. */
export interface SchoolEvent { id: string; title: string; starts_on: string; start_time: string | null; location: string | null; details: string | null; grades: number[] }

/** "18:30:00" → "6:30 PM" (in the reader's own format). */
export const timeText = (t: string | null) => {
  if (!t) return "";
  const [h = 0, m = 0] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

/** A calendar file for one event (opens in Apple, Google or Outlook calendar). */
export function eventIcs(e: SchoolEvent, school: string): string {
  const when = [timeText(e.start_time), e.location].filter(Boolean).join(", ");
  return buildIcs(school, [{
    uid: `school-event-${e.id}`, title: `${e.title} (${school})`, date: e.starts_on,
    description: [when, e.details].filter(Boolean).join("\n") || undefined,
  }]);
}
