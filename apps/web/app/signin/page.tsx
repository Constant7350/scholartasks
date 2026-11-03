"use client";

import { useEffect, useState, type FormEvent } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { Brand } from "../brand";
import { NotConfigured, Page } from "../ui";

type Role = "parent" | "student";

const PERKS = [
  "Every scholarship, state aid and college deadline in one plan",
  "Reminders before anything is due, so nothing slips",
  "Georgia HOPE and Zell Miller tracking from 8th grade on",
  "You decide what your student can see and do",
];

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("parent");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("next")?.startsWith("/join")) setRole("student");
  }, []);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const sb = supabase();
  if (!sb) return <Page title="Sign in"><NotConfigured /></Page>;

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setState("sending");
    setError(null);
    const requested = new URLSearchParams(window.location.search).get("next");
    const next = requested?.startsWith("/") && !requested.startsWith("//") ? requested : role === "student" ? "/join" : "/family";
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin + next } });
    if (error) {
      setError(friendly(error));
      setState("idle");
    } else {
      setState("sent");
    }
  };

  return (
    <div className="auth">
      <section className="auth-story">
        <Brand />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1>
            College, scholarships and aid, <em>handled.</em>
          </h1>
          <p className="lede">One plan for your family: grades, test prep, applications and every deadline, with an AI counselor that keeps it moving.</p>
          <ul className="perks">
            {PERKS.map((p) => (
              <li key={p}>
                <span className="tick">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="auth-foot">Built in Georgia for families across the Southeast.</p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><Brand /></div>

          {state === "sent" ? (
            <div className="sent" aria-live="polite">
              <div className="icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </div>
              <h2>Check your email</h2>
              <p>
                We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on this device to continue. It can take a minute, so check spam too.
              </p>
              <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setState("idle")}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={send} noValidate>
              <h2>Welcome</h2>
              <p className="sub">Sign in or create your account. No password needed.</p>

              <div className="roles" role="group" aria-label="I am a">
                <button type="button" className="role" aria-pressed={role === "parent"} onClick={() => setRole("parent")}>
                  <b>I'm a parent</b>
                  <span>Set up your family</span>
                </button>
                <button type="button" className="role" aria-pressed={role === "student"} onClick={() => setRole("student")}>
                  <b>I'm a student</b>
                  <span>Join with a code</span>
                </button>
              </div>

              <div className="field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  className="input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button className="btn" type="submit" disabled={!valid || state === "sending"}>
                {state === "sending" ? "Sending your link…" : "Email me a sign-in link"}
              </button>

              {error && <p className="note note-err" role="alert">{error}</p>}

              <div className="trust">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>Your family's information is private, encrypted and only visible to people you allow. We never sell student data.</span>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
