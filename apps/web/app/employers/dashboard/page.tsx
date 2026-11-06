"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { checkOpening, JOB_MAX_QUESTIONS, OPENING_KINDS, OPENING_MAX_DAYS, OPENING_MIN_AGES, OPENING_STATES, PART_TIME_KINDS, PART_TIME_POST_FEE, TEEN_JOB_RULES, type OpeningKind } from "@scholartasks/core";
import { friendly, supabase } from "../../../lib/supabase";
import { STATE_NAMES } from "../../../lib/trades";
import { kindLabel, place, TRADE_SLUGS } from "../../../lib/openings";
import { jobError, notifyJobs, statusLabel, type CompanyApplication, type Employer } from "../../../lib/jobs";
import { NotConfigured, Page } from "../../ui";
import "../../trades/trades.css";

interface MyListing { id: string; kind: OpeningKind; title: string; city: string; state: string; status: string; show_until: string; views: number; apply_clicks: number; review_note: string | null }
const day = (d: Date) => d.toISOString().slice(0, 10);

/** A company's own place: its account, its job posts and the applications parents agreed to send. */
export default function EmployerDashboard() {
  const sb = supabase();
  const [me, setMe] = useState<Employer | null | undefined>(undefined);
  const [listings, setListings] = useState<MyListing[]>([]);
  const [apps, setApps] = useState<CompanyApplication[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/employers/dashboard");
    const e = await sb.from("employers").select("*").eq("user_id", s.session.user.id).maybeSingle();
    if (e.error) { setError(/exist|schema cache/i.test(e.error.message) ? "This part isn't switched on yet. Please try again soon." : friendly(e.error)); return setMe(null); }
    setMe((e.data as Employer) ?? null);
    if (!e.data) return;
    const [l, a] = await Promise.all([
      sb.from("local_openings").select("id, kind, title, city, state, status, show_until, views, apply_clicks, review_note").eq("employer_id", (e.data as Employer).id).order("created_at", { ascending: false }),
      sb.rpc("employer_applications"),
    ]);
    setListings((l.data as MyListing[]) ?? []);
    setApps((a.data as CompanyApplication[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Company account"><NotConfigured /></Page>;
  if (me === undefined) return <Page title="Company account"><p className="hint">Loading…</p></Page>;

  return (
    <Page title={me ? me.company_name : "Make your company account"}>
      <p className="hint"><a href="/employers">← How it works</a> · <a href="/employers/rules">Teen job rules</a></p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {msg && <p className="note note-ok" role="status">{msg}</p>}
      {!me ? <SignUp onDone={() => { setMsg("Thanks! Our review team checks your company, usually within two business days. You can post your first job now."); void load(); }} />
        : (
          <>
            {me.status === "pending" && <p className="note note-info">Our review team is checking your company. You can post jobs now; they show to students once approved.</p>}
            {me.status === "blocked" && <p className="note note-err">This company account is closed. Questions? Email support@scholartasks.com.</p>}
            <Applications apps={apps} onChange={load} />
            <section className="panel">
              <h2>Your job posts ({listings.length})</h2>
              {listings.length === 0 ? <p className="hint">No posts yet.</p> : (
                <ul className="opening-list">{listings.map((o) => {
                  const live = o.status === "approved" && o.show_until >= day(new Date());
                  return (
                    <li key={o.id} className="opening-card">
                      <h3>{o.title}</h3>
                      <p className="trade-tags"><span className="pill">{kindLabel(o.kind)}</span><span className="pill">{place(o)}</span>
                        <span className={`pill${live ? " pill-ok" : ""}`}>{live ? "Live" : o.status === "pending" ? "Waiting for review" : o.status === "approved" ? "Ended" : o.status === "rejected" ? "Not approved" : "Taken down"}</span></p>
                      <p className="hint small">{o.views} looked at the details · {o.apply_clicks} pressed Apply · shows until {o.show_until}</p>
                      {o.review_note && <p className="hint small">Note from our review team: {o.review_note}</p>}
                      {live && <button className="btn btn-inline btn-sm btn-ghost" onClick={async () => {
                        const { error: e } = await sb.rpc("employer_close_opening", { p_id: o.id });
                        if (e) setError(jobError(e.message)); else { setMsg("Closed. Students no longer see it."); void load(); }
                      }}>Close this job</button>}
                    </li>
                  );
                })}</ul>
              )}
            </section>
            {me.status !== "blocked" && <PostJob me={me} onDone={() => { setMsg("Sent to our review team. We'll email you when it's live."); void load(); }} />}
          </>
        )}
    </Page>
  );
}

function SignUp({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true); setError("");
    const { error: err } = await sb.rpc("employer_sign_up", { p: { ...f, agree: f.agree === "on" } });
    setBusy(false);
    if (err) return setError(/Student accounts/.test(err.message) ? "This is a student account. Please sign out and make the company account with your work email." : jobError(err.message));
    onDone();
  };
  return (
    <form className="panel opening-form" onSubmit={submit}>
      <p>Tell us about your company. Only our team sees your name, email and phone.</p>
      <div className="row">
        <div className="field"><label htmlFor="e-co">Company name</label><input className="input" id="e-co" name="company_name" required maxLength={120} autoComplete="organization" /></div>
        <div className="field"><label htmlFor="e-site">Website (optional)</label><input className="input" id="e-site" name="website" type="url" maxLength={300} placeholder="https://www.yourcompany.com" /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="e-name">Your name</label><input className="input" id="e-name" name="contact_name" required maxLength={100} autoComplete="name" /></div>
        <div className="field"><label htmlFor="e-email">Work email (optional, else your sign-in email)</label><input className="input" id="e-email" name="contact_email" type="email" maxLength={200} /></div>
        <div className="field"><label htmlFor="e-phone">Phone (optional)</label><input className="input" id="e-phone" name="phone" type="tel" maxLength={30} /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="e-city">City</label><input className="input" id="e-city" name="city" required maxLength={80} /></div>
        <div className="field"><label htmlFor="e-state">State</label>
          <select className="input" id="e-state" name="state" defaultValue="GA">{OPENING_STATES.map((s) => <option key={s} value={s}>{STATE_NAMES[s] ?? s}</option>)}</select>
        </div>
      </div>
      <h3>The teen job rules</h3>
      <ol className="opening-rules">{TEEN_JOB_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
      <label className="check"><input type="checkbox" name="agree" required /> I agree to these rules for my company. (<a href="/employers/rules" target="_blank">Full rules and official pages</a>)</label>
      <button className="btn" type="submit" disabled={busy} style={{ marginTop: 12 }}>{busy ? "Saving…" : "Make my company account"}</button>
      {error && <p className="note note-err" role="alert">{error}</p>}
    </form>
  );
}

function PostJob({ me, onDone }: { me: Employer; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = new Date();
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    // Same checks as every listing; the company details come from the account.
    const r = checkOpening({ ...f, company_name: me.company_name, company_website: me.website, contact_name: me.contact_name, contact_email: me.contact_email,
      how_to_apply: f.how_to_apply || "Apply in ScholarTasks.", agree: "on" }, { tradeSlugs: TRADE_SLUGS });
    if (!r.ok) return setError(r.error);
    setBusy(true); setError("");
    const extra = Array.from({ length: JOB_MAX_QUESTIONS }, (_, i) => (f[`q${i}`] ?? "").trim()).filter((q) => q.length >= 3);
    const { data, error: err } = await sb.rpc("employer_post_opening", { p: { ...r.opening, apply_in_app: true, extra_questions: extra } });
    setBusy(false);
    if (err) return setError(/too many/.test(err.message) ? "That's a lot of posts for one day. Please try again tomorrow." : jobError(err.message));
    if (typeof data === "string") void notifyJobs(data, "posted");
    (e.target as HTMLFormElement).reset();
    onDone();
  };
  return (
    <form className="panel opening-form" onSubmit={submit}>
      <h2>Post a weekend or holiday job</h2>
      <p className="hint">{PART_TIME_POST_FEE.freeWhileLaunching ? "Free while we launch." : `A flat $${PART_TIME_POST_FEE.amountUsd} per post.`} Our review team checks each job before students see it. Students apply in ScholarTasks with a parent&apos;s consent.</p>
      <div className="row">
        <div className="field"><label htmlFor="j-kind">What kind?</label>
          <select className="input" id="j-kind" name="kind" defaultValue="weekend">
            {PART_TIME_KINDS.map((k) => <option key={k} value={k}>{OPENING_KINDS[k as OpeningKind]}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="j-age">Youngest age you can take</label>
          <select className="input" id="j-age" name="min_age" defaultValue="16">{OPENING_MIN_AGES.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </div>
      </div>
      <div className="field"><label htmlFor="j-title">Title</label><input className="input" id="j-title" name="title" required minLength={4} maxLength={120} placeholder="Saturday garden center helper" /></div>
      <div className="row">
        <div className="field"><label htmlFor="j-city">City</label><input className="input" id="j-city" name="city" required maxLength={80} defaultValue={me.city} /></div>
        <div className="field"><label htmlFor="j-state">State</label>
          <select className="input" id="j-state" name="state" defaultValue={me.state}>{OPENING_STATES.map((s) => <option key={s} value={s}>{STATE_NAMES[s] ?? s}</option>)}</select>
        </div>
        <div className="field"><label htmlFor="j-zip">ZIP (optional)</label><input className="input" id="j-zip" name="zip" inputMode="numeric" pattern="\d{5}" maxLength={5} /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="j-pay">Pay</label><input className="input" id="j-pay" name="pay" required maxLength={120} placeholder="$11 an hour" /></div>
        <div className="field"><label htmlFor="j-sched">Days and hours</label><input className="input" id="j-sched" name="schedule" required maxLength={160} placeholder="Saturdays 8 a.m. to 1 p.m." /></div>
      </div>
      <div className="field"><label htmlFor="j-desc">What the work is</label><textarea className="input" id="j-desc" name="description" required minLength={30} maxLength={4000} rows={4} /></div>
      <div className="field"><label htmlFor="j-req">What they need (optional)</label><textarea className="input" id="j-req" name="requirements" maxLength={2000} rows={2} placeholder="Closed-toe shoes, a work permit if under 16…" /></div>
      <div className="field"><label htmlFor="j-until">Show until</label>
        <input className="input" id="j-until" name="show_until" type="date" min={day(new Date(now.getTime() + 86_400_000))} max={day(new Date(now.getTime() + OPENING_MAX_DAYS * 86_400_000))} defaultValue={day(new Date(now.getTime() + PART_TIME_POST_FEE.days * 86_400_000))} />
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0 }}>
        <legend>Your own questions (optional, up to {JOB_MAX_QUESTIONS})</legend>
        <span className="hint small">Students answer these on the ScholarTasks form. Don&apos;t ask for Social Security numbers, bank details, home addresses, age beyond the minimum, or anything about race, religion, health or family.</span>
        {Array.from({ length: JOB_MAX_QUESTIONS }, (_, i) => (
          <input key={i} className="input" name={`q${i}`} maxLength={200} aria-label={`Question ${i + 1}`} placeholder={i === 0 ? "Can you work the Saturday after Thanksgiving?" : i === 1 ? "Have you worked with customers before?" : "How will you get to work?"} />
        ))}
      </fieldset>
      <p className="hint small">Ages 14 and 15 can work only outside school hours, up to 3 hours on a school day and 18 in a school week, between 7 a.m. and 7 p.m. (9 p.m. in summer).</p>
      <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Send for review"}</button>
      {error && <p className="note note-err" role="alert">{error}</p>}
    </form>
  );
}

function Applications({ apps, onChange }: { apps: CompanyApplication[]; onChange: () => void }) {
  const [error, setError] = useState("");
  const move = async (a: CompanyApplication, status: "seen" | "interview" | "not_selected" | "hired") => {
    const sb = supabase();
    if (!sb) return;
    const note = status === "interview" || status === "hired" ? window.prompt("A short note for the family (optional), for example a day and time to meet:") ?? "" : "";
    const { error: e } = await sb.rpc("employer_update_application", { p_id: a.id, p_status: status, p_note: note });
    if (e) return setError(jobError(e.message));
    if (status !== "seen") void notifyJobs(a.id, "status");
    onChange();
  };
  return (
    <section className="panel">
      <h2>Applications ({apps.length})</h2>
      {apps.length === 0 ? <p className="hint">No applications yet. They arrive here after a parent agrees.</p> : (
        <ul className="opening-list">{apps.map((a) => (
          <li key={a.id} className="opening-card">
            <h3>{a.first_name}, {a.age}, grade {a.grade_level}</h3>
            <p className="hint">For {a.opening_title} · {statusLabel(a.status)}</p>
            <p className="pre">{a.message}</p>
            {a.availability && <p><b>Can work:</b> {a.availability}</p>}
            {(a.questions ?? []).map((q, i) => <p key={q}><b>{q}</b><br />{a.answers?.[i]}</p>)}
            <p><b>Contact:</b> {[a.share_email, a.share_phone].filter(Boolean).join(" · ")}{a.parent_email ? <> · <b>Parent:</b> {a.parent_email}</> : null}</p>
            <p className="hint small">Please copy the parent on every reply.</p>
            {a.employer_note && <p className="hint small">Your note: {a.employer_note}</p>}
            {a.status === "hired" && <ReferenceForm a={a} />}
            <p className="opening-actions">
              {a.status === "sent" && <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void move(a, "seen")}>Mark as seen</button>}
              <button className="btn btn-inline btn-sm" onClick={() => void move(a, "interview")}>Let&apos;s meet</button>
              <button className="btn btn-inline btn-sm" onClick={() => void move(a, "hired")}>Hired</button>
              <button className="btn btn-inline btn-sm btn-ghost" onClick={() => void move(a, "not_selected")}>Not this time</button>
            </p>
          </li>
        ))}</ul>
      )}
      {error && <p className="note note-err">{error}</p>}
    </section>
  );
}

/** After hiring: a reference letter about work ethic and character, saved to that student's records (the family sees it first). */
function ReferenceForm({ a }: { a: CompanyApplication }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  if (state === "saved") return <p className="note note-ok">✓ Thank you. {a.first_name}&apos;s family can now see your letter.</p>;
  if (!open) return <p><button className="btn btn-inline btn-sm btn-ghost" onClick={() => setOpen(true)}>Write a reference letter</button></p>;
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb) return;
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setState("saving"); setError("");
    const { error: err } = await sb.rpc("employer_write_reference", {
      p_application: a.id, p_writer: f.writer, p_role: f.role, p_from: f.from || null, p_to: f.to || null, p_letter: f.letter,
    });
    if (err) { setState("idle"); return setError(jobError(err.message)); }
    setState("saved");
  };
  return (
    <form className="opening-form" onSubmit={submit} style={{ marginTop: 8 }}>
      <p className="hint small">Describe {a.first_name}&apos;s work ethic and character: showing up on time, effort, honesty, how they treat customers and coworkers. It goes into their ScholarTasks records for college, scholarship and job applications.</p>
      <div className="row">
        <div className="field"><label htmlFor={`r-w-${a.id}`}>Your name</label><input className="input" id={`r-w-${a.id}`} name="writer" required minLength={2} maxLength={100} /></div>
        <div className="field"><label htmlFor={`r-r-${a.id}`}>Your role (optional)</label><input className="input" id={`r-r-${a.id}`} name="role" maxLength={100} placeholder="Store manager" /></div>
        <div className="field"><label htmlFor={`r-f-${a.id}`}>Worked from</label><input className="input" id={`r-f-${a.id}`} name="from" type="date" /></div>
        <div className="field"><label htmlFor={`r-t-${a.id}`}>to</label><input className="input" id={`r-t-${a.id}`} name="to" type="date" /></div>
      </div>
      <div className="field"><label htmlFor={`r-l-${a.id}`}>Letter</label><textarea className="input" id={`r-l-${a.id}`} name="letter" required minLength={50} maxLength={5000} rows={6} /></div>
      <p className="opening-actions">
        <button className="btn btn-inline btn-sm" type="submit" disabled={state === "saving"}>{state === "saving" ? "Saving…" : "Save the letter"}</button>
        <button className="btn btn-inline btn-sm btn-ghost" type="button" onClick={() => setOpen(false)}>Cancel</button>
      </p>
      {error && <p className="note note-err">{error}</p>}
    </form>
  );
}
