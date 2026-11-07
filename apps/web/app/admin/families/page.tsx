"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

interface Flag { family_id: string; family_name: string; students: number; student_limit: number; students_signed_in: number; apart: number; last_seen: string | null }

/**
 * Sharing guard (Constant, 2026-11-07), team only. Lists family accounts worth a look: 5 or more
 * students, or students whose devices were never on the same network as a parent's device in the
 * last 90 days. Nothing happens to a family automatically: split households, boarding school and
 * grandparents raising grandchildren all look like this too, so a person looks first.
 */
export default function FamilyFlagsPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<Flag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/families");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const { data, error: e } = await sb.rpc("family_account_flags");
    if (e) setError(e.code === "PGRST202" || e.code === "42883" ? "This page needs database update 66 first." : friendly(e));
    setRows((data as Flag[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  async function raise(f: Flag) {
    if (!sb) return;
    const next = f.student_limit + 2;
    const { error: e } = await sb.rpc("set_family_student_limit", { p_family: f.family_id, p_limit: next });
    if (e) return setError(friendly(e));
    setNotice(`${f.family_name} can now have up to ${next} students. Raising the limit is free; each student after the first 2 is still billed at the extra-student price.`);
    void load();
  }

  const title = "Family accounts";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === false) return <Page title={title}><p className="hint">This page is for the ScholarTasks team.</p></Page>;
  const apart = rows.reduce((t, r) => t + r.apart, 0);

  return (
    <Page title={title}>
      <p className="hint">Accounts with 5 or more students, or students who were never on the same network as a parent in the last 90 days. Look before saying anything: two-home families, boarding students and grandparents raising grandchildren look like this too. Nothing happens to an account by itself.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {notice && <p className="note note-ok" role="status">{notice}</p>}
      <div className="panel">
        <h2>{apart} {apart === 1 ? "student" : "students"} never on a parent&apos;s network</h2>
        <p className="hint">Across {rows.length} {rows.length === 1 ? "account" : "accounts"} on this list. If this number keeps climbing, it is time for a household check.</p>
      </div>
      {rows.length === 0 && admin && !error && <p className="hint">No accounts to look at right now.</p>}
      <div>
        {rows.map((r) => (
          <div key={r.family_id} className="panel">
            <b>{r.family_name}</b>
            <p className="hint" style={{ margin: "4px 0" }}>
              {r.students} of {r.student_limit} students · {r.students_signed_in} signed in · {r.apart} never on a parent&apos;s network
              {r.last_seen ? ` · last seen ${r.last_seen}` : ""}
            </p>
            {r.students >= r.student_limit && (
              <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void raise(r)}>Allow 2 more students</button>
            )}
          </div>
        ))}
      </div>
    </Page>
  );
}
