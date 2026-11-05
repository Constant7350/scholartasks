"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

// The federal college data (supabase/seed/*.json, copied to /data at build).
interface CollegeJson { id: number; name: string; city: string | null; state: string; url: string | null; calc: string | null; own: number; deg: number | null; size: number | null; adm: number | null; sat: number | null; act: number | null; tin: number | null; tout: number | null; coa: number | null; avgnet: number | null; net: (number | null)[]; grad: number | null; earn: number | null; debt: number | null; prog: Record<string, number> }
interface ProgramsJson { fetched: string; titles: Record<string, string>; summary: [string, number, number, number, number | null, number | null, number | null][]; rows: [number, string, number, number, number | null, number | null, number | null, number][] }

const fixUrl = (v: string | null) => (!v ? null : /^https?:\/\//i.test(v) ? v : `https://${v}`);
const BATCH = 500;

/**
 * Team only: loads the latest College Scorecard data (every college, and every
 * major at each one) into the database with one tap. Safe to run again; it
 * updates what's there. Run database update 33 first.
 */
export default function CollegeDataPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [counts, setCounts] = useState<{ colleges: number | null; programs: number | null } | null>(null);
  const [step, setStep] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const count = useCallback(async () => {
    if (!sb) return;
    const [c, p] = await Promise.all([
      sb.from("colleges").select("id", { count: "exact", head: true }),
      sb.from("college_programs").select("college_id", { count: "exact", head: true }),
    ]);
    setCounts({ colleges: c.error ? null : c.count ?? 0, programs: p.error ? null : p.count ?? 0 });
  }, [sb]);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/college-data");
    const a = await sb.rpc("is_app_admin");
    setAdmin(a.data === true);
    if (a.data === true) await count();
  }, [sb, count]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Load college data"><NotConfigured /></Page>;
  if (admin === undefined) return <Page title="Load college data"><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title="Load college data"><p className="hint">This page is for the ScholarTasks team.</p></Page>;

  const upsert = async (table: string, rows: Record<string, unknown>[], onConflict: string, label: string) => {
    setStep(label); setDone(0); setTotal(rows.length);
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: e } = await sb.from(table).upsert(rows.slice(i, i + BATCH), { onConflict });
      if (e) throw e;
      setDone(Math.min(i + BATCH, rows.length));
    }
  };

  const run = async () => {
    setError(null); setMsg(null);
    try {
      setStep("Downloading the data…"); setDone(0); setTotal(0);
      const [cj, pj] = await Promise.all([
        fetch("/data/colleges.json").then((r) => r.json()) as Promise<{ fetched: string; rows: CollegeJson[] }>,
        fetch("/data/college_programs.json").then((r) => r.json()) as Promise<ProgramsJson>,
      ]);
      await upsert("colleges", cj.rows.map((r) => ({
        id: r.id, name: r.name, city: r.city, state: r.state, url: fixUrl(r.url), price_calc_url: fixUrl(r.calc), ownership: r.own, degree: r.deg,
        size: r.size, admit_rate: r.adm, sat_avg: r.sat, act_mid: r.act, tuition_in: r.tin, tuition_out: r.tout, cost_attendance: r.coa,
        avg_net_price: r.avgnet, net_price: r.net, grad_rate: r.grad, earnings: r.earn, median_debt: r.debt, programs: r.prog, data_year: cj.fetched,
        updated_at: new Date().toISOString(),
      })), "id", "Colleges");
      await upsert("study_fields", Object.entries(pj.titles).map(([cip, title]) => ({ cip, title })), "cip", "Major names");
      await upsert("field_earnings", pj.summary.map((s) => ({ cip: s[0], level: s[1], programs: s[2], grads: s[3], earn_1yr: s[4], earn_4yr: s[5], debt: s[6] })), "cip,level", "Pay by degree level");
      await upsert("college_programs", pj.rows.map((r) => ({ college_id: r[0], cip: r[1], level: r[2], grads: r[3], earn_1yr: r[4], earn_4yr: r[5], debt: r[6], online: !!r[7] })), "college_id,cip,level", "Majors at each college");
      setStep(null);
      setMsg(`✓ Loaded ${cj.rows.length.toLocaleString()} colleges and ${pj.rows.length.toLocaleString()} majors (data from ${pj.fetched}).`);
      await count();
    } catch (e) {
      setStep(null);
      const m = friendly(e);
      setError(/college_programs|study_fields|field_earnings/.test(m) && /exist|schema cache/i.test(m)
        ? "Run database update 33 in Supabase first, then tap Load again."
        : `Stopped: ${m}. Tap Load again; it picks up safely.`);
    }
  };

  return (
    <Page title="Load college data">
      <p className="hint">Puts the latest federal College Scorecard data into the app: every college in the U.S. (four-year, two-year, technical and trade schools) and every major at each one. Safe to run again. Keep this page open until it finishes (a few minutes).</p>
      <section className="panel">
        <h2>In the database now</h2>
        <p style={{ margin: 0 }}>
          Colleges: <b>{counts?.colleges?.toLocaleString() ?? "—"}</b> · Majors: <b>{counts?.programs == null ? "not set up yet (run database update 33)" : counts.programs.toLocaleString()}</b>
        </p>
        <button className="btn btn-inline" style={{ marginTop: 14 }} disabled={!!step} onClick={() => void run()}>{step ? "Loading…" : "Load college data"}</button>
        {step && (
          <div style={{ marginTop: 12 }}>
            <p className="hint" style={{ margin: "0 0 6px" }}>{step}{total ? `: ${done.toLocaleString()} of ${total.toLocaleString()}` : ""}</p>
            <div className="bar-track" style={{ display: "block" }}><span className="bar-fill" style={{ width: `${total ? Math.round((done / total) * 100) : 5}%` }} /></div>
          </div>
        )}
        {msg && <p className="note note-ok">{msg}</p>}
        {error && <p className="note note-err" role="alert">{error}</p>}
      </section>
    </Page>
  );
}
