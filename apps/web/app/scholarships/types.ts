import type { Scholarship } from "@scholartasks/core";

export interface Row extends Scholarship {
  kind: "scholarship" | "grant";
  sponsor: string; url: string; summary: string; how_to_apply: string | null; amount_text: string; amount_max: number | null;
  deadline_text: string | null; automatic: boolean; status: "pending" | "approved" | "retired" | "found"; last_checked: string | null; school_id?: string | null;
}
export interface Choice { id: string; student_id: string; scholarship_id: string; choice: "added" | "hidden"; task_id: string | null; done_steps?: number[]; essay_draft?: string | null }
