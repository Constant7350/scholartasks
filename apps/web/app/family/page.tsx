"use client";

import { useCallback, useEffect, useState } from "react";
import { IconTabs } from "../icon-tabs";
import { PERMISSIONS, type PermissionKey } from "@scholartasks/core";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { STATE_NAMES } from "../../lib/trades";
import { STATE_PACKS } from "../../lib/state-packs";

/** Every state, ones with full state aid details marked, for the "Lives in" picker. */
const STATE_OPTIONS = Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1]))
  .map(([code, name]) => ({ code, label: STATE_PACKS[code] ? `${name} (state aid included)` : name }));

function StateSelect({ id, value, onChange, label }: { id: string; value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <select id={id} className="input" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {STATE_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}

interface Student {
  id: string;
  family_id: string;
  first_name: string;
  grade_level: number;
  birth_date?: string | null;
  state: string;
  permissions: Record<PermissionKey, boolean>;
}
interface Family { id: string; name: string }
interface Invite { student_id: string; code: string; expires_at: string; accepted_at: string | null }

function inviteMessage(name: string, code: string, expires: string) {
  const link = `${window.location.origin}/join?code=${code}`;
  const until = new Date(expires).toLocaleDateString();
  return {
    link,
    subject: `Join our family on ScholarTasks`,
    body: `Hi ${name}! I set up ScholarTasks for our college and scholarship planning. Tap this link and sign in with your own email: ${link}\n\nYour family code is ${code} (it works until ${until}).`,
  };
}

function ShareInvite({ name, code, expires }: { name: string; code: string; expires: string }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);
  const m = inviteMessage(name, code, expires);
  return (
    <div className="share">
      <p className="share-title">Send it to {name}</p>
      <div className="share-row">
        <a className="btn btn-inline share-btn" href={`sms:?&body=${encodeURIComponent(m.body)}`}>💬 Text it</a>
        <a className="btn btn-inline share-btn" href={`mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>✉️ Email it</a>
        {canShare && (
          <button className="btn btn-ghost btn-inline" onClick={() => navigator.share({ title: m.subject, text: m.body }).catch(() => {})}>
            More ways…
          </button>
        )}
        <button
          className="btn btn-ghost btn-inline"
          onClick={async () => {
            try { await navigator.clipboard.writeText(m.body); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {}
          }}
        >
          {copied ? "✓ Copied" : "Copy message"}
        </button>
      </div>
      <p className="hint" style={{ margin: "8px 0 0", fontSize: 13 }}>Your phone or email app opens with the message ready. You pick {name}'s number or email and press send.</p>
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const items = ["Name your family", "Add your student", "Invite them to the student app"];
  return (
    <ol className="steps" aria-label="Setup steps">
      {items.map((label, i) => {
        const n = i + 1;
        const cls = n < step ? "done" : n === step ? "now" : "";
        return (
          <li key={label} className={cls}>
            <span className="n">{n < step ? "✓" : n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

function RemoveStudent({ id, name, onRemoved }: { id: string; name: string; onRemoved: (msg: string) => void }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const remove = async () => {
    const sb = supabase();
    if (!sb) return;
    setBusy(true); setErr(null);
    try {
      const { data } = await sb.auth.getSession();
      const res = await fetch("/api/family/remove-student", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ student: id, confirm: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Something went wrong. Please try again.");
      onRemoved(`${name} was removed.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 14 }}>
      {!asking ? (
        <button className="btn btn-ghost btn-inline" style={{ color: "#b42318" }} onClick={() => setAsking(true)}>Remove {name}</button>
      ) : (
        <div className="note note-err" style={{ margin: 0 }}>
          <p style={{ margin: "0 0 10px" }}>
            Remove {name} from your family? This deletes {name}'s grades, college and scholarship lists, tasks and everything else saved for them, and their student app sign-in. It can't be undone.
          </p>
          <button className="btn btn-inline" style={{ background: "#b42318" }} disabled={busy} onClick={() => void remove()}>{busy ? "Removing…" : `Yes, remove ${name}`}</button>
          <button className="btn btn-ghost btn-inline" style={{ marginLeft: 8 }} disabled={busy} onClick={() => { setAsking(false); setErr(null); }}>Cancel</button>
          {err && <p role="alert" style={{ margin: "10px 0 0" }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

/** True when a birth date (YYYY-MM-DD) is less than 13 years ago. */
function under13(birth: string | null | undefined): boolean {
  if (!birth) return false;
  const b = new Date(`${birth}T12:00:00`), t = new Date();
  const thirteen = new Date(b.getFullYear() + 13, b.getMonth(), b.getDate());
  return t < thirteen;
}

export default function FamilyPage() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [child, setChild] = useState({ first_name: "", birth_date: "", grade_level: "9", state: "GA" });

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    setSignedIn(!!s.session);
    if (!s.session) return;
    const [f, st, inv] = await Promise.all([
      sb.from("families").select("id, name"),
      sb.from("students").select("id, family_id, first_name, grade_level, state, permissions, birth_date").order("first_name"),
      sb.from("family_invites").select("student_id, code, expires_at, accepted_at").order("created_at", { ascending: false }),
    ]);
    setFamilies((f.data as Family[]) ?? []);
    setStudents((st.data as Student[]) ?? []);
    setInvites((inv.data as Invite[]) ?? []);
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Your family"><NotConfigured /></Page>;
  if (signedIn === null) return <Page title="Your family"><p className="hint">Loading…</p></Page>;
  if (signedIn === false)
    return (
      <Page title="Your family">
        <div className="panel">
          <h2>Sign in to set up your family</h2>
          <p className="hint">Parents sign in here to add their students and choose what each student can do.</p>
          <a className="btn btn-inline" style={{ display: "inline-block", textDecoration: "none" }} href="/signin?next=/family">Sign in as a parent</a>
        </div>
      </Page>
    );

  const run = async (fn: () => PromiseLike<{ error: unknown; data?: unknown }>) => {
    setError(null);
    const { error: e, data } = await fn();
    if (e) setError(friendly(e));
    else await load();
    return e ? null : data;
  };

  const family = families[0];
  const connected = (id: string) => invites.some((i) => i.student_id === id && i.accepted_at);
  const activeCode = (id: string) =>
    invites.find((i) => i.student_id === id && !i.accepted_at && new Date(i.expires_at) > new Date());
  const step: 1 | 2 | 3 | 4 = !family ? 1 : students.length === 0 ? 2 : students.every((s) => connected(s.id)) ? 4 : 3;

  const addChildForm = (
    <div className="panel">
      {step === 2 && <p className="eyebrow">Step 2 of 3</p>}
      <h2>{students.length ? "Add another student" : "Add your student"}</h2>
      <p className="hint">Students must be 13 or older. Full state aid help is ready for 11 Southeast states, and families in every state can join.</p>
      <div className="row">
        <div className="field">
          <label htmlFor="first">First name</label>
          <input id="first" className="input" value={child.first_name} onChange={(e) => setChild({ ...child, first_name: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="dob">Birth date</label>
          <input id="dob" className="input" type="date" value={child.birth_date} onChange={(e) => setChild({ ...child, birth_date: e.target.value })} />
        </div>
        <div className="field" style={{ flex: "0 1 230px" }}>
          <label htmlFor="child-state">Lives in</label>
          <StateSelect id="child-state" value={child.state} onChange={(v) => setChild({ ...child, state: v })} />
        </div>
        <div className="field" style={{ flex: "0 1 140px" }}>
          <label htmlFor="grade">Grade</label>
          <select id="grade" className="input" value={child.grade_level} onChange={(e) => setChild({ ...child, grade_level: e.target.value })}>
            {[6, 7, 8, 9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>
        <button
          className="btn btn-inline"
          disabled={!child.first_name.trim() || !child.birth_date}
          onClick={async () => {
            const ok = await run(() =>
              sb.rpc("add_student", {
                p_family: family!.id,
                p_first_name: child.first_name.trim(),
                p_birth_date: child.birth_date,
                p_grade_level: Number(child.grade_level),
                p_state: child.state,
              }),
            );
            if (ok !== null) setChild({ first_name: "", birth_date: "", grade_level: "9", state: "GA" });
          }}
        >
          Add student
        </button>
      </div>
    </div>
  );

  return (
    <Page title={family ? family.name : "Set up your family"}>
      <Steps step={step} />
      {error && <p className="note note-err" role="alert">{error}</p>}
      {notice && <p className="note note-ok">{notice}</p>}

      {!family ? (
        <div className="panel">
          <p className="eyebrow">Step 1 of 3</p>
          <h2>Name your family account</h2>
          <p className="hint">You're the account owner. You'll add your students next.</p>
          <div className="row">
            <div className="field">
              <label htmlFor="fam">Family name</label>
              <input id="fam" className="input" placeholder="e.g. The Smith family" value={familyName} onChange={(e) => setFamilyName(e.target.value)} />
            </div>
            <button className="btn btn-inline" disabled={!familyName.trim()} onClick={() => run(() => sb.rpc("create_family", { p_name: familyName.trim() }))}>
              Create family
            </button>
          </div>
        </div>
      ) : (
        <>
          <IconTabs label="Your students" tabs={[
          ...students.map((s) => {
            const code = activeCode(s.id);
            const isConnected = connected(s.id);
            return { key: s.first_name.toLowerCase(), icon: isConnected ? "🧑‍🎓" : "✉️", label: s.first_name, body: (
              <div key={s.id} className="panel">
                <h2>{s.first_name}</h2>
                <div className="row" style={{ alignItems: "flex-end", gap: 8 }}>
                  <p className="hint" style={{ margin: 0 }}>Grade {s.grade_level} · lives in</p>
                  <div className="field" style={{ flex: "0 1 260px", margin: 0 }}>
                    <StateSelect id={`state-${s.id}`} label={`State ${s.first_name} lives in`} value={s.state} onChange={(v) => void run(() => sb!.from("students").update({ state: v }).eq("id", s.id))} />
                  </div>
                </div>
                <p className="hint" style={{ fontSize: 12, marginTop: 4 }}>The home state decides which state scholarships, grants and deadlines {s.first_name} sees. College searches always include every state.</p>

                {isConnected ? (
                  <p className="note note-ok">✓ {s.first_name} is connected to the student app.</p>
                ) : (
                  <>
                    <p className="eyebrow">Step 3 of 3</p>
                    <p style={{ margin: "0 0 12px" }}>Give {s.first_name} a code to connect their own phone or computer.</p>
                    {code ? (
                      <div className="code-box">
                        <div>Code for {s.first_name}:</div>
                        <div className="code">{code.code}</div>
                        <ol>
                          <li>Send {s.first_name} the code with the buttons below, or open <strong>{typeof window !== "undefined" ? window.location.host : ""}/join</strong> on their phone</li>
                          <li>{s.first_name} signs in with their own email</li>
                          <li>The code fills in for them. They tap <strong>Join my family</strong></li>
                        </ol>
                        <p className="hint" style={{ margin: "10px 0 0", fontSize: 13 }}>
                          Works for 7 days (until {new Date(code.expires_at).toLocaleDateString()}). Making a new code cancels this one.
                        </p>
                        <ShareInvite name={s.first_name} code={code.code} expires={code.expires_at} />
                      </div>
                    ) : under13(s.birth_date) ? (
                      <p className="hint" style={{ margin: 0 }}>{s.first_name} gets their own sign-in at 13. Until then, use ScholarTasks together from your account. AI help also starts at 13; study lessons, practice questions, the career quiz and the grades scorecard work now.</p>
                    ) : (
                      <button className="btn btn-inline" onClick={() => run(() => sb.rpc("create_student_invite", { p_student: s.id }))}>
                        Invite {s.first_name} to the student app
                      </button>
                    )}
                    {code && (
                      <button className="btn btn-ghost btn-inline" style={{ marginTop: 10 }} onClick={() => run(() => sb.rpc("create_student_invite", { p_student: s.id }))}>
                        Make a new code
                      </button>
                    )}
                  </>
                )}

                <details className="perm">
                  <summary>What {s.first_name} can do in the student app</summary>
                  {PERMISSIONS.map((p) => (
                    <label key={p.key}>
                      <input
                        type="checkbox"
                        checked={!!s.permissions[p.key]}
                        onChange={(e) => run(() => sb.rpc("set_student_permission", { p_student: s.id, p_key: p.key, p_value: e.target.checked }))}
                      />
                      {p.label}
                    </label>
                  ))}
                </details>
                <RemoveStudent id={s.id} name={s.first_name} onRemoved={(m) => { setNotice(m); void load(); }} />
              </div>
            ) };
          }),
          { key: "add", icon: "➕", label: "Add a student", body: addChildForm },
          ]} />
        </>
      )}
    </Page>
  );
}
