/**
 * Every page in the app menu, in one place.
 * To add a page (SAT/ACT prep, FAFSA help, billing...), add one line here and it shows up in
 * the menu, the page strip under the top bar and (if it has a `tab` number) the phone tab bar.
 *
 * roles: who sees it. "parent" = parent account, "student" = a student signed in on their own,
 *        "none" = signed in but not in a family yet.
 * group: which section of the menu it sits in (see NAV_GROUPS). Inside a section, items keep the order below.
 * strip: also show it in the page strip / phone tab bar (short label is used there).
 */

export type NavRole = "parent" | "student" | "none";
/** Menu sections, shown in the order of NAV_GROUPS. The team sections only show for the ScholarTasks team. */
export type NavGroup = "daily" | "colleges" | "grades" | "study" | "apply" | "fund" | "family" | "help" | "team" | "teamTools";

export const NAV_GROUPS: { key: NavGroup; en: string; es: string; team?: boolean }[] = [
  { key: "daily", en: "Every day", es: "Cada día" },
  { key: "colleges", en: "Colleges and careers", es: "Universidades y carreras" },
  { key: "grades", en: "Grades and courses", es: "Notas y clases" },
  { key: "study", en: "Study and test prep", es: "Estudio y exámenes" },
  { key: "apply", en: "Applications", es: "Solicitudes" },
  { key: "fund", en: "Fund college", es: "Financiar la universidad" },
  { key: "family", en: "Family and account", es: "Familia y cuenta" },
  { key: "help", en: "Help", es: "Ayuda" },
  { key: "team", en: "Team: review", es: "Equipo: revisar", team: true },
  { key: "teamTools", en: "Team: tools and plans", es: "Equipo: herramientas y planes", team: true },
];

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: string;
  roles: NavRole[];
  group: NavGroup;
  /** Show in the page strip under the top bar (desktop). */
  strip?: boolean;
  /** Position in the phone tab bar (1-4). "More" is always last. */
  tab?: number;
  /** Website only: hidden inside the iPhone/Android app (app store payment rules). */
  webOnly?: boolean;
}

const ALL: NavRole[] = ["parent", "student", "none"];

export const NAV: NavItem[] = [
  { href: "/home", label: "Home", icon: "🏠", roles: ALL, group: "daily", strip: true, tab: 1 },
  { href: "/todo", label: "To-do list", short: "To do", icon: "✅", roles: ALL, group: "daily", strip: true },
  { href: "/plan", label: "College list and deadlines", short: "Plan", icon: "🗂️", roles: ALL, group: "colleges", strip: true, tab: 2 },
  { href: "/colleges", label: "Find colleges", short: "Find colleges", icon: "🔎", roles: ALL, group: "colleges" },
  { href: "/majors", label: "Search colleges by major", short: "By major", icon: "🧭", roles: ALL, group: "colleges" },
  { href: "/colleges/compare", label: "Compare colleges", short: "Compare", icon: "📊", roles: ALL, group: "colleges" },
  { href: "/majors/quiz", label: "Career quiz", short: "Career quiz", icon: "🧩", roles: ALL, group: "colleges" },
  { href: "/trades", label: "Trades and trade schools", short: "Trades", icon: "🔧", roles: ALL, group: "colleges" },
  { href: "/military", label: "Military paths", short: "Military", icon: "🎖️", roles: ALL, group: "colleges" },
  { href: "/grades", label: "Grades and scholarships", short: "Grades", icon: "🎓", roles: ALL, group: "grades", strip: true, tab: 3 },
  { href: "/grades/plan", label: "Four-year course plan", short: "Course plan", icon: "🗓️", roles: ALL, group: "grades" },
  { href: "/grades/record", label: "Academic record (print)", short: "Record", icon: "📄", roles: ALL, group: "grades" },
  { href: "/essays", label: "College essays", short: "Essays", icon: "✍️", roles: ALL, group: "apply" },
  { href: "/activities", label: "Activities and resume", short: "Activities", icon: "🏅", roles: ALL, group: "apply" },
  { href: "/activities/profile", label: "Application profile (copy and paste)", short: "Profile", icon: "📋", roles: ALL, group: "apply" },
  { href: "/activities/common-app", label: "Common App ready", short: "Common App", icon: "✅", roles: ALL, group: "apply" },
  { href: "/scholarships", label: "Scholarships and grants", short: "Scholarships", icon: "💰", roles: ALL, group: "fund", strip: true, tab: 4 },
  { href: "/aid", label: "FAFSA and aid forms", short: "Aid forms", icon: "🧾", roles: ALL, group: "fund" },
  { href: "/plan/offers", label: "Compare aid offers", short: "Offers", icon: "⚖️", roles: ALL, group: "fund" },
  { href: "/homework", label: "Homework Helper", short: "Homework", icon: "🦉", roles: ["parent", "student"], group: "daily", strip: true },
  { href: "/counselor", label: "AI counselor", short: "Counselor", icon: "🤖", roles: ALL, group: "daily", strip: true },
  { href: "/study", label: "Study skills library", short: "Study", icon: "📚", roles: ALL, group: "study", strip: true },
  { href: "/practice", label: "Practice questions", short: "Practice", icon: "✏️", roles: ALL, group: "study", strip: true },
  { href: "/test-prep", label: "SAT and ACT prep", short: "SAT/ACT", icon: "📝", roles: ALL, group: "study", strip: true },

  { href: "/family", label: "Family, students and permissions", icon: "👪", roles: ["parent"], group: "family" },
  { href: "/family", label: "Set up my family (parents)", icon: "👪", roles: ["none"], group: "family" },
  { href: "/join", label: "I'm a student: join with a code", icon: "🔑", roles: ["none"], group: "family" },
  { href: "/my-school", label: "My school (connect to your counselor)", short: "My school", icon: "🏫", roles: ["parent", "student"], group: "family" },
  { href: "/school", label: "School counselor portal (free)", icon: "🏫", roles: ["none", "parent"], group: "family" },
  { href: "/security", label: "Face ID, sign-in and account", short: "Account", icon: "🔐", roles: ALL, group: "family" },
  { href: "/billing", label: "Plan and billing", short: "Billing", icon: "💳", roles: ["parent", "student"], group: "family", webOnly: true },

  { href: "/help", label: "Help and how-to", icon: "❓", roles: ALL, group: "help" },
  { href: "/invite", label: "Invite a friend", short: "Invite", icon: "💌", roles: ALL, group: "help" },
  { href: "/rate", label: "Rate ScholarTasks", short: "Rate", icon: "⭐", roles: ALL, group: "help" },

  { href: "/admin/answers", label: "Review counselor answers", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/questions", label: "Review practice questions", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/lessons", label: "Review study lessons", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/scholarships", label: "Review scholarships", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/trades", label: "Review trade facts", icon: "✅", roles: ALL, group: "team" },
  { href: "/admin/schools", label: "Approve schools", icon: "🏫", roles: ALL, group: "team" },
  { href: "/admin/ratings", label: "App ratings and notes", icon: "⭐", roles: ALL, group: "team" },
  { href: "/admin/college-data", label: "Load college data", icon: "🏫", roles: ALL, group: "teamTools" },
  { href: "/admin/presentation", label: "Presentation for parents and schools", icon: "🎤", roles: ALL, group: "teamTools" },
  { href: "/admin/marketing", label: "Marketing and business plan", icon: "📣", roles: ALL, group: "teamTools" },
];

/** True when this nav item is the page you are on (or a page inside it). */
export function isActive(href: string, path: string, exact = false): boolean {
  if (path === href) return true;
  return !exact && href !== "/home" && path.startsWith(href + "/");
}

/** The one menu item that best matches the page (so /grades/record lights up Record, not Grades). */
export function bestMatch(items: NavItem[], path: string): NavItem | undefined {
  return items.filter((i) => isActive(i.href, path)).sort((a, b) => b.href.length - a.href.length)[0];
}
