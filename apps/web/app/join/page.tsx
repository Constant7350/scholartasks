"use client";

import { useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page, card } from "../ui";

export default function Join() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    sb?.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, [sb]);

  if (!sb) return <Page title="Join your family"><NotConfigured /></Page>;
  if (signedIn === false)
    return <Page title="Join your family"><p style={card}><a href="/signin?next=/join">Sign in</a> with your own email first.</p></Page>;

  const join = async () => {
    const { error } = await sb.rpc("accept_student_invite", { p_code: code });
    setStatus(error ? friendly(error) : "You're connected! Your plan is ready.");
  };

  return (
    <Page title="Join your family">
      <div style={card}>
        <p>Enter the 8-character code your parent sees in their ScholarTasks account.</p>
        <input aria-label="Invite code" value={code} maxLength={10} onChange={(e) => setCode(e.target.value.toUpperCase())} />{" "}
        <button onClick={join} disabled={code.trim().length < 8}>Join</button>
        {status && <p>{status}</p>}
      </div>
    </Page>
  );
}
