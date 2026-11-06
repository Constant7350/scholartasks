/**
 * Local openings: apprenticeships, paid training and entry-level jobs that
 * companies post on ScholarTasks (/trades/post). Our team reviews each one
 * before students see it. Students choose to contact the company themselves;
 * there is no messaging between companies and students inside the app.
 */

export const OPENING_KINDS = {
  apprenticeship: "Apprenticeship",
  pre_apprenticeship: "Pre-apprenticeship or youth apprenticeship",
  training: "Paid training program",
  job: "Entry-level job",
  internship: "Internship or job shadow",
} as const;
export type OpeningKind = keyof typeof OPENING_KINDS;

/** Youngest age a listing can be open to. Under-18 listings get an extra child labor law check. */
export const OPENING_MIN_AGES = [14, 15, 16, 17, 18, 21] as const;

/** Longest a listing stays up before the company has to post it again. */
export const OPENING_MAX_DAYS = 180;

/** The rules every company agrees to (shown on the form, checked by our team). */
export const OPENING_RULES = [
  "This is a real opening at our company, and the details are true.",
  "We never charge students or families a fee to apply, train or start work.",
  "We follow federal and state child labor laws for anyone under 18: allowed hours, work permits where the state requires them, and no hazardous work that the law bars for their age.",
  "Equal opportunity: we consider every qualified applicant regardless of race, color, religion, sex (including pregnancy, sexual orientation and gender identity), national origin, age, disability, genetic information, veteran status or any other status the law protects.",
  "Students contact us only through the way to apply we give here. We won't ask students for money, bank details or Social Security numbers before a real job offer.",
] as const;

/** Short safety notes shown to students and parents next to every listing. */
export const OPENING_SAFETY_TIPS = [
  "Our team checks each listing before it shows, but always look up the company yourself too.",
  "A real employer never asks you to pay to apply or train.",
  "Don't share your Social Security number or bank details until you have a written job offer.",
  "If you're under 18, talk it over with a parent first, and bring one to any first visit.",
] as const;

/** Official pages our team and companies use for the child labor and EEO checks. */
export const OPENING_LAW_LINKS = [
  { label: "Child labor rules for teens (U.S. Department of Labor, YouthRules)", url: "https://www.dol.gov/agencies/whd/youthrules" },
  { label: "Hazardous jobs teens can't do (U.S. Department of Labor)", url: "https://www.dol.gov/agencies/whd/child-labor/hazardous-occupations" },
  { label: "Equal employment opportunity (U.S. EEOC)", url: "https://www.eeoc.gov/employers" },
  { label: "Check a Registered Apprenticeship (apprenticeship.gov Partner Finder)", url: "https://www.apprenticeship.gov/partner-finder" },
] as const;

export interface OpeningInput {
  kind: OpeningKind;
  title: string;
  trade_slug: string | null;
  company_name: string;
  company_website: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  city: string;
  state: string;
  zip: string | null;
  min_age: number;
  pay: string | null;
  schedule: string | null;
  description: string;
  requirements: string | null;
  how_to_apply: string;
  apply_url: string | null;
  registered_apprenticeship: boolean;
  rapids_number: string | null;
  show_until: string;
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[a-z]{2,}$/i;
/** U.S. states, DC and Puerto Rico. */
export const OPENING_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR"] as const;
const ZIP = /^\d{5}$/;
const one = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const many = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "");
const links = (s: string) => (s.match(/https?:\/\//gi) ?? []).length;

/** A web address made safe to link to (https added when missing), or null. */
export function cleanUrl(v: unknown): string | null {
  const s = one(v, 300);
  if (!s) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Checks a company's listing before it is saved for review.
 * Returns the cleaned listing, or a plain-language error to show the company.
 * `spam: true` means the hidden trap field was filled in (a bot): pretend it worked and drop it.
 */
export function checkOpening(
  body: unknown,
  opts: { tradeSlugs: readonly string[]; today?: Date },
): { ok: true; opening: OpeningInput } | { ok: false; error: string; spam?: boolean } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (one(b.website, 200)) return { ok: false, error: "", spam: true };
  const today = opts.today ?? new Date();

  const kind = (Object.keys(OPENING_KINDS) as OpeningKind[]).includes(b.kind as OpeningKind) ? (b.kind as OpeningKind) : null;
  const title = one(b.title, 120);
  const tradeSlug = one(b.trade_slug, 80);
  const company = one(b.company_name, 120);
  const contactName = one(b.contact_name, 100);
  const contactEmail = one(b.contact_email, 200).toLowerCase();
  const phone = one(b.contact_phone, 30);
  const city = one(b.city, 80);
  const state = one(b.state, 3).toUpperCase();
  const zip = one(b.zip, 10);
  const minAge = Number(b.min_age);
  const description = many(b.description, 4000);
  const requirements = many(b.requirements, 2000);
  const howToApply = many(b.how_to_apply, 1000);
  const rawApplyUrl = one(b.apply_url, 300);
  const applyUrl = cleanUrl(rawApplyUrl);
  const rawSite = one(b.company_website, 300);
  const site = cleanUrl(rawSite);
  const registered = b.registered_apprenticeship === true || b.registered_apprenticeship === "yes" || b.registered_apprenticeship === "on";
  const rapids = one(b.rapids_number, 40);
  const agreed = b.agree === true || b.agree === "on" || b.agree === "yes";

  if (!company) return { ok: false, error: "Please add your company's name." };
  if (!contactName) return { ok: false, error: "Please add your name, so our team knows who to talk to." };
  if (!EMAIL.test(contactEmail)) return { ok: false, error: "Please check your email address. We'll send the review result there." };
  if (!kind) return { ok: false, error: "Please pick what kind of opening this is." };
  if (title.length < 4) return { ok: false, error: "Please give the opening a short title, like Electrical apprentice." };
  if (tradeSlug && !opts.tradeSlugs.includes(tradeSlug)) return { ok: false, error: "Please pick the trade from the list." };
  if (!city) return { ok: false, error: "Please add the city where the work is." };
  if (!(OPENING_STATES as readonly string[]).includes(state)) return { ok: false, error: "Please pick the state where the work is." };
  if (zip && !ZIP.test(zip)) return { ok: false, error: "Please check the ZIP code (5 numbers)." };
  if (!(OPENING_MIN_AGES as readonly number[]).includes(minAge)) return { ok: false, error: "Please pick the youngest age you can take." };
  if (description.length < 30) return { ok: false, error: "Please describe the opening in a few sentences: what the work is and what someone will learn." };
  if (howToApply.length < 5 && !applyUrl) return { ok: false, error: "Please tell students how to apply: a web link, an email or a phone number." };
  if (rawApplyUrl && !applyUrl) return { ok: false, error: "Please check the link for applying. It should look like www.yourcompany.com/jobs." };
  if (rawSite && !site) return { ok: false, error: "Please check your website address." };
  if (links(description) + links(requirements) + links(howToApply) > 3) return { ok: false, error: "Please take out some of the links and try again." };
  if (!agreed) return { ok: false, error: "Please read the listing rules and tick the box to agree." };

  const latest = new Date(today.getTime() + OPENING_MAX_DAYS * 86_400_000);
  const fallback = new Date(today.getTime() + 90 * 86_400_000);
  const wanted = /^\d{4}-\d{2}-\d{2}$/.test(one(b.show_until, 10)) ? new Date(`${one(b.show_until, 10)}T00:00:00Z`) : fallback;
  const showUntil = isNaN(wanted.getTime()) || wanted <= today ? fallback : wanted > latest ? latest : wanted;

  return {
    ok: true,
    opening: {
      kind, title, trade_slug: tradeSlug || null,
      company_name: company, company_website: site,
      contact_name: contactName, contact_email: contactEmail, contact_phone: phone || null,
      city, state, zip: zip || null, min_age: minAge,
      pay: one(b.pay, 120) || null, schedule: one(b.schedule, 160) || null,
      description, requirements: requirements || null,
      how_to_apply: howToApply, apply_url: applyUrl,
      registered_apprenticeship: kind === "apprenticeship" || kind === "pre_apprenticeship" ? registered : false,
      rapids_number: registered && rapids ? rapids : null,
      show_until: isoDay(showUntil),
    },
  };
}

/** What our team should double-check on a listing, in plain words. Empty means nothing stands out. */
export function openingReviewFlags(o: Pick<OpeningInput, "min_age" | "kind" | "registered_apprenticeship" | "rapids_number" | "description" | "how_to_apply" | "company_website">): string[] {
  const flags: string[] = [];
  if (o.min_age < 18) flags.push(`Open to ${o.min_age}-year-olds: check the duties against the hazardous jobs list and the hours rules for teens.`);
  if (o.min_age < 16) flags.push("Under 16: hours are limited (no work during school hours, short days on school days), and Georgia and many states need a work permit.");
  if (o.registered_apprenticeship) flags.push(o.rapids_number
    ? `Says it is a Registered Apprenticeship (number ${o.rapids_number}): look it up on apprenticeship.gov before ticking Verified.`
    : "Says it is a Registered Apprenticeship but gave no program number: look the company up on apprenticeship.gov.");
  const text = `${o.description} ${o.how_to_apply}`.toLowerCase();
  if (/\b(fee|deposit|pay (us|for)|buy your own|starter kit|cash app|venmo|zelle|wire)\b/.test(text)) flags.push("Mentions money or fees: make sure students are never asked to pay.");
  if (/\b(ssn|social security|bank account|routing number)\b/.test(text)) flags.push("Asks for private details: students should not share these before a job offer.");
  if (!o.company_website) flags.push("No company website: look the company up (Georgia Secretary of State business search, Google) before approving.");
  return flags;
}

export interface OpeningRow {
  id: string;
  kind: OpeningKind;
  title: string;
  trade_slug: string | null;
  company_name: string;
  city: string;
  state: string;
  min_age: number;
  registered_verified?: boolean;
  approved_at?: string | null;
}

/**
 * Sorts listings for one student: home state first, then the rest of the
 * country (nationwide options always show), newest first inside each group.
 */
export function sortOpenings<T extends OpeningRow>(rows: T[], homeState: string | null): { home: T[]; elsewhere: T[] } {
  const newest = (a: T, b: T) => (b.approved_at ?? "").localeCompare(a.approved_at ?? "") || a.title.localeCompare(b.title);
  const st = homeState?.toUpperCase() ?? null;
  return {
    home: rows.filter((r) => st && r.state === st).sort(newest),
    elsewhere: rows.filter((r) => !st || r.state !== st).sort((a, b) => a.state.localeCompare(b.state) || newest(a, b)),
  };
}
