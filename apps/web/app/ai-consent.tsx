"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { AI_PAGES } from "../lib/ai-consent";

/**
 * Asks once, on pages with AI features, before anything goes to the AI provider
 * (Apple 5.1.2). The answer is saved per person; it can be changed on the account page.
 */
export function AiConsent() {
  const sb = supabase();
  const path = usePathname() ?? "/";
  const onAiPage = AI_PAGES.some((p) => path === p || path.startsWith(p + "/"));
  const [need, setNeed] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!sb || !onAiPage) return;
    let live = true;
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session) return;
      const { data: row, error } = await sb.from("user_settings").select("ai_consent_at").eq("user_id", data.session.user.id).maybeSingle();
      // Before database update 23 the column doesn't exist yet; don't ask.
      if (error) return;
      if (live) setNeed(!(row as { ai_consent_at: string | null } | null)?.ai_consent_at);
    })();
    return () => { live = false; };
  }, [sb, onAiPage, path]);

  if (!sb || !onAiPage || !need || dismissed === path) return null;

  const allow = async () => {
    setBusy(true);
    const { error } = await sb.rpc("set_ai_consent", { p_on: true });
    setBusy(false);
    if (!error) setNeed(false);
  };

  return (
    <div className="ai-consent" role="dialog" aria-labelledby="ai-consent-title">
      <div className="ai-consent-card">
        <h2 id="ai-consent-title">Allow AI help?</h2>
        <p>
          ScholarTasks&apos; AI help is powered by Claude, made by Anthropic. When you use an AI feature, ScholarTasks sends your question and the planning
          details needed to answer it (such as grades, test scores, colleges and goals) to Anthropic. Never passwords, Social Security numbers or FSA IDs.
        </p>
        <p>Anthropic uses it only to write the answer and may not use it to train AI models. You can turn this off any time in Menu, Face ID, sign-in and account.</p>
        <div className="share-row">
          <button className="btn btn-inline" onClick={allow} disabled={busy}>{busy ? "One moment…" : "Allow AI help"}</button>
          <button className="btn btn-ghost btn-inline" onClick={() => setDismissed(path)} disabled={busy}>Not now</button>
        </div>
        <p className="hint" style={{ margin: "10px 0 0" }}><a href="/privacy">Privacy policy</a></p>
      </div>
    </div>
  );
}
