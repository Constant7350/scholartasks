/**
 * What a parent can allow or block in a child's student app.
 * Keep keys in sync with permission_keys() in supabase/migrations/0002_family_accounts.sql
 * (a test checks this).
 */
export const PERMISSIONS = [
  { key: "enter_grades", label: "Enter grades and test scores", defaultUnder18: true },
  { key: "ai_chat", label: "Chat with the AI counselor and study coach", defaultUnder18: true },
  { key: "see_income_and_costs", label: "See family income band and cost estimates", defaultUnder18: false },
  { key: "mark_done_without_approval", label: "Mark forms and scholarships done without my approval", defaultUnder18: true },
  { key: "change_plan_without_approval", label: "Change the college list or plan without my approval", defaultUnder18: false },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];
export type Permissions = Record<PermissionKey, boolean>;

export const defaultPermissions = (): Permissions =>
  Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.defaultUnder18])) as Permissions;
