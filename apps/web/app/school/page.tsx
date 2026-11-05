"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { Dashboard, type School } from "./dashboard";

/**
 * The free school portal for counselors.
 * - Not on a school yet: sign the school up (our team approves it) or join with a staff code.
 * - Waiting for approval: says so.
 * - Approved: the caseload dashboard.
 */
export default function SchoolPortal() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [schools, setSchools] = useState<(School & { my_role: "admin" | "counselor" })[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    setSignedIn(!!s.session);
    if (!s.session) return;
    const uid = s.session.user.id;
    const [sc, st] = await Promise.all([
      sb.from("schools").select("id, name, city, state, status, join_code, staff_code, ai_plan").order("name"),
      sb.from("school_staff").select("school_id, role").eq("user_id", uid),
    ]);
    if (sc.error) {
      setError(/schools/.test(sc.error.message) && /exist|schema cache/i.test(sc.error.message)
        ? "The school portal needs database update 37. Run it in Supabase, then reload this page."
        : friendly(sc.error));
      return;
    }
    const roles = new Map(((st.data as { school_id: string; role: "admin" | "counselor" }[]) ?? []).map((r) => [r.school_id, r.role]));
    const mine = ((sc.data as School[]) ?? []).filter((x) => roles.has(x.id)).map((x) => ({ ...x, my_role: roles.get(x.id)! }));
    setSchools(mine);
    setCurrent((c) => (c && mine.some((m) => m.id === c) ? c : mine[0]?.id ?? null));
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="School counselor portal"><NotConfigured /></Page>;
  if (signedIn === null) return <Page title="School counselor portal"><p className="hint">Loading…</p></Page>;
  if (!signedIn)
    return (
      <Page title="School counselor portal">
        <Intro />
        <div className="panel">
          <h2>Sign in to start</h2>
          <p className="hint">Use your school email. If you don't have a ScholarTasks sign-in yet, the sign-in page makes one in a minute.</p>
          <a className="btn btn-inline" style={{ display: "inline-block", textDecoration: "none" }} href="/signin?next=/school">Sign in</a>
        </div>
      </Page>
    );

  const school = schools.find((s) => s.id === current);
  return (
    <Page title={school ? school.name : "School counselor portal"}>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {schools.length > 1 && (
        <div className="field" style={{ maxWidth: 360 }}>
          <label htmlFor="pick-school">School</label>
          <select id="pick-school" className="input" value={current ?? ""} onChange={(e) => setCurrent(e.target.value)}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      {!school && !error && (
        <>
          <Intro />
          <SignUp onDone={load} />
          <JoinStaff onDone={load} />
        </>
      )}
      {school && school.status === "pending" && (
        <div className="panel">
          <h2>Thanks! We're checking your school</h2>
          <p className="hint" style={{ marginBottom: 0 }}>
            The ScholarTasks team confirms every school before anyone there can see students. This usually takes a school day.
            We may email you at the address you signed in with. Questions: <a href="mailto:support@scholartasks.com">support@scholartasks.com</a>.
          </p>
        </div>
      )}
      {school && school.status === "closed" && (
        <p className="note note-err">This school account is closed. Email <a href="mailto:support@scholartasks.com">support@scholartasks.com</a> if that's a mistake.</p>
      )}
      {school && school.status === "approved" && <Dashboard school={school} role={school.my_role} onChanged={load} />}
      {school && (
        <details className="perm" style={{ marginTop: 24 }}>
          <summary>Add another school</summary>
          <SignUp onDone={load} />
          <JoinStaff onDone={load} />
        </details>
      )}
    </Page>
  );
}

function Intro() {
  return (
    <div className="panel">
      <p className="eyebrow">Free for every school</p>
      <h2>See which students need you, without the spreadsheets</h2>
      <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Families connect with your school's code and choose what to share.</li>
        <li>See who hasn't filed the FAFSA, who has no college list, and who has overdue deadlines.</li>
        <li>Send a reminder to a whole grade by email in one step.</li>
        <li>Post local scholarships that only your school's families see.</li>
      </ul>
      <p className="hint" style={{ margin: "12px 0 0" }}>
        The school portal is free. Families use ScholarTasks free, and can upgrade for the AI counselor and tutor.
        You only see what each family chooses to share, and every look is recorded.
      </p>
    </div>
  );
}

function SignUp({ onDone }: { onDone: () => void }) {
  const sb = supabase();
  const [f, setF] = useState({ name: "", city: "", state: "GA", website: "", phone: "", full_name: "", job_title: "School counselor" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim().length >= 3 && f.city.trim().length >= 2 && f.full_name.trim().length >= 2;
  return (
    <div className="panel">
      <h2>Set up your school</h2>
      <p className="hint">You'll be the school's admin and can add other counselors with a staff code.</p>
      <div className="row">
        <div className="field"><label htmlFor="s-name">School name</label><input id="s-name" className="input" value={f.name} onChange={set("name")} placeholder="e.g. Central High School" /></div>
        <div className="field"><label htmlFor="s-city">City</label><input id="s-city" className="input" value={f.city} onChange={set("city")} /></div>
        <div className="field" style={{ flex: "0 1 110px" }}><label htmlFor="s-state">State</label>
          <input id="s-state" className="input" maxLength={2} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="s-web">School website (helps us confirm it)</label><input id="s-web" className="input" value={f.website} onChange={set("website")} placeholder="https://" /></div>
        <div className="field"><label htmlFor="s-phone">School phone</label><input id="s-phone" className="input" value={f.phone} onChange={set("phone")} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="s-you">Your name</label><input id="s-you" className="input" value={f.full_name} onChange={set("full_name")} /></div>
        <div className="field"><label htmlFor="s-title">Your job title</label><input id="s-title" className="input" value={f.job_title} onChange={set("job_title")} /></div>
        <button
          className="btn btn-inline"
          disabled={!ok || busy}
          onClick={async () => {
            if (!sb) return;
            setBusy(true); setErr(null);
            const website = f.website.trim() && !/^https?:\/\//i.test(f.website.trim()) ? `https://${f.website.trim()}` : f.website.trim();
            const { error } = await sb.rpc("create_school", {
              p_name: f.name, p_city: f.city, p_state: f.state, p_website: website || null,
              p_phone: f.phone || null, p_full_name: f.full_name, p_job_title: f.job_title || null,
            });
            setBusy(false);
            if (error) setErr(friendly(error)); else onDone();
          }}
        >
          {busy ? "Sending…" : "Set up school"}
        </button>
      </div>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </div>
  );
}

function JoinStaff({ onDone }: { onDone: () => void }) {
  const sb = supabase();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("staff");
    if (c) setCode(c.toUpperCase());
  }, []);
  return (
    <div className="panel">
      <h2>Your school is already set up?</h2>
      <p className="hint">Ask the person who set it up for the staff code.</p>
      <div className="row">
        <div className="field"><label htmlFor="j-code">Staff code</label>
          <input id="j-code" className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} /></div>
        <div className="field"><label htmlFor="j-name">Your name</label><input id="j-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <button
          className="btn btn-inline"
          disabled={code.trim().length < 8 || name.trim().length < 2}
          onClick={async () => {
            if (!sb) return;
            setErr(null);
            const { error } = await sb.rpc("join_school_staff", { p_code: code, p_full_name: name, p_job_title: "School counselor" });
            if (error) setErr(friendly(error)); else onDone();
          }}
        >
          Join school
        </button>
      </div>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </div>
  );
}
