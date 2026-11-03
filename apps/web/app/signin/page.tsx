"use client";

import { useEffect, useState, type FormEvent } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { Brand } from "../brand";
import { NotConfigured, Page } from "../ui";

type Role = "parent" | "student";
type Mode = "link" | "password";
type PwAction = "signin" | "signup";

const PERKS = [
  "Every scholarship, state aid and college deadline in one plan",
  "Reminders before anything is due, so nothing slips",
  "Georgia HOPE and Zell Miller tracking from 8th grade on",
  "You decide what your student can see and do",
];

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("parent");
  const [mode, setMode] = useState<Mode>("link");
  const [pwAction, setPwAction] = useState<PwAction>("signin");
  const [google, setGoogle] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "confirm" | "reset-sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const sb = supabase();

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("next")?.startsWith("/join")) setRole("student");
    // Only show "Continue with Google" once Google is switched on in Supabase.
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key)
      fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
        .then((r) => r.json())
        .then((j) => setGoogle(!!j?.external?.google))
        .catch(() => {});
  }, []);

  if (!sb) return <Page title="Sign in"><NotConfigured /></Page>;

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nextPath = () => {
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested?.startsWith("/") && !requested.startsWith("//") ? requested : role === "student" ? "/join" : "/home";
  };
  const fail = (e: unknown) => {
    setError(friendly(e));
    setState("idle");
  };

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setState("sending");
    setError(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: window.location.origin + nextPath() } });
    if (error) fail(error);
    else setState("sent");
  };

  const usePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || password.length < 8) return;
    setState("sending");
    setError(null);
    if (pwAction === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return fail(error);
      window.location.href = nextPath();
    } else {
      const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin + nextPath() } });
      if (error) return fail(error);
      if (data.session) window.location.href = nextPath();
      else setState("confirm");
    }
  };

  const forgot = async () => {
    if (!valid) return setError("Type your email address first, then tap Forgot password.");
    setState("sending");
    setError(null);
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + "/reset" });
    if (error) fail(error);
    else setState("reset-sent");
  };

  const withGoogle = async () => {
    setError(null);
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + nextPath() } });
    if (error) fail(error);
  };

  const sentText =
    state === "sent"
      ? <>We sent a sign-in link to <strong>{email.trim()}</strong>. Open it on this device to continue.</>
      : state === "confirm"
        ? <>We sent a confirmation link to <strong>{email.trim()}</strong>. Tap it once to finish creating your account.</>
        : <>We sent a link to <strong>{email.trim()}</strong> so you can choose a new password.</>;

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

          {state === "sent" || state === "confirm" || state === "reset-sent" ? (
            <div className="sent" aria-live="polite">
              <div className="icon">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </div>
              <h2>Check your email</h2>
              <p>{sentText} It can take a minute, so check spam too.</p>
              <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setState("idle")}>
                Back
              </button>
            </div>
          ) : (
            <div>
              <h2>Welcome</h2>
              <p className="sub">Sign in or create your account.</p>

              <div className="roles" role="group" aria-label="I am a">
                <button type="button" className="role" aria-pressed={role === "parent"} onClick={() => setRole("parent")}>
                  <b>I'm a parent</b>
                  <span>Plan for your family</span>
                </button>
                <button type="button" className="role" aria-pressed={role === "student"} onClick={() => setRole("student")}>
                  <b>I'm a student</b>
                  <span>Join with a code</span>
                </button>
              </div>

              {google && (
                <>
                  <button type="button" className="btn btn-ghost btn-google" onClick={withGoogle}>
                    <GoogleIcon /> Continue with Google
                  </button>
                  <div className="or"><span>or use your email</span></div>
                </>
              )}

              <div className="tabs" role="tablist">
                <button type="button" role="tab" aria-selected={mode === "link"} onClick={() => { setMode("link"); setError(null); }}>Email me a link</button>
                <button type="button" role="tab" aria-selected={mode === "password"} onClick={() => { setMode("password"); setError(null); }}>Use a password</button>
              </div>

              <form onSubmit={mode === "link" ? sendLink : usePassword} noValidate>
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

                {mode === "password" && (
                  <div className="field">
                    <div className="label-row">
                      <label htmlFor="password">{pwAction === "signup" ? "Choose a password" : "Password"}</label>
                      {pwAction === "signin" && <button type="button" className="text-btn" onClick={forgot}>Forgot password?</button>}
                    </div>
                    <input
                      id="password"
                      className="input"
                      type="password"
                      autoComplete={pwAction === "signup" ? "new-password" : "current-password"}
                      placeholder={pwAction === "signup" ? "At least 8 characters" : ""}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}

                <button className="btn" type="submit" disabled={!valid || state === "sending" || (mode === "password" && password.length < 8)}>
                  {state === "sending"
                    ? "One moment…"
                    : mode === "link"
                      ? "Email me a sign-in link"
                      : pwAction === "signin"
                        ? "Sign in"
                        : "Create my account"}
                </button>

                {mode === "link" ? (
                  <p className="switch">No password needed. We email you a link that signs you in.</p>
                ) : (
                  <p className="switch">
                    {pwAction === "signin" ? "New to ScholarTasks? " : "Already have an account? "}
                    <button type="button" className="text-btn" onClick={() => { setPwAction(pwAction === "signin" ? "signup" : "signin"); setError(null); }}>
                      {pwAction === "signin" ? "Create an account" : "Sign in"}
                    </button>
                  </p>
                )}

                {error && <p className="note note-err" role="alert">{error}</p>}
              </form>

              <div className="trust">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>Your family's information is private, encrypted and only visible to people you allow. We never sell student data.</span>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
