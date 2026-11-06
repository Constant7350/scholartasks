// The Spanish word list and how a line on screen is matched to it.
// Shared by the page translator (translator.tsx), the server (emails and
// texts) and the team check page. No DOM and no React here.
//
// A line is either plain text ("Save") or a template with changing parts in
// braces ("You have {n} colleges saved."). Inside a sentence, links and bold
// words are numbered tags: "Add a student on the <1>Family page</1> first."
export type Dict = Record<string, string>;

const HOLE = /\{([A-Za-z0-9]+)\}/g;
const TAG = /<(\d+)>([\s\S]*?)<\/\1>/g;

export const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const escapeRe = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

interface Template { re: RegExp; names: string[]; es: string; en: string }

export interface Compiled {
  exact: Map<string, string>;
  templates: Template[];
  /** First word of each template's English, to skip templates quickly. */
  byFirst: Map<string, Template[]>;
  anyStart: Template[];
  cache: Map<string, string | null>;
}

export function compile(dict: Dict): Compiled {
  const exact = new Map<string, string>();
  const templates: Template[] = [];
  for (const [en0, es] of Object.entries(dict)) {
    if (!es) continue;
    const en = norm(en0);
    HOLE.lastIndex = 0;
    if (!HOLE.test(en)) { exact.set(en, es); continue; }
    const names: string[] = [];
    let src = "";
    let last = 0;
    HOLE.lastIndex = 0;
    for (let m: RegExpExecArray | null; (m = HOLE.exec(en)); ) {
      src += escapeRe(en.slice(last, m.index)) + "(.+?)";
      names.push(m[1]!);
      last = m.index + m[0].length;
    }
    src += escapeRe(en.slice(last));
    templates.push({ re: new RegExp(`^${src}$`, "s"), names, es, en });
  }
  // Longer, more specific templates first.
  templates.sort((a, b) => b.en.replace(HOLE, "").length - a.en.replace(HOLE, "").length);
  const byFirst = new Map<string, Template[]>();
  const anyStart: Template[] = [];
  for (const t of templates) {
    const w = firstWord(t.en);
    if (!w || t.en.startsWith("{")) anyStart.push(t);
    else byFirst.set(w, [...(byFirst.get(w) ?? []), t]);
  }
  return { exact, templates, byFirst, anyStart, cache: new Map() };
}

const firstWord = (s: string) => s.match(/^[^\s{<]+/)?.[0] ?? "";

const MONTHS: Record<string, string> = {
  Jan: "ene", Feb: "feb", Mar: "mar", Apr: "abr", May: "may", Jun: "jun", Jul: "jul", Aug: "ago", Sep: "sept", Sept: "sept", Oct: "oct", Nov: "nov", Dec: "dic",
  January: "enero", February: "febrero", March: "marzo", April: "abril", June: "junio", July: "julio", August: "agosto", September: "septiembre", October: "octubre", November: "noviembre", December: "diciembre",
};
const DAYS: Record<string, string> = {
  Mon: "lun", Tue: "mar", Wed: "mié", Thu: "jue", Fri: "vie", Sat: "sáb", Sun: "dom",
  Monday: "lunes", Tuesday: "martes", Wednesday: "miércoles", Thursday: "jueves", Friday: "viernes", Saturday: "sábado", Sunday: "domingo",
};
const DATE_RE = /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),? )?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\.? (\d{1,2})(?:, (\d{4}))?(?:,? (?:at )?(\d{1,2}:\d{2}) ?(AM|PM))?$/;
const MONTH_YEAR_RE = /^(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) (\d{4})$/;

/** "Nov 13, 2026" -> "13 nov 2026", "Friday, November 13" -> "viernes, 13 de noviembre". */
export function spanishDate(s: string): string | null {
  const m = DATE_RE.exec(s);
  if (m) {
    const [, day, mon, d, y, time, ampm] = m;
    const long = mon!.length > 4 || mon === "May" && !!day && day.length > 3;
    const month = MONTHS[mon!] ?? mon!.toLowerCase();
    let out = long ? `${d} de ${month}${y ? ` de ${y}` : ""}` : `${d} ${month}${y ? ` ${y}` : ""}`;
    if (day) out = `${DAYS[day]}, ${out}`;
    if (time) out += `, ${time} ${ampm === "PM" ? "p. m." : "a. m."}`;
    return out;
  }
  const my = MONTH_YEAR_RE.exec(s);
  if (my) return `${MONTHS[my[1]!] ?? my[1]!.toLowerCase()} de ${my[2]}`;
  return null;
}

/** The Spanish for one line of English, or null when the list has none. */
export function lookup(c: Compiled, text: string): string | null {
  const en = norm(text);
  if (!en) return null;
  const hit = c.cache.get(en);
  if (hit !== undefined) return hit;
  let out: string | null = c.exact.get(en) ?? null;
  if (out === null) out = spanishDate(en);
  if (out === null && /[A-Za-z]/.test(en)) {
    const list = [...(c.byFirst.get(firstWord(en)) ?? []), ...c.anyStart];
    for (const t of list) {
      const m = t.re.exec(en);
      if (!m) continue;
      const vals = new Map<string, string>();
      t.names.forEach((n, i) => vals.set(n, m[i + 1]!));
      // A changing part that is itself a known line ("Parent") is translated too.
      out = t.es.replace(HOLE, (all, n: string) => {
        const v = vals.get(n);
        if (v === undefined) return all;
        return c.exact.get(norm(v)) ?? spanishDate(norm(v)) ?? v;
      });
      break;
    }
  }
  if (c.cache.size > 20000) c.cache.clear();
  c.cache.set(en, out);
  return out;
}

/** Translate keeping the spaces around the text, for text nodes. */
export function lookupKeepSpace(c: Compiled, raw: string): string | null {
  const t = lookup(c, raw);
  if (t === null) return null;
  const lead = raw.match(/^\s*/)![0];
  const trail = raw.match(/\s*$/)![0];
  return (lead ? " " : "") + t + (trail && raw.trim() ? " " : "");
}

/** The parts of a translated sentence with numbered tags, in order:
 * text pieces and tags with their inside text. */
export function splitTags(s: string): ({ text: string } | { tag: number; text: string })[] {
  const out: ({ text: string } | { tag: number; text: string })[] = [];
  let last = 0;
  TAG.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = TAG.exec(s)); ) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ tag: Number(m[1]), text: m[2]! });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
}

/** {names} in a line, for the check page's "keep these" warning. */
export const holes = (s: string) => [...new Set(s.match(HOLE) ?? [])].sort();
export const tags = (s: string) => [...new Set(s.match(/<\/?\d+>/g) ?? [])].sort();
/** What a reviewer's Spanish dropped from the English: {holes} and <1>tags</1>. */
export function missingParts(en: string, es: string): string[] {
  const have = new Set([...holes(es), ...tags(es)]);
  return [...holes(en), ...tags(en)].filter((p) => !have.has(p));
}
