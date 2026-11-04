"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendly } from "../lib/supabase";

interface Me { id: string; first_name: string; birth_date: string; adult_consents_parent_access: boolean | null }

/** Whole years between a YYYY-MM-DD birth date and today. */
export function ageToday(birth: string, today = new Date().toLocaleDateString("en-CA")): number {
  const [by, bm, bd] = birth.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/**
 * For a student who has turned 18: the law lets them decide whether their parents
 * keep seeing their plan. On Home it shows once, until they answer ("ask" mode).
 * On the sign-in page it always shows for 18+ students so they can change it ("manage" mode).
 */
export function AdultConsent({ sb, mode }: { sb: SupabaseClient; mode: "ask" | "manage" }) {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return;
      const { data: m } = await sb.from("family_members").select("student_id, role").eq("user_id", auth.user.id).eq("role", "student").limit(1);
      const sid = (m as { student_id: string | null }[] | null)?.[0]?.student_id;
      if (!sid) return;
      const { data: s } = await sb.from("students").select("id, first_name, birth_date, adult_consents_parent_access").eq("id", sid).single();
      if (s && (s as Me).birth_date && ageToday((s as Me).birth_date) >= 18) setMe(s as Me);
    })();
  }, [sb]);

  if (!me) return null;
  if (mode === "ask" && me.adult_consents_parent_access !== null) return null;

  const answer = async (yes: boolean) => {
    setBusy(true);
    setError(null);
    const { error: e } = await sb.rpc("set_adult_consent", { p_student: me.id, p_consent: yes });
    setBusy(false);
    if (e) return setError(friendly(e));
    setMe({ ...me, adult_consents_parent_access: yes });
  };

  const current = me.adult_consents_parent_access;
  return (
    <div className="panel family-card" role="region" aria-label="Parent access">
      <div>
        <h2>{mode === "ask" ? `You're 18, ${me.first_name}. Keep sharing with your parents?` : "Parent access"}</h2>
        <p className="hint" style={{ margin: 0 }}>
          Now that you're 18, you decide whether your parents can still see your plan, grades and tasks in ScholarTasks.
          Most families keep sharing during senior year. You can change this any time on the Face ID, sign-in and account page.
        </p>
        {mode === "manage" && current !== null && (
          <p className="note" style={{ marginBottom: 0 }}>Right now your parents {current ? "can" : "can't"} see your plan.</p>
        )}
        {error && <p className="note note-err" role="alert">{error}</p>}
      </div>
      <div className="passkey-actions">
        <button className="btn btn-inline" onClick={() => answer(true)} disabled={busy || current === true}>Yes, keep sharing</button>
        <button className="btn btn-ghost btn-inline" onClick={() => answer(false)} disabled={busy || current === false}>No, stop sharing</button>
      </div>
    </div>
  );
}
