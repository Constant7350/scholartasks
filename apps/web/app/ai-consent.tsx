"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { AI_PAGES } from "../lib/ai-consent";

/**
 * Allow AI help: asked once before anything goes to the AI provider (Apple 5.1.2). It is a short
 * line at the top of AI pages with an Allow button, not a pop-up that blocks the page, and a
 * Get set up step on Home (Constant, 2026-11-07). The answer is saved per person and can be
 * changed on the account page.
 */
export function useAiConsent(sb: ReturnType<typeof supabase>, active = true) {
  const [need, setNeed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!sb || !active) return;
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
  }, [sb, active]);
  const allow = async () => {
    if (!sb) return;
    setBusy(true);
    const { error } = await sb.rpc("set_ai_consent", { p_on: true });
    setBusy(false);
    if (!error) setNeed(false);
  };
  return { need, busy, allow };
}

export function AiConsent() {
  const sb = supabase();
  const path = usePathname() ?? "/";
  const onAiPage = AI_PAGES.some((p) => path === p || path.startsWith(p + "/"));
  const { need, busy, allow } = useAiConsent(sb, onAiPage);
  const [dismissed, setDismissed] = useState<string | null>(null);

  if (!sb || !onAiPage || !need || dismissed === path) return null;

  return (
    <div className="ai-consent" role="region" aria-label="Allow AI help">
      <div className="ai-consent-card">
        <div className="ai-consent-row">
          <span><b>Allow AI help?</b> The counselor, tutor and essay coach need a yes before they can answer.</span>
          <button className="btn btn-inline btn-sm" onClick={allow} disabled={busy}>{busy ? "One moment…" : "Allow AI help"}</button>
          <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setDismissed(path)} disabled={busy}>Later</button>
        </div>
        <details>
          <summary>What is sent?</summary>
          <p>
            ScholarTasks&apos; AI help is powered by Claude, made by Anthropic. When you use an AI feature, ScholarTasks sends your question and the planning
            details needed to answer it (such as grades, test scores, colleges and goals) to Anthropic. Never passwords, Social Security numbers or FSA IDs.
            Anthropic uses it only to write the answer and may not use it to train AI models. Turn it off any time under Face ID, sign-in and account. <a href="/privacy">Privacy policy</a>
          </p>
        </details>
      </div>
    </div>
  );
}
