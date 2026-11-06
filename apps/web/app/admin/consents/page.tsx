"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

/**
 * Team-only view of every signed consent and the consent audit trail: codes sent,
 * failed identity checks, signatures, when each was used, and permissions taken back.
 * From the tamper-evident audit log (database update 57).
 */
interface Row { at: string; action: string; kind: string; target_id: string | null; student_id: string | null; actor_email: string | null; details: Record<string, unknown> }
interface Sig { id: string; kind: string; signed_name: string; user_email: string | null; signature: string; verified_by: string; signed_at: string; used_at: string | null; wording: string; ip: string | null }

const ACTION: Record<string, string> = {
  consent_code_sent: "Email code sent",
  consent_identity_failed: "⚠️ Identity check failed",
  consent_signed: "✍️ Signed",
  consent_used: "✓ Consent given",
  consent_withdrawn: "Permission taken back",
};
const KIND: Record<string, string> = {
  job_application: "Job application", school_link: "School connection", school_agreement: "School data agreement", video: "Video permission", challenge: "Essay challenge", prize: "Prize pick-up receipt", identity: "Identity check",
};

export default function Consents() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<Row[]>([]);
  const [sigs, setSigs] = useState<Sig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"sigs" | "trail">("sigs");

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/consents");
    const a = await sb.rpc("is_app_admin");
    setAdmin(a.data === true);
    if (a.data !== true) return;
    const [t, g] = await Promise.all([
      sb.rpc("consent_audit_trail", { p_limit: 500 }),
      sb.from("consent_signatures").select("id, kind, signed_name, user_email, signature, verified_by, signed_at, used_at, wording, ip").order("signed_at", { ascending: false }).limit(200),
    ]);
    if (t.error) setError(/consent_audit_trail/.test(t.error.message) ? "Run database update 57 in Supabase first." : friendly(t.error));
    setRows((t.data as Row[]) ?? []);
    setSigs((g.data as Sig[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Signed consents"><NotConfigured /></Page>;
  if (admin === undefined) return <Page title="Signed consents"><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title="Signed consents"><p className="note note-err">This page is for the ScholarTasks team.</p></Page>;
  const failed = rows.filter((r) => r.action === "consent_identity_failed" && Date.now() - new Date(r.at).getTime() < 7 * 86400000).length;

  return (
    <Page title="Signed consents">
      <p className="hint">Every consent in ScholarTasks is signed with a finger, after the person proves it&apos;s them (Face ID or a code to their own email). Student accounts can never sign. Each signature works once, and the signer gets an email copy.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {failed > 0 && <p className="note">{failed} failed identity check{failed === 1 ? "" : "s"} in the last 7 days. See the audit trail.</p>}
      <nav className="review-nav">
        <a href="#sigs" aria-current={tab === "sigs" ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab("sigs"); }}>Signatures ({sigs.length})</a>
        <a href="#trail" aria-current={tab === "trail" ? "page" : undefined} onClick={(e) => { e.preventDefault(); setTab("trail"); }}>Audit trail ({rows.length})</a>
      </nav>
      {tab === "sigs" && (
        <section className="panel">
          {sigs.length === 0 && <p className="hint">No signatures yet.</p>}
          {sigs.map((g) => (
            <details key={g.id} className="mk-step">
              <summary style={{ cursor: "pointer" }}>
                <b>{KIND[g.kind] ?? g.kind}</b> · {g.signed_name} ({g.user_email ?? "no email"}) · {new Date(g.signed_at).toLocaleString()} · {g.verified_by === "passkey" ? "Face ID" : "email code"}{g.used_at ? "" : " · not used"}
              </summary>
              <img src={g.signature} alt={`Signature of ${g.signed_name}`} style={{ height: 70, background: "#fff", border: "1px solid #ece6db", borderRadius: 6, margin: "8px 0" }} />
              <p className="hint" style={{ whiteSpace: "pre-wrap" }}>{g.wording}</p>
              {g.ip && <p className="hint small">From {g.ip}</p>}
            </details>
          ))}
        </section>
      )}
      {tab === "trail" && (
        <section className="panel">
          <div className="mk-table-wrap">
            <table className="mk-table">
              <thead><tr><th>When</th><th>What</th><th>For</th><th>Who</th><th>How</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{new Date(r.at).toLocaleString()}</td>
                    <td>{ACTION[r.action] ?? r.action}</td>
                    <td>{KIND[r.kind] ?? r.kind}</td>
                    <td>{(r.details.signed_name as string) ?? ""} {r.actor_email ? `(${r.actor_email})` : ""}</td>
                    <td>{[r.details.verified_by ?? r.details.method, r.details.ip].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint small">The audit log is chained so no line can be changed or removed without it showing.</p>
        </section>
      )}
    </Page>
  );
}
