"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { SignConsent } from "../sign-consent";

/**
 * A parent gives (or takes back) permission for their student to appear in
 * ScholarTasks social media videos, from the link our team sends. The parent
 * must be signed in, sign with a finger and confirm it's them (Face ID or an
 * email code). The signed copy is kept by ScholarTasks; no paper form needed.
 */
const VERSION = "video-v1";
const wording = (student: string) => `I am the parent or legal guardian of ${student}. I agree that ${student} may appear in short videos and photos that ScholarTasks posts on social media (such as TikTok, Instagram, YouTube and Facebook) to help families with college planning.
I understand that:
- My student's last name, school, town and workplace will not be shown or said.
- ScholarTasks will show me a video before it is posted if I ask.
- I can take back this permission at any time on this page or by emailing support@scholartasks.com. New videos will stop, and ScholarTasks will remove posted videos with my student within 7 days.
- No payment is made for appearing in the videos.`;

interface Info { student: string; signed: boolean; signed_name: string | null; signed_at: string | null; mine: boolean; withdrawn_at: string | null }

export default function VideoPermission() {
  const sb = supabase();
  const [token, setToken] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    setToken(t);
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace(`/signin?next=${encodeURIComponent(`/video-permission?t=${t}`)}`);
    if (!/^[0-9a-f-]{36}$/i.test(t)) return setInfo(null);
    const { data, error: e } = await sb.rpc("video_consent_get", { p_token: t });
    if (e) { setError(friendly(e)); setInfo(null); return; }
    setInfo((data as Info | null) ?? null);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Video permission"><NotConfigured /></Page>;
  if (info === undefined) return <Page title="Video permission"><p className="hint">Loading…</p></Page>;
  if (!info || !token) {
    return <Page title="Video permission">{error && <p className="note note-err">{error}</p>}<p className="note note-info">This permission link is no longer valid. Ask our team for a new one at <a href="mailto:support@scholartasks.com">support@scholartasks.com</a>.</p></Page>;
  }

  const withdraw = async () => {
    if (!window.confirm(`Take back permission for ${info.student} to appear in our videos?`)) return;
    const { error: e } = await sb.rpc("video_consent_withdraw", { p_token: token });
    if (e) setError(friendly(e)); else { setDone("Permission taken back. Our team will remove posted videos within 7 days."); await load(); }
  };

  return (
    <Page title="Video permission">
      <p className="hint">Our team would like {info.student} to appear in short ScholarTasks videos that help other families. Please read this and sign if you agree.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {done && <p className="note note-ok" role="status">{done}</p>}
      {info.signed ? (
        <div className="panel">
          <h2>✓ Permission on file</h2>
          <p>Signed by {info.signed_name} on {info.signed_at ? new Date(info.signed_at).toLocaleDateString() : ""}. We emailed you a copy.</p>
          {info.mine && <button className="btn btn-ghost btn-inline" style={{ color: "#b42318" }} onClick={() => void withdraw()}>Take back permission</button>}
        </div>
      ) : (
        <div className="panel">
          {info.withdrawn_at && <p className="note">Permission was taken back on {new Date(info.withdrawn_at).toLocaleDateString()}. You can sign again below.</p>}
          <SignConsent kind="video" target={token} version={VERSION} wording={wording(info.student)} button="Sign and agree"
            onSigned={async () => { setDone("Thank you. Your permission is saved and we emailed you a copy."); await load(); }} />
        </div>
      )}
    </Page>
  );
}
