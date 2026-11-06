"use client";

import { useCallback, useEffect, useState } from "react";
import { PART_TIME_KINDS } from "@scholartasks/core";
import { supabase } from "../../lib/supabase";
import { jobError } from "../../lib/jobs";
import { OpeningsList } from "../trades/openings-list";
import { MyApplications } from "./applications";

interface Ref {
  id: string; student_id: string; company_name: string; job_title: string; writer_name: string; writer_role: string | null;
  worked_from: string | null; worked_to: string | null; letter: string; family_status: "new" | "kept" | "hidden"; created_at: string;
}

/** The family's side of weekend and holiday jobs: applications (parents agree there), reference letters, then jobs to apply for. */
export function JobsHome() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return;
    setSignedIn(true);
    const [mem, r] = await Promise.all([
      sb.from("family_members").select("role").eq("user_id", s.session.user.id),
      sb.from("job_references").select("*").order("created_at", { ascending: false }),
    ]);
    setIsParent(((mem.data as { role: string }[]) ?? []).some((m) => m.role === "parent"));
    setRefs((r.data as Ref[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setError(null); setMsg(null);
    const { error: e } = await fn();
    if (e) return setError(jobError(e.message));
    setMsg(ok);
    void load();
  };

  return (
    <>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note note-ok" role="status">{msg}</p>}

      <MyApplications part="parttime" />

      {signedIn && refs.length > 0 && (
        <section className="panel">
          <h2>Reference letters ({refs.length})</h2>
          <p className="hint">Letters from employers about work ethic and character. A parent decides: keep a letter in the records (it shows on the resume), or hide it so it never counts. The company isn&apos;t told.</p>
          <ul className="opening-list">{refs.map((r) => (
            <li key={r.id} className="opening-card">
              <h3>{r.company_name}: {r.job_title}</h3>
              <p className="hint">From {r.writer_name}{r.writer_role ? `, ${r.writer_role}` : ""}{r.worked_from ? ` · worked ${r.worked_from}${r.worked_to ? ` to ${r.worked_to}` : ""}` : ""}</p>
              <details open={r.family_status === "new"}><summary>Read the letter</summary><p className="pre">{r.letter}</p></details>
              <p className="opening-actions">
                <span className={`pill${r.family_status === "kept" ? " pill-ok" : ""}`}>{r.family_status === "kept" ? "In the records" : r.family_status === "hidden" ? "Hidden" : "New"}</span>
                {isParent && r.family_status !== "kept" && <button className="btn btn-inline btn-sm" onClick={() => void run(() => sb!.rpc("family_set_reference", { p_id: r.id, p_keep: true }), "Kept in the records.")}>Keep in records</button>}
                {isParent && r.family_status !== "hidden" && <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void run(() => sb!.rpc("family_set_reference", { p_id: r.id, p_keep: false }), "Hidden.")}>Hide</button>}
              </p>
            </li>
          ))}</ul>
        </section>
      )}

      {!signedIn && <p className="note note-info"><a href="/signin?next=/jobs">Sign in</a> to apply and to see your applications. Companies: <a href="/employers">hire students here</a>.</p>}

      <h2>Jobs to apply for</h2>
      <OpeningsList kinds={PART_TIME_KINDS} />
      <p className="hint" style={{ marginTop: 24 }}>Do you hire students? <a href="/employers">Make a company account</a>. Read the <a href="/employers/rules">teen job rules</a> every company agrees to.</p>
    </>
  );
}
