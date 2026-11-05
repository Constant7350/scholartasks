"use client";

import { useState, type FormEvent } from "react";
import { CONTACT_TOPICS } from "@scholartasks/core";

const SUPPORT_EMAIL = "support@scholartasks.com";

/** Public contact form. Sends to /api/contact, which emails the team. */
export function ContactForm({ school = false }: { school?: boolean }) {
  const [topic, setTopic] = useState<string>(school ? "School or counselor" : CONTACT_TOPICS[0]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setState("sending");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res?.ok && body?.ok) return setState("sent");
    setState("idle");
    setError(body?.error || `Sorry, that didn't go through. Please try again, or email ${SUPPORT_EMAIL}.`);
  };

  if (state === "sent") {
    return (
      <div className="s-form sent" role="status">
        <div className="icon" aria-hidden="true">✓</div>
        <h2 style={{ color: "var(--navy)", margin: "0 0 8px" }}>Thanks, we got your message</h2>
        <p>We'll write back to the email you gave us, usually within a day or two.</p>
        <p><a href="/">Back to the home page</a></p>
      </div>
    );
  }

  return (
    <form className="s-form" onSubmit={submit}>
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="field">
          <label htmlFor="c-name">Your name</label>
          <input className="input" id="c-name" name="name" autoComplete="name" required maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="c-email">Email</label>
          <input className="input" id="c-email" name="email" type="email" autoComplete="email" required maxLength={200} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="c-topic">I am a</label>
        <select className="input" id="c-topic" name="topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {CONTACT_TOPICS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      {topic === "School or counselor" && (
        <div className="field">
          <label htmlFor="c-school">School name</label>
          <input className="input" id="c-school" name="school" autoComplete="organization" maxLength={150} />
        </div>
      )}
      <div className="field">
        <label htmlFor="c-message">Message</label>
        <textarea className="input" id="c-message" name="message" required minLength={5} maxLength={5000} placeholder="How can we help?" />
      </div>
      {/* Hidden from people; bots fill it in and get dropped. */}
      <div className="s-trap" aria-hidden="true">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button className="btn" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send message"}</button>
      {error && <p className="note note-err" role="alert">{error}</p>}
      <p className="s-fine">We only use your email to answer you. See our <a href="/privacy">privacy policy</a>.</p>
    </form>
  );
}
