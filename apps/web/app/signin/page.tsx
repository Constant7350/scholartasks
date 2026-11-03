"use client";

import { useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page, card } from "../ui";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const sb = supabase();
  if (!sb) return <Page title="Sign in"><NotConfigured /></Page>;

  const send = async () => {
    const next = new URLSearchParams(window.location.search).get("next") ?? "/family";
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + next } });
    setStatus(error ? friendly(error) : "Check your email for a sign-in link.");
  };

  return (
    <Page title="Sign in">
      <div style={card}>
        <p>Parents and students sign in with a link sent by email. No password to remember.</p>
        <input aria-label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />{" "}
        <button onClick={send} disabled={!email.includes("@")}>Email me a sign-in link</button>
        {status && <p>{status}</p>}
      </div>
    </Page>
  );
}
