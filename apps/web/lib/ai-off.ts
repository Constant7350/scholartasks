/** Why an AI turn was refused, in plain words. */
export function aiOffMessage(e: { message?: string } | null | undefined, fallback = "AI features are turned off for this student. A parent can turn on AI chat in Family and permissions."): string {
  return /under 13/.test(e?.message ?? "")
    ? "AI help starts at age 13. Until then, a parent can use ScholarTasks with their student, and the lessons, practice questions and career quiz work without AI."
    : fallback;
}
