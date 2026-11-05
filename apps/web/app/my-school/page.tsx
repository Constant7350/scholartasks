"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";

interface Student { id: string; first_name: string; grade_level: number; birth_date: string }
interface Link { id: string; student_id: string; school_id: string; school_name: string; city: string; state: string; share: "progress" | "progress_grades"; status: "pending_parent" | "active"; created_at: string }
interface Msg { id: string; school_id: string; subject: string; body: string; sent_at: string }

const SHARE: Record<Link["share"], { label: string; detail: string }> = {
  progress: {
    label: "Progress only",
    detail: "College list counts, applications sent, FAFSA filed or not, saved scholarships, overdue deadlines, SAT/ACT scores and when they last used the app.",
  },
  progress_grades: {
    label: "Progress and grades",
    detail: "Everything above, plus course grades and the state scholarship GPA.",
  },
};
const NEVER = "Never shared: essays, notes, AI counselor chats, family income, aid answers, or anything about parents.";

const isAdult = (birth: string) => {
  const b = new Date(birth + "T12:00:00"), n = new Date();
  return n.getFullYear() - b.getFullYear() - (n < new Date(n.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0) >= 18;
};

export default function MySchool() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [role, setRole] = useState<"parent" | "student" | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    setSignedIn(!!s.session);
    if (!s.session) return;
    const [mem, st, l, m] = await Promise.all([
      sb.from("family_members").select("role").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, grade_level, birth_date").order("first_name"),
      sb.rpc("my_school_links"),
      sb.from("school_messages").select("id, school_id, subject, body, sent_at").order("sent_at", { ascending: false }).limit(5),
    ]);
    const roles = ((mem.data as { role: string }[]) ?? []).map((r) => r.role);
    setRole(roles.includes("parent") ? "parent" : roles.includes("student") ? "student" : null);
    setStudents((st.data as Student[]) ?? []);
    if (l.error && /my_school_links/.test(l.error.message)) setError("This page needs database update 37. Ask the ScholarTasks team.");
    setLinks((l.data as Link[]) ?? []);
    setMsgs((m.data as Msg[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="My school"><NotConfigured /></Page>;
  if (signedIn === null) return <Page title="My school"><p className="hint">Loading…</p></Page>;
  if (!signedIn || !role)
    return (
      <Page title="My school">
        <div className="panel">
          <h2>Connect to your school</h2>
          <p className="hint">If your school counselor gave you a school code, sign in and set up your family first. Then come back here to connect.</p>
          <a className="btn btn-inline" style={{ display: "inline-block", textDecoration: "none" }} href={signedIn ? "/family" : `/signin?next=${encodeURIComponent("/my-school" + (typeof window !== "undefined" ? window.location.search : ""))}`}>
            {signedIn ? "Set up my family" : "Sign in"}
          </a>
        </div>
      </Page>
    );

  const run = async (fn: () => PromiseLike<{ error: unknown; data?: unknown }>, done?: string) => {
    setError(null); setNotice(null);
    const { error: e, data } = await fn();
    if (e) setError(friendly(e)); else { if (done) setNotice(done); await load(); }
    return e ? null : data;
  };

  return (
    <Page title="My school">
      <p className="hint">Connect to your school so your counselor can see how things are going and send reminders. It's free, you choose what to share, and you can stop any time.</p>
      {error && <p className="note note-err" role="alert">{error}</p>}
      {notice && <p className="note note-ok" role="status">{notice}</p>}
      {students.length === 0 && <p className="note note-info">Add a student on the <a href="/family">Family page</a> first.</p>}

      {students.map((s) => {
        const mine = links.filter((l) => l.student_id === s.id);
        const adult = isAdult(s.birth_date);
        return (
          <div key={s.id} className="panel">
            <h2>{role === "parent" ? s.first_name : "Your school"}</h2>
            {mine.map((l) => (
              <div key={l.id} className="note note-info" style={{ marginTop: 8 }}>
                <p style={{ margin: "0 0 6px" }}>
                  <strong>{l.school_name}</strong>, {l.city} {l.status === "active" ? <span className="pill pill-ok">Connected</span> : <span className="pill pill-soon">Waiting for a parent</span>}
                </p>
                <p style={{ margin: "0 0 8px", fontSize: 14 }}>Sharing: {SHARE[l.share].label}. {SHARE[l.share].detail}</p>
                <div className="share-row">
                  {l.status === "pending_parent" && role === "parent" && (
                    <button className="btn btn-inline" onClick={() => run(() => sb.rpc("approve_school_link", { p_link: l.id }), `${s.first_name} is now connected to ${l.school_name}.`)}>Approve</button>
                  )}
                  {(role === "parent" || adult || l.share === "progress_grades") && (
                    <button className="btn btn-ghost btn-inline" onClick={() => run(() => sb.rpc("set_school_link_share", { p_link: l.id, p_share: l.share === "progress" ? "progress_grades" : "progress" }), "Sharing updated.")}>
                      {l.share === "progress" ? "Also share grades" : "Stop sharing grades"}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-inline" style={{ color: "#b42318" }}
                    onClick={() => window.confirm(`Stop sharing with ${l.school_name}? The school won't see anything new.`) && run(() => sb.rpc("end_school_link", { p_link: l.id }), "Sharing stopped.")}>
                    {l.status === "pending_parent" ? "Decline" : "Stop sharing"}
                  </button>
                </div>
              </div>
            ))}
            <ConnectForm
              student={s}
              canShareGrades={role === "parent" || adult}
              hasLinks={mine.length > 0}
              onConnect={(code, share) => run(() => sb.rpc("link_student_to_school", { p_student: s.id, p_code: code, p_share: share }))}
              lookup={async (code) => {
                const { data } = await sb.rpc("school_lookup", { p_code: code });
                return ((data as { name: string; city: string; state: string }[]) ?? [])[0] ?? null;
              }}
              onResult={(status, name) => setNotice(status === "pending_parent"
                ? `Asked to connect to ${name}. A parent needs to approve it on their My school page.`
                : `${s.first_name} is connected to ${name}.`)}
            />
          </div>
        );
      })}

      {msgs.length > 0 && (
        <div className="panel">
          <h2>Messages from your school</h2>
          {msgs.map((m) => (
            <div key={m.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{m.subject}</p>
              <p className="hint" style={{ margin: "2px 0 6px", fontSize: 13 }}>{new Date(m.sent_at).toLocaleDateString()}</p>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
            </div>
          ))}
        </div>
      )}
      <p className="hint" style={{ fontSize: 13 }}>{NEVER}</p>
    </Page>
  );
}

function ConnectForm({ student, canShareGrades, hasLinks, onConnect, lookup, onResult }: {
  student: Student; canShareGrades: boolean; hasLinks: boolean;
  onConnect: (code: string, share: Link["share"]) => Promise<unknown>;
  lookup: (code: string) => Promise<{ name: string; city: string; state: string } | null>;
  onResult: (status: string, name: string) => void;
}) {
  const [open, setOpen] = useState(!hasLinks);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ name: string; city: string; state: string } | null | undefined>(undefined);
  const [share, setShare] = useState<Link["share"]>("progress");
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) { setCode(c.toUpperCase()); setOpen(true); }
  }, []);
  useEffect(() => {
    if (code.trim().length !== 8) { setFound(undefined); return; }
    let live = true;
    void lookup(code.trim()).then((f) => live && setFound(f));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!open) return <button className="btn btn-ghost btn-inline" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Connect to another school</button>;
  return (
    <div style={{ marginTop: 12 }}>
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor={`code-${student.id}`}>School code</label>
        <input id={`code-${student.id}`} className="input" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="8 letters and numbers" />
      </div>
      {found === null && <p className="note note-err">We couldn't find a school with that code. Check it with your counselor.</p>}
      {found && (
        <>
          <p style={{ margin: "0 0 10px" }}>Connect {student.first_name} to <strong>{found.name}</strong>, {found.city}, {found.state}?</p>
          <fieldset style={{ border: 0, padding: 0, margin: "0 0 12px" }}>
            <legend className="hint" style={{ marginBottom: 6 }}>What can the school see?</legend>
            {(Object.keys(SHARE) as Link["share"][]).filter((k) => k === "progress" || canShareGrades).map((k) => (
              <label key={k} style={{ display: "block", margin: "0 0 8px" }}>
                <input type="radio" name={`share-${student.id}`} checked={share === k} onChange={() => setShare(k)} /> <strong>{SHARE[k].label}</strong>
                <span className="hint" style={{ display: "block", marginLeft: 22, fontSize: 13 }}>{SHARE[k].detail}</span>
              </label>
            ))}
          </fieldset>
          <button className="btn btn-inline" onClick={async () => {
            const status = await onConnect(code.trim(), share);
            if (typeof status === "string") { onResult(status, found.name); setCode(""); setOpen(false); }
          }}>Connect</button>
        </>
      )}
    </div>
  );
}
