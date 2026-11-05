"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import { StatusPill, whenOf } from "../review-kit";

interface Row {
  id: string; name: string; city: string; state: string; website: string | null; phone: string | null;
  status: "pending" | "approved" | "closed"; created_at: string;
  staff: { name: string; title: string | null; role: string; email: string | null }[]; students: number;
}

/**
 * The ScholarTasks team confirms each school before its counselors can see any student.
 * Check: the school exists (website, phone), and the person who signed up uses a school
 * email address or is listed on the school's staff page.
 */
export default function SchoolReview() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/schools");
    const a = await sb.rpc("is_app_admin");
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const { data, error: e } = await sb.rpc("schools_for_review");
    if (e) setError(/schools_for_review/.test(e.message) ? "Run database update 37 in Supabase first." : friendly(e));
    setRows((data as Row[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Review schools"><NotConfigured /></Page>;
  if (admin === undefined) return <Page title="Review schools"><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title="Review schools"><p className="note note-err">This page is for the ScholarTasks team.</p></Page>;

  const set = async (id: string, status: Row["status"]) => {
    setError(null);
    const { error: e } = await sb.rpc("review_school", { p_school: id, p_status: status });
    if (e) setError(friendly(e)); else void load();
  };
  const waiting = rows.filter((r) => r.status === "pending").length;

  return (
    <Page title="Review schools">
      <p className="hint">
        Approve a school only when it's real and the person is staff there: a school email address, or their name on the school's website.
        Counselors see nothing until you approve. {waiting ? `${waiting} waiting.` : "Nothing waiting."}
      </p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {rows.map((r) => (
        <div key={r.id} className="panel">
          <h2>{r.name} <StatusPill status={r.status === "approved" ? "ok" : r.status === "pending" ? "wait" : "off"} label={r.status === "approved" ? "Approved" : r.status === "pending" ? "Waiting" : "Closed"} /></h2>
          <p className="hint">
            {r.city}, {r.state} · signed up {whenOf(r.created_at)} · {r.students} {r.students === 1 ? "student" : "students"} connected
            {r.website && <> · <a href={r.website} target="_blank" rel="noreferrer">website</a></>}
            {r.phone && <> · {r.phone}</>}
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
            {r.staff.map((s, i) => <li key={i}>{s.name}{s.title ? `, ${s.title}` : ""} ({s.role}) · {s.email ?? "no email"}</li>)}
          </ul>
          <div className="share-row">
            {r.status !== "approved" && <button className="btn btn-inline" onClick={() => void set(r.id, "approved")}>Approve</button>}
            {r.status !== "closed" && <button className="btn btn-ghost btn-inline" style={{ color: "#b42318" }} onClick={() => window.confirm(`Close ${r.name}? Its counselors stop seeing students.`) && void set(r.id, "closed")}>Close</button>}
            {r.status === "closed" && <button className="btn btn-ghost btn-inline" onClick={() => void set(r.id, "pending")}>Reopen as waiting</button>}
          </div>
        </div>
      ))}
    </Page>
  );
}
