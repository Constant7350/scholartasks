/**
 * Every page in the app menu, in one place.
 * To add a page, add one line here and it shows up in the menu (and its search).
 *
 * The menu follows the family's journey (Constant, 2026-11-07): today's work first, then exploring
 * careers and colleges, school and grades, applying, money, and last the family and account pages.
 *
 * roles: who sees it. "parent" = parent account, "student" = a student signed in on their own,
 *        "none" = signed in but not in a family yet.
 * group: which section of the menu it sits in (see NAV_GROUPS). Inside a section, items keep the order below.
 * tab / studentTab: the four main pages in the phone tab bar (parents: Home, To do, Plan, Scholarships;
 *        students: Home, To do, Homework, Grades).
 * inMenu: false = reached from a tab row on a nearby page (for example Compare colleges from Find colleges),
 *        so it stays out of the menu lists but still shows in menu search and lights up its section.
 */

export type NavRole = "parent" | "student" | "none";

/**
 * Stages (Constant, 2026-11-07): a student's grade decides which pages show by default, so a 6th grader's
 * family is not looking at FAFSA and Common App for five years. Nothing is removed: a parent can turn on
 * "Show every page" for a student on the Family page, menu search still finds every page, and the stage
 * moves up by itself when the grade changes.
 *   explore = grades 6 to 8 (habits, career quiz, grades), build = grades 9 and 10 (course plan, activities,
 *   PSAT, first look at colleges and costs), apply = grades 11 and 12 (the full college and aid app).
 */
export type Stage = "explore" | "build" | "apply";
export const STAGES: { key: Stage; grades: string; en: string; es: string }[] = [
  { key: "explore", grades: "6-8", en: "Explore", es: "Explorar" },
  { key: "build", grades: "9-10", en: "Build", es: "Construir" },
  { key: "apply", grades: "11-12", en: "Apply", es: "Solicitar" },
];
export function stageOf(grade: number | null | undefined): Stage {
  if (grade == null) return "apply";
  if (grade <= 8) return "explore";
  if (grade <= 10) return "build";
  return "apply";
}
/**
 * True while a student is in grades 6 to 10 (explore or build stage) and no parent has turned on "Show every page".
 * Pages that would otherwise show college applications or senior scholarships use it to show what fits the
 * student's grade first (Constant, 2026-11-08: a 7th grader saw every college and scholarship; "apply to all grades").
 */
export function exploreView(s: { grade_level?: number | null; match_profile?: { show_all_pages?: boolean } | null } | null | undefined): boolean {
  return !!s && s.grade_level != null && stageOf(s.grade_level) !== "apply" && !s.match_profile?.show_all_pages;
}
/**
 * True while a student is in grades 6 to 8 and no parent has turned on "Show every page". Then colleges and
 * scholarships are for parents only, behind the Look ahead tile (Constant, 2026-11-08).
 */
export function youngView(s: { grade_level?: number | null; match_profile?: { show_all_pages?: boolean } | null } | null | undefined): boolean {
  return !!s && s.grade_level != null && stageOf(s.grade_level) === "explore" && !s.match_profile?.show_all_pages;
}
/** Does this page show by default at this stage? (No stages listed = every stage.) */
export function inStage(i: NavItem, stage: Stage): boolean {
  return !i.stages || i.stages.includes(stage);
}
/** Menu sections, shown in the order of NAV_GROUPS. The team sections only show for the ScholarTasks team. */
export type NavGroup = "today" | "explore" | "school" | "apply" | "money" | "family" | "team" | "teamTools";

export const NAV_GROUPS: { key: NavGroup; en: string; es: string; icon: string; team?: boolean }[] = [
  { key: "today", en: "Today", es: "Hoy", icon: "☀️" },
  { key: "explore", en: "Explore careers and colleges", es: "Explorar carreras y universidades", icon: "🧭" },
  { key: "school", en: "School and grades", es: "Escuela y notas", icon: "🎓" },
  { key: "apply", en: "Apply", es: "Solicitar", icon: "✍️" },
  { key: "money", en: "Money for college", es: "Dinero para la universidad", icon: "💰" },
  { key: "family", en: "Family and account", es: "Familia y cuenta", icon: "👪" },
  { key: "team", en: "ScholarTasks team", es: "Equipo de ScholarTasks", icon: "✅", team: true },
  { key: "teamTools", en: "Team: tools and plans", es: "Equipo: herramientas y planes", icon: "⚙️", team: true },
];

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: string;
  roles: NavRole[];
  group: NavGroup;
  /** Position in the parent's main tabs (1-4): the phone tab bar and, on computers, the strip under the top bar. "More" is always last. */
  tab?: number;
  /** Position in a student's main tabs (1-4). */
  studentTab?: number;
  /** Position in a parent's main tabs while the student is in the explore or build stage (grades 6 to 10). */
  earlyTab?: number;
  /** Stages where the page shows by default; leave out for every stage. See Stage above. */
  stages?: Stage[];
  /** Shows ONLY at these stages, and only while "Show every page" is off (for example Look ahead in grades 6 to 8). */
  onlyIn?: Stage[];
  /** false: not listed in the menu sections (reached from a tab row on a nearby page); still found by menu search. */
  inMenu?: boolean;
  /** Small link at the bottom of the menu instead of a row in a section. */
  small?: boolean;
  /** Website only: hidden inside the iPhone/Android app (app store payment rules). */
  webOnly?: boolean;
}

const ALL: NavRole[] = ["parent", "student", "none"];
const LATER: Stage[] = ["apply"];
const HS: Stage[] = ["build", "apply"];

export const NAV: NavItem[] = [
  // Today: what to do now
  { href: "/home", label: "Home", icon: "🏠", roles: ALL, group: "today", tab: 1, studentTab: 1, earlyTab: 1 },
  { href: "/todo", label: "To-do list", short: "To do", icon: "✅", roles: ALL, group: "today", tab: 2, studentTab: 2, earlyTab: 2 },
  { href: "/parent", label: "My parent space", short: "My space", icon: "👤", roles: ["parent"], group: "today" },
  { href: "/students", label: "My students", short: "My students", icon: "👪", roles: ["parent"], group: "today" },
  { href: "/homework", label: "Homework Helper", short: "Homework", icon: "🦉", roles: ["parent", "student"], group: "today", studentTab: 3 },
  { href: "/counselor", label: "AI counselor", short: "Counselor", icon: "🤖", roles: ALL, group: "today" },

  // Explore: what fits, and where it leads
  { href: "/career-quiz", label: "Career quiz", short: "Career quiz", icon: "🧩", roles: ALL, group: "explore", earlyTab: 4 },
  { href: "/look-ahead", label: "Look ahead: colleges and scholarships", short: "Look ahead", icon: "🔭", roles: ["parent"], group: "explore", onlyIn: ["explore"] },
  { href: "/colleges", label: "Find colleges", short: "Find colleges", icon: "🔎", roles: ALL, group: "explore", stages: HS },
  { href: "/majors", label: "Search colleges by major", short: "Colleges by major", icon: "🧭", roles: ALL, group: "explore", inMenu: false, stages: HS },
  { href: "/colleges/compare", label: "Compare colleges", short: "Compare", icon: "📊", roles: ALL, group: "explore", inMenu: false, stages: HS },
  { href: "/trades", label: "Trades and trade schools", short: "Trades", icon: "🔧", roles: ALL, group: "explore" },
  { href: "/trades/openings", label: "Apprenticeships and local openings", short: "Apprenticeships", icon: "🧰", roles: ALL, group: "explore", stages: HS },
  { href: "/jobs", label: "Weekend and holiday jobs", short: "Jobs", icon: "🛍️", roles: ALL, group: "explore", stages: HS },
  { href: "/military", label: "Military paths", short: "Military", icon: "🎖️", roles: ALL, group: "explore" },

  // School: grades and getting better at school
  { href: "/grades", label: "Grades and scholarships", short: "Grades", icon: "🎓", roles: ALL, group: "school", studentTab: 4, earlyTab: 3 },
  { href: "/grades/plan", label: "Four-year course plan", short: "Course plan", icon: "🗓️", roles: ALL, group: "school", stages: HS },
  { href: "/grades/record", label: "Academic record (print)", short: "Record", icon: "📄", roles: ALL, group: "school", inMenu: false },
  { href: "/study", label: "Study skills library", short: "Study", icon: "📚", roles: ALL, group: "school" },
  { href: "/practice", label: "Practice questions", short: "Practice", icon: "✏️", roles: ALL, group: "school", inMenu: false },
  { href: "/test-prep", label: "SAT and ACT prep", short: "SAT/ACT", icon: "📝", roles: ALL, group: "school", stages: HS },

  // Apply: the college list and everything an application needs
  { href: "/plan", label: "College list and deadlines", short: "Plan", icon: "🗂️", roles: ALL, group: "apply", tab: 3, stages: LATER },
  { href: "/essays", label: "College essays", short: "Essays", icon: "✍️", roles: ALL, group: "apply", stages: LATER },
  { href: "/challenge", label: "Challenges (win prizes)", short: "Challenges", icon: "🏆", roles: ["parent", "student"], group: "apply", inMenu: false },
  { href: "/activities", label: "Activities and resume", short: "Activities", icon: "🏅", roles: ALL, group: "apply", stages: HS },
  { href: "/activities/profile", label: "Application profile (copy and paste)", short: "Profile", icon: "📋", roles: ALL, group: "apply", inMenu: false, stages: LATER },
  { href: "/activities/common-app", label: "Common App ready", short: "Common App", icon: "✅", roles: ALL, group: "apply", inMenu: false, stages: LATER },
  { href: "/plan/papers", label: "Transcripts and letters", short: "Transcripts", icon: "📨", roles: ALL, group: "apply", stages: LATER },

  // Money
  { href: "/scholarships", label: "Scholarships and grants", short: "Scholarships", icon: "💰", roles: ALL, group: "money", tab: 4, stages: HS },
  { href: "/aid", label: "FAFSA and aid forms", short: "Aid forms", icon: "🧾", roles: ALL, group: "money", stages: LATER },
  { href: "/plan/offers", label: "Compare aid offers", short: "Offers", icon: "⚖️", roles: ALL, group: "money", inMenu: false, stages: LATER },

  // Family and account
  { href: "/family", label: "Family, students and permissions", short: "Family", icon: "👪", roles: ["parent"], group: "family" },
  { href: "/family", label: "Set up my family (parents)", short: "Set up family", icon: "👪", roles: ["none"], group: "family" },
  { href: "/join", label: "I'm a student: join with a code", short: "Join with a code", icon: "🔑", roles: ["none"], group: "family" },
  { href: "/my-school", label: "My school (connect to your counselor)", short: "My school", icon: "🏫", roles: ["parent", "student"], group: "family" },
  { href: "/school", label: "School counselor portal (free)", short: "Counselor portal", icon: "🏫", roles: ["none", "parent"], group: "family" },
  { href: "/security", label: "Face ID, sign-in and account", short: "Account", icon: "🔐", roles: ALL, group: "family" },
  { href: "/billing", label: "Plan and billing", short: "Billing", icon: "💳", roles: ["parent", "student"], group: "family", webOnly: true },

  // Small links at the bottom of the menu
  { href: "/help", label: "Help and how-to", short: "Help", icon: "❓", roles: ALL, group: "family", small: true },
  { href: "/invite", label: "Invite a friend", short: "Invite", icon: "💌", roles: ALL, group: "family", small: true },
  { href: "/rate", label: "Rate ScholarTasks", short: "Rate", icon: "⭐", roles: ALL, group: "family", small: true },

  { href: "/admin", label: "Team review", short: "Team review", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/answers", label: "Review counselor answers", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/questions", label: "Review practice questions", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/lessons", label: "Review study lessons", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/scholarships", label: "Review scholarships", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/trades", label: "Review trade facts", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/openings", label: "Review local openings", icon: "🧰", roles: ALL, group: "team" },
  { href: "/admin/schools", label: "Approve schools", icon: "🏫", roles: ALL, group: "team" },
  { href: "/admin/ratings", label: "App ratings and notes", icon: "⭐", roles: ALL, group: "team" },
  { href: "/admin/families", label: "Family accounts to look at", icon: "👪", roles: ALL, group: "team" },
  { href: "/admin/challenges", label: "Challenges: judge and prizes", icon: "🏆", roles: ALL, group: "team" },
  { href: "/admin/consents", label: "Signed consents and audit trail", icon: "✍️", roles: ALL, group: "team" },
  { href: "/check", label: "Spanish check page", icon: "🇪🇸", roles: ALL, group: "team" },
  { href: "/admin/college-data", label: "Load college data", icon: "🏫", roles: ALL, group: "teamTools" },
  { href: "/admin/presentation", label: "Presentation for parents and schools", icon: "🎤", roles: ALL, group: "teamTools" },
  { href: "/admin/marketing", label: "Marketing and business plan", icon: "📣", roles: ALL, group: "teamTools" },
  { href: "/admin/testers", label: "Testers and test links", icon: "🧪", roles: ALL, group: "teamTools" },
];

/** Tab-bar position of a page for this role, if it has one. */
export function tabOf(i: NavItem, role: NavRole): number | undefined {
  return role === "student" ? i.studentTab : i.tab;
}

/** True when this nav item is the page you are on (or a page inside it). */
export function isActive(href: string, path: string, exact = false): boolean {
  if (path === href) return true;
  return !exact && href !== "/home" && path.startsWith(href + "/");
}

/** The one menu item that best matches the page (so /grades/record lights up Record, not Grades). */
export function bestMatch(items: NavItem[], path: string): NavItem | undefined {
  return items.filter((i) => isActive(i.href, path)).sort((a, b) => b.href.length - a.href.length)[0];
}
