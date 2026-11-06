import { JOB_APPLICATION_STATUS, type JobApplicationStatus } from "@scholartasks/core";
import { supabase } from "./supabase";

/** One in-app job application as the family sees it. */
export interface FamilyApplication {
  id: string; opening_id: string; student_id: string; message: string; availability: string | null;
  share_email: string | null; share_phone: string | null; parent_email: string | null;
  status: JobApplicationStatus; employer_note: string | null; parent_decided_at: string | null;
  consent_version: string | null; sent_at: string | null; created_at: string;
}

/** One application as a company sees it (only after a parent agreed). */
export interface CompanyApplication {
  id: string; opening_id: string; opening_title: string; first_name: string; grade_level: number; age: number;
  message: string; availability: string | null; share_email: string | null; share_phone: string | null;
  parent_email: string | null; status: JobApplicationStatus; employer_note: string | null; sent_at: string;
}

export interface Employer {
  id: string; company_name: string; website: string | null; contact_name: string; contact_email: string;
  phone: string | null; city: string; state: string; status: "pending" | "approved" | "blocked"; review_note: string | null;
  agreed_rules_at: string; created_at: string;
}

export const statusLabel = (s: JobApplicationStatus) => JOB_APPLICATION_STATUS[s] ?? s;

/** The consent wording a parent agrees to. Kept in the database so the saved record matches exactly. */
export async function consentText(): Promise<{ version: string; wording: string } | null> {
  const { data } = (await supabase()?.rpc("job_consent_text")) ?? { data: null };
  return ((data as { version: string; wording: string }[] | null) ?? [])[0] ?? null;
}

/** Asks the server to send the emails that go with a change (parents, company or our team). Never blocks the page. */
export async function notifyJobs(id: string, event: "applied" | "decided" | "status" | "posted") {
  const sb = supabase();
  if (!sb) return;
  const { data: s } = await sb.auth.getSession();
  await fetch("/api/jobs/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
    body: JSON.stringify({ id, event }),
  }).catch(() => null);
}

/** Plain words for database errors from the job functions. */
export function jobError(m: string): string {
  if (/too young/.test(m)) return "This job is for older students. Check the age on the listing.";
  if (/under 13/.test(m)) return "Jobs here are for students 13 and older.";
  if (/already applied/i.test(m)) return "You already applied to this job. You can see it under My job applications.";
  if (/does not exist|schema cache/i.test(m)) return "This part isn't switched on yet. Please try again soon.";
  if (/not allowed/.test(m)) return "You don't have access to do that.";
  return m.replace(/^.*?: /, "");
}
