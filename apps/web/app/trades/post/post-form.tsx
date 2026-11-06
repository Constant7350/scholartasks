"use client";

import { useMemo, useState, type FormEvent } from "react";
import { OPENING_KINDS, OPENING_LAW_LINKS, OPENING_MAX_DAYS, OPENING_MIN_AGES, OPENING_RULES, OPENING_STATES } from "@scholartasks/core";
import { STATE_NAMES, TRADES } from "../../../lib/trades";

const SUPPORT_EMAIL = "support@scholartasks.com";
const day = (d: Date) => d.toISOString().slice(0, 10);

/** The company's listing form. Sends to /api/openings, which saves it for our team to review. */
export function PostForm() {
  const [kind, setKind] = useState<string>("apprenticeship");
  const [registered, setRegistered] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const trades = useMemo(() => [...TRADES].sort((a, b) => a.name.localeCompare(b.name)), []);
  const now = new Date();
  const minDay = day(new Date(now.getTime() + 86_400_000));
  const maxDay = day(new Date(now.getTime() + OPENING_MAX_DAYS * 86_400_000));
  const defDay = day(new Date(now.getTime() + 90 * 86_400_000));
  const isApprenticeship = kind === "apprenticeship" || kind === "pre_apprenticeship";

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setState("sending");
    const data: Record<string, unknown> = Object.fromEntries(new FormData(e.currentTarget));
    data.registered_apprenticeship = registered;
    const res = await fetch("/api/openings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res?.ok && body?.ok) { window.scrollTo({ top: 0 }); return setState("sent"); }
    setState("idle");
    setError(body?.error || `Sorry, that didn't go through. Please try again, or email ${SUPPORT_EMAIL}.`);
  };

  if (state === "sent") {
    return (
      <section className="panel" role="status">
        <h2>✓ Thanks, we got your listing</h2>
        <p>Our review team checks it, usually within two business days, and emails you when it&apos;s live. We sent you a copy too.</p>
        <p>Have another opening? <a href="/trades/post" onClick={() => setState("idle")}>Post another</a>.</p>
      </section>
    );
  }

  return (
    <form className="panel opening-form" onSubmit={submit}>
      <h2>Your company</h2>
      <div className="row">
        <div className="field"><label htmlFor="o-company">Company name</label><input className="input" id="o-company" name="company_name" required maxLength={120} autoComplete="organization" /></div>
        <div className="field"><label htmlFor="o-site">Website (optional)</label><input className="input" id="o-site" name="company_website" maxLength={300} placeholder="www.yourcompany.com" /></div>
      </div>
      <div className="row">
        <div className="field"><label htmlFor="o-cname">Your name</label><input className="input" id="o-cname" name="contact_name" required maxLength={100} autoComplete="name" /></div>
        <div className="field"><label htmlFor="o-cemail">Your email</label><input className="input" id="o-cemail" name="contact_email" type="email" required maxLength={200} autoComplete="email" /></div>
        <div className="field"><label htmlFor="o-cphone">Phone (optional)</label><input className="input" id="o-cphone" name="contact_phone" type="tel" maxLength={30} autoComplete="tel" /></div>
      </div>
      <p className="hint small">Only our team sees your name, email and phone. Students see the way to apply you give below.</p>

      <h2>The opening</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="o-kind">What kind?</label>
          <select className="input" id="o-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(OPENING_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="o-trade">Trade</label>
          <select className="input" id="o-trade" name="trade_slug" defaultValue="">
            <option value="">Other or more than one</option>
            {trades.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label htmlFor="o-title">Title</label><input className="input" id="o-title" name="title" required minLength={4} maxLength={120} placeholder="Electrical apprentice" /></div>
      <div className="row">
        <div className="field"><label htmlFor="o-city">City</label><input className="input" id="o-city" name="city" required maxLength={80} autoComplete="address-level2" /></div>
        <div className="field">
          <label htmlFor="o-state">State</label>
          <select className="input" id="o-state" name="state" defaultValue="GA">
            {OPENING_STATES.map((s) => <option key={s} value={s}>{STATE_NAMES[s] ?? s}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="o-zip">ZIP (optional)</label><input className="input" id="o-zip" name="zip" inputMode="numeric" pattern="\d{5}" maxLength={5} autoComplete="postal-code" /></div>
      </div>
      <div className="row">
        <div className="field">
          <label htmlFor="o-age">Youngest age you can take</label>
          <select className="input" id="o-age" name="min_age" defaultValue="18">
            {OPENING_MIN_AGES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="o-pay">Pay (optional)</label><input className="input" id="o-pay" name="pay" maxLength={120} placeholder="$16 an hour, raises as you learn" /></div>
        <div className="field"><label htmlFor="o-sched">Schedule (optional)</label><input className="input" id="o-sched" name="schedule" maxLength={160} placeholder="Full time, Mon to Fri" /></div>
      </div>
      <div className="field">
        <label htmlFor="o-desc">What the work is and what they&apos;ll learn</label>
        <textarea className="input" id="o-desc" name="description" required minLength={30} maxLength={4000} rows={5} />
      </div>
      <div className="field">
        <label htmlFor="o-req">What they need (optional)</label>
        <textarea className="input" id="o-req" name="requirements" maxLength={2000} rows={3} placeholder="High school diploma or working toward one, driver's license, steel-toe boots…" />
      </div>
      {isApprenticeship && (
        <div className="field">
          <label className="check"><input type="checkbox" checked={registered} onChange={(e) => setRegistered(e.target.checked)} /> This is a Registered Apprenticeship (registered with the U.S. or state Department of Labor)</label>
          {registered && <input className="input" name="rapids_number" maxLength={40} placeholder="Program or RAPIDS number, if you have it" aria-label="Program or RAPIDS number" />}
          <span className="hint small">Our team looks it up on apprenticeship.gov and adds a Registered badge when it matches.</span>
        </div>
      )}

      <h2>How students apply</h2>
      <div className="field">
        <label htmlFor="o-how">Tell students how to apply</label>
        <textarea className="input" id="o-how" name="how_to_apply" maxLength={1000} rows={2} placeholder="Apply online, email jobs@yourcompany.com, or call 478-555-0100 and ask for Dana." />
      </div>
      <div className="row">
        <div className="field"><label htmlFor="o-url">Link to apply (optional)</label><input className="input" id="o-url" name="apply_url" maxLength={300} placeholder="www.yourcompany.com/jobs" /></div>
        <div className="field"><label htmlFor="o-until">Show until</label><input className="input" id="o-until" name="show_until" type="date" min={minDay} max={maxDay} defaultValue={defDay} /></div>
      </div>

      <h2>Listing rules</h2>
      <ul className="opening-rules">{OPENING_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="hint small">
        Helpful official pages: {OPENING_LAW_LINKS.map((l, i) => <span key={l.url}>{i ? " · " : ""}<a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></span>)}
      </p>
      <label className="check"><input type="checkbox" name="agree" required /> I agree to these rules for this listing.</label>

      {/* Hidden from people; bots fill it in and get dropped. */}
      <div className="s-trap" aria-hidden="true" style={{ position: "absolute", left: -9999 }}>
        <label htmlFor="o-website">Website</label>
        <input id="o-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button className="btn" type="submit" disabled={state === "sending"} style={{ marginTop: 16 }}>{state === "sending" ? "Sending…" : "Send for review"}</button>
      {error && <p className="note note-err" role="alert">{error}</p>}
      <p className="hint small">Posting is free. We use your details only to review and manage your listing. See our <a href="/privacy">privacy policy</a>.</p>
    </form>
  );
}
