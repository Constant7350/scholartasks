"use client";

import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PART_TIME_KINDS, PERMISSIONS } from "@scholartasks/core";
import { friendly } from "../../lib/supabase";

interface Kid { id: string; first_name: string; permissions?: Record<string, boolean> | null }
interface Waiting { key: string; icon: string; text: string; href: string; action: string }
interface Signature {
  id: string; user_id: string; kind: string; student_id: string | null; signed_name: string; wording: string;
  version: string | null; verified_by: "passkey" | "email_code"; signed_at: string; used_at: string | null;
}

const KIND: Record<string, string> = {
  job_application: "Job application",
  school_link: "Connect to a school counselor",
  school_agreement: "School data agreement",
  video: "Appear in ScholarTasks videos",
};
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * Every permission and sign-off in one place: what is waiting for a parent, what each student
 * may do on their own (changeable here), and every consent the family has signed.
 * Signing itself still happens on the page it belongs to (Face ID or email code + signature).
 */
export function SignOffs({ sb, me, kids, onChanged }: { sb: SupabaseClient; me: string; kids: Kid[]; onChanged: () => void }) {
  const [waiting, setWaiting] = useState<Waiting[] | null>(null);
  const [signed, setSigned] = useState<Signature[]>([]);
  const [aiOn, setAiOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const name = useCallback((id: string | null) => kids.find((k) => k.id === id)?.first_name ?? "Your student", [kids]);

  const load = useCallback(async () => {
    const [jobs, links, tasks, colleges, sigs, settings] = await Promise.all([
      sb.rpc("my_job_applications"),
      sb.rpc("my_school_links"),
      sb.from("tasks").select("id, student_id, title").eq("status", "needs_parent_approval"),
      sb.from("student_colleges").select("id, student_id, name").eq("approved", false),
      sb.from("consent_signatures").select("id, user_id, kind, student_id, signed_name, wording, version, verified_by, signed_at, used_at").order("signed_at", { ascending: false }).limit(60),
      sb.from("user_settings").select("ai_consent_at").eq("user_id", me).maybeSingle(),
    ]);
    const w: Waiting[] = [];
    for (const a of ((jobs.data as { id: string; student_id: string; title: string; company_name: string; kind: string; status: string }[]) ?? []).filter((x) => x.status === "needs_parent")) {
      const part = (PART_TIME_KINDS as readonly string[]).includes(a.kind);
      w.push({ key: `job-${a.id}`, icon: "🛍️", text: `${name(a.student_id)} wants to apply to ${a.title} at ${a.company_name}`, href: part ? "/jobs" : "/trades/openings", action: "Review and sign" });
    }
    for (const l of ((links.data as { id: string; student_id: string; school_name: string; status: string }[]) ?? []).filter((x) => x.status === "pending_parent")) {
      w.push({ key: `school-${l.id}`, icon: "🏫", text: `${name(l.student_id)} wants to connect to ${l.school_name}`, href: "/my-school", action: "Review and sign" });
    }
    for (const t of (tasks.data as { id: string; student_id: string; title: string }[]) ?? []) {
      w.push({ key: `task-${t.id}`, icon: "✅", text: `${name(t.student_id)} marked "${t.title}" done`, href: "/plan", action: "Check and approve" });
    }
    for (const c of (colleges.data as { id: string; student_id: string; name: string }[]) ?? []) {
      w.push({ key: `college-${c.id}`, icon: "🗂️", text: `${name(c.student_id)} changed ${c.name} on the college list`, href: "/plan", action: "Check and approve" });
    }
    setWaiting(w);
    setSigned((sigs.data as Signature[]) ?? []);
    setAiOn((settings.data as { ai_consent_at: string | null } | null)?.ai_consent_at ?? null);
  }, [sb, me, name]);
  useEffect(() => { void load(); }, [load]);

  const setPermission = async (kid: Kid, key: string, value: boolean) => {
    setError(null);
    const { error: e } = await sb.rpc("set_student_permission", { p_student: kid.id, p_key: key, p_value: value });
    if (e) return setError(friendly(e));
    onChanged();
  };

  return (
    <section className="panel" id="sign-offs">
      <h2>✍️ Permissions and sign-offs</h2>
      <p className="hint">Everything you approve or sign, in one place. Signing still uses Face ID or a code sent to your email, plus your signature, so only you can do it.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}

      <h3>Waiting for you {waiting && waiting.length > 0 && <span className="pill pill-soon">{waiting.length}</span>}</h3>
      {waiting === null ? <p className="hint">Loading…</p> : waiting.length === 0 ? <p className="hint">Nothing is waiting for you. ✓</p> : (
        <ul className="items">
          {waiting.map((x) => (
            <li key={x.key}>
              <div className="item-main"><b><span aria-hidden="true">{x.icon}</span> {x.text}</b></div>
              <div className="item-actions"><a className="btn btn-inline btn-sm link-btn" href={x.href}>{x.action}</a></div>
            </li>
          ))}
        </ul>
      )}

      {kids.map((k) => (
        <details key={k.id} className="perm ps-perm">
          <summary>What {k.first_name} can do without asking you</summary>
          {PERMISSIONS.map((p) => (
            <label key={p.key}>
              <input type="checkbox" checked={!!k.permissions?.[p.key]} onChange={(e) => void setPermission(k, p.key, e.target.checked)} />
              {p.label}
            </label>
          ))}
        </details>
      ))}

      <h3>Signed</h3>
      {signed.length === 0 && !aiOn ? <p className="hint">Nothing signed yet. Consents you sign (job applications, school connections, video permission) are kept here with the exact wording.</p> : (
        <ul className="items">
          {aiOn && (
            <li>
              <div className="item-main"><b>🤖 AI features turned on</b><span className="hint small">You agreed on {when(aiOn)}. Turn them off any time on <a href="/security">Face ID, sign-in and account</a>.</span></div>
            </li>
          )}
          {signed.map((s) => (
            <li key={s.id}>
              <div className="item-main">
                <b>{KIND[s.kind] ?? s.kind}{s.student_id ? ` · ${name(s.student_id)}` : ""}</b>
                <span className="hint small">
                  Signed by {s.signed_name}{s.user_id === me ? " (you)" : ""} on {when(s.signed_at)} with {s.verified_by === "passkey" ? "Face ID or fingerprint" : "an email code"}{s.used_at ? "" : " · not used yet"}
                </span>
                <details className="rescue-more">
                  <summary>What was signed</summary>
                  <p className="small">{s.wording}</p>
                  {s.version && <p className="hint small">Version {s.version}</p>}
                </details>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="hint small">Every signature and approval is also kept in your family&apos;s audit trail. Questions? Write to our team at support@scholartasks.com.</p>
    </section>
  );
}
