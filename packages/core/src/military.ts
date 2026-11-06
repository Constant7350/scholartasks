// Military paths: the five federal service academies, the six senior military
// colleges, the four military junior colleges, ROTC and enlisting. Used by the
// Military page (/military), the "Military colleges" pick in college search and
// the AI counselor. Dates and amounts change every year; the page always says to
// confirm on each official site.

export interface ServiceAcademy {
  /** College Scorecard id (colleges table). */
  id: number;
  name: string;
  short: string;
  state: string;
  branch: string;
  /** Needs a nomination (usually from a member of Congress). */
  nomination: boolean;
  url: string;
  /** Summer program for high school juniors. */
  summer: string;
  note: string;
}

export const SERVICE_ACADEMIES: ServiceAcademy[] = [
  { id: 197036, name: "United States Military Academy", short: "West Point", state: "NY", branch: "Army", nomination: true, url: "https://www.westpoint.edu/admissions", summer: "Summer Leaders Experience (SLE)", note: "Graduates become Army officers." },
  { id: 164155, name: "United States Naval Academy", short: "Naval Academy (Annapolis)", state: "MD", branch: "Navy and Marine Corps", nomination: true, url: "https://www.usna.edu/Admissions/", summer: "Summer Seminar", note: "Graduates become Navy or Marine Corps officers." },
  { id: 128328, name: "United States Air Force Academy", short: "Air Force Academy", state: "CO", branch: "Air Force and Space Force", nomination: true, url: "https://www.academyadmissions.com/", summer: "Summer Seminar", note: "Graduates become Air Force or Space Force officers." },
  { id: 130624, name: "United States Coast Guard Academy", short: "Coast Guard Academy", state: "CT", branch: "Coast Guard", nomination: false, url: "https://www.uscga.edu/admissions/", summer: "AIM (Academy Introduction Mission)", note: "No nomination needed: you apply like a regular college." },
  { id: 197027, name: "United States Merchant Marine Academy", short: "Merchant Marine Academy (Kings Point)", state: "NY", branch: "Merchant Marine, with a reserve officer commission", nomination: true, url: "https://www.usmma.edu/admissions", summer: "Summer seminar (Kings Point)", note: "Graduates serve as licensed ship officers, in a maritime job, or on active duty; options are wider than the other academies." },
];

export interface MilitaryCollege { id: number; name: string; state: string; kind: "senior" | "junior"; url: string; note: string }

/**
 * Senior military colleges (federal law, 10 U.S.C. 2111a): a corps of cadets
 * and ROTC alongside regular students. Military junior colleges: two-year
 * schools where students can become Army officers in two years (Early
 * Commissioning Program), then finish a bachelor's.
 */
export const MILITARY_COLLEGES: MilitaryCollege[] = [
  { id: 482680, name: "University of North Georgia", state: "GA", kind: "senior", url: "https://ung.edu/corps-of-cadets/", note: "The Military College of Georgia. HOPE and Zell work here." },
  { id: 217864, name: "The Citadel", state: "SC", kind: "senior", url: "https://www.citadel.edu/", note: "Corps of Cadets in Charleston." },
  { id: 234085, name: "Virginia Military Institute", state: "VA", kind: "senior", url: "https://www.vmi.edu/", note: "Every student is a cadet." },
  { id: 233921, name: "Virginia Tech", state: "VA", kind: "senior", url: "https://vtcc.vt.edu/", note: "Corps of Cadets inside a large university." },
  { id: 228723, name: "Texas A&M University", state: "TX", kind: "senior", url: "https://corps.tamu.edu/", note: "Corps of Cadets inside a large university." },
  { id: 230995, name: "Norwich University", state: "VT", kind: "senior", url: "https://www.norwich.edu/", note: "The oldest private military college." },
  { id: 485111, name: "Georgia Military College", state: "GA", kind: "junior", url: "https://www.gmc.edu/", note: "Two-year college in Milledgeville with an Early Commissioning Program. HOPE works here." },
  { id: 101648, name: "Marion Military Institute", state: "AL", kind: "junior", url: "https://marionmilitary.edu/", note: "Early Commissioning Program and a Service Academy Prep program." },
  { id: 187912, name: "New Mexico Military Institute", state: "NM", kind: "junior", url: "https://www.nmmi.edu/", note: "Early Commissioning Program and a Service Academy Prep program." },
  { id: 216551, name: "Valley Forge Military College", state: "PA", kind: "junior", url: "https://www.vfmac.edu/", note: "Early Commissioning Program." },
];

/** Every college the "Military colleges" pick shows. */
export const MILITARY_COLLEGE_IDS: number[] = [...SERVICE_ACADEMIES.map((a) => a.id), ...MILITARY_COLLEGES.map((c) => c.id)];

/** Short label for a college card ("Service academy", "Senior military college"...), or null. */
export function militaryLabel(id: number): string | null {
  if (SERVICE_ACADEMIES.some((a) => a.id === id)) return "Service academy";
  const c = MILITARY_COLLEGES.find((x) => x.id === id);
  return c ? (c.kind === "senior" ? "Senior military college" : "Military junior college") : null;
}

export interface MilitaryPath { id: string; title: string; summary: string; cost: string; serve: string; steps: string[]; links: { label: string; url: string }[] }

/** The four ways in, side by side. */
export const MILITARY_PATHS: MilitaryPath[] = [
  {
    id: "academy", title: "Service academy",
    summary: "A four-year college run by the military. You earn a bachelor's degree and become an officer.",
    cost: "Tuition, housing and food are free, and cadets get a monthly stipend.",
    serve: "About 5 years of active duty after graduation (plus reserve years); details differ by academy.",
    steps: [
      "Grades 9 to 11: take hard classes (math through precalculus or calculus, lab sciences), play a sport, lead something, and stay fit.",
      "Spring of grade 11: apply to the academy's summer program and open the academy's online application (most open in the winter or spring of junior year).",
      "Spring to fall of grade 11 to 12: apply for nominations from both U.S. senators and your U.S. representative (each office has its own form and deadline, often September to November of senior year). The Coast Guard Academy needs no nomination.",
      "Senior year: finish the application, the Candidate Fitness Assessment and the medical exam (DoDMERB), and take the SAT or ACT. Final deadlines are usually December to February.",
    ],
    links: [{ label: "Find your representative", url: "https://www.house.gov/representatives/find-your-representative" }, { label: "Find your senators", url: "https://www.senate.gov/senators/senators-contact.htm" }],
  },
  {
    id: "rotc", title: "ROTC at a regular college",
    summary: "Go to almost any college, take military classes and training, and become an officer when you graduate. Army, Navy (and Marine Corps) and Air Force (and Space Force) ROTC.",
    cost: "ROTC scholarships can pay full tuition, plus money for books and a monthly stipend. You can also join ROTC without a scholarship and try for one in college.",
    serve: "Usually 4 years of active duty, or longer in the Reserve or National Guard, after graduation if you took the scholarship.",
    steps: [
      "Grades 9 to 11: the same as for an academy: strong grades, SAT or ACT, sports, leadership and fitness. JROTC in high school helps but is not required.",
      "Summer before grade 12: the national ROTC scholarship applications open. Deadlines are usually December to February of senior year.",
      "Senior year: interview and fitness test; pick colleges that host your branch's ROTC (or a nearby partner school).",
    ],
    links: [{ label: "Army ROTC", url: "https://www.goarmy.com/careers-and-jobs/find-your-path/army-officers/rotc" }, { label: "Navy ROTC", url: "https://www.netc.navy.mil/NSTC/NROTC/" }, { label: "Air Force ROTC", url: "https://www.afrotc.com/" }],
  },
  {
    id: "military-college", title: "Military college",
    summary: "A senior military college (like the University of North Georgia, The Citadel or Virginia Tech) has a corps of cadets alongside regular students. A military junior college (like Georgia Military College) lets you become an Army officer in two years, then finish a bachelor's.",
    cost: "Regular college prices; HOPE works at Georgia's (UNG and Georgia Military College). ROTC and state scholarships can cover much of it.",
    serve: "Only cadets who take an ROTC scholarship or a commission owe service.",
    steps: ["Apply like any college. Ask about the corps of cadets, ROTC scholarships and, at junior colleges, the Early Commissioning Program and service academy prep."],
    links: [{ label: "University of North Georgia Corps of Cadets", url: "https://ung.edu/corps-of-cadets/" }, { label: "Georgia Military College", url: "https://www.gmc.edu/" }],
  },
  {
    id: "enlist", title: "Enlist after high school",
    summary: "Join the Army, Navy, Marine Corps, Air Force, Space Force or Coast Guard, or the National Guard or Reserve part time. You get paid job training in hundreds of fields, many of them trades (mechanics, electrical, medical, IT).",
    cost: "Paid while you train. Tuition Assistance helps pay for college classes while you serve, and the GI Bill can pay for college or trade school later.",
    serve: "Usually 4 to 6 years for active duty enlistments (part time for Guard and Reserve).",
    steps: [
      "Grades 10 to 12: take the ASVAB (many high schools give it free through the ASVAB Career Exploration Program); your score decides which jobs you qualify for.",
      "Talk with recruiters from more than one branch, with a parent. Ask what job, bonus and school benefits will be written into your contract.",
      "You can sign at 17 with a parent's permission (Delayed Entry Program) and ship after graduation. A high school diploma opens the most jobs.",
    ],
    links: [{ label: "ASVAB Career Exploration Program", url: "https://www.asvabprogram.com/" }, { label: "Today's Military (all branches)", url: "https://www.todaysmilitary.com/" }, { label: "GI Bill", url: "https://www.va.gov/education/about-gi-bill-benefits/" }],
  },
];

/** To-do steps a family can add, by grade, for a student thinking about a service academy or ROTC. */
export const MILITARY_TODOS: { key: string; title: string; grades: number[]; month: number; day: number; url?: string }[] = [
  { key: "summer", title: "Apply to a service academy summer program (West Point SLE, Naval Academy Summer Seminar, Air Force Summer Seminar, Coast Guard AIM)", grades: [11], month: 1, day: 15, url: "https://www.westpoint.edu/admissions/summer-leaders-experience" },
  { key: "apply", title: "Open the service academy online applications (candidate questionnaire)", grades: [11], month: 3, day: 1, url: "https://www.usna.edu/Admissions/" },
  { key: "nominate", title: "Find and start nomination forms for both U.S. senators and your U.S. representative", grades: [11], month: 5, day: 1, url: "https://www.house.gov/representatives/find-your-representative" },
  { key: "rotc", title: "Apply for national ROTC scholarships (Army, Navy, Air Force); they open the summer before senior year", grades: [11], month: 7, day: 1, url: "https://www.goarmy.com/careers-and-jobs/find-your-path/army-officers/rotc" },
  { key: "nomination-due", title: "Turn in congressional nomination applications (check each office's deadline)", grades: [12], month: 9, day: 15 },
  { key: "fitness", title: "Take the Candidate Fitness Assessment and finish the medical exam (DoDMERB)", grades: [12], month: 10, day: 15 },
  { key: "finish", title: "Finish service academy and ROTC scholarship applications (final deadlines are usually December to February)", grades: [12], month: 12, day: 15 },
  { key: "asvab", title: "Take the ASVAB (ask your school counselor about a free test date)", grades: [10, 11, 12], month: 10, day: 1, url: "https://www.asvabprogram.com/" },
];

/**
 * When each military to-do is due for a student in this grade: the next date
 * (month and day) in a grade the step belongs to, counting school years from
 * August. Steps for grades already finished are left out.
 */
export function militaryTodoDates(gradeLevel: number, today: string): { key: string; title: string; due: string; url?: string }[] {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const thisStart = m >= 8 ? y : y - 1;
  const out: { key: string; title: string; due: string; url?: string }[] = [];
  for (const t of MILITARY_TODOS) {
    for (const g of [...t.grades].sort((a, b) => a - b)) {
      if (g < gradeLevel) continue;
      const year = thisStart + (g - gradeLevel) + (t.month >= 8 ? 0 : 1);
      const due = `${year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
      if (due < today) continue;
      out.push({ key: t.key, title: t.title, due, ...(t.url ? { url: t.url } : {}) });
      break;
    }
  }
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
