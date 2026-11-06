"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

interface Tester { email: string; name: string; phone: string | null; focus: "spanish" | "app"; note: string | null; active: boolean; added_at: string; last_seen: string | null }
interface Fix { by_email: string | null; status: string }

const SITE = "https://scholartasks.com";
const FOCUS: Record<Tester["focus"], string> = { spanish: "Spanish check", app: "General app test" };

/** The text or email we send a tester, with every link they need. */
function invite(t: Tester): { subject: string; body: string } {
  const first = t.name.split(" ")[0];
  if (t.focus === "spanish") {
    return {
      subject: "Revisión del español de ScholarTasks",
      body:
        `Hola ${first}, gracias por ayudarnos a revisar el español de ScholarTasks.\n\n` +
        `1. Inicia sesión (o crea tu cuenta) con este correo: ${t.email}\n${SITE}/signin?next=/check\n\n` +
        `2. En la página de revisión, toca "Crear mi familia de prueba". Todo es inventado.\n${SITE}/check\n\n` +
        `3. Toca "Activar el modo de revisión" y sigue los pasos, pantalla por pantalla. Marca cada texto como Correcto o escribe uno mejor con Cambiar.\n\n` +
        `Gracias,\nEl equipo de ScholarTasks`,
    };
  }
  return {
    subject: "Help us test ScholarTasks",
    body:
      `Hi ${first}, thanks for helping us test ScholarTasks.\n\n` +
      `1. Sign in (or make your account) with this email: ${t.email}\n${SITE}/signin?next=/check\n\n` +
      `2. On the check page, tap "Create my test family" ("Crear mi familia de prueba"). It fills your account with a made-up family so every page has something to show.\n${SITE}/check\n\n` +
      `3. Go through the app page by page. If anything is wrong or confusing, email support@scholartasks.com with the page and what happened.\n\n` +
      `Thank you,\nThe ScholarTasks team`,
  };
}

/** Team page: add testers, send them their links by text or email, and see how far they got. */
export default function TestersPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<Tester[]>([]);
  const [counts, setCounts] = useState<Map<string, { ok: number; fix: number }>>(new Map());
  const [form, setForm] = useState({ name: "", email: "", phone: "", focus: "spanish" as Tester["focus"], note: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/testers");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const [t, f] = await Promise.all([
      sb.from("app_testers").select("*").order("added_at", { ascending: false }),
      sb.from("translation_fixes").select("by_email, status"),
    ]);
    if (t.error) setMsg({ ok: false, text: t.error.message.includes("app_testers") ? "This page needs database update 52. Run it in Supabase, then reload." : friendly(t.error) });
    setRows((t.data as Tester[]) ?? []);
    const c = new Map<string, { ok: number; fix: number }>();
    for (const r of (f.data as Fix[]) ?? []) {
      const k = r.by_email ?? "";
      const v = c.get(k) ?? { ok: 0, fix: 0 };
      if (r.status === "fix") v.fix++; else v.ok++;
      c.set(k, v);
    }
    setCounts(c);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!sb) return;
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(email)) return setMsg({ ok: false, text: "Type a name and an email." });
    const { error } = await sb.from("app_testers").upsert({ email, name: form.name.trim(), phone: form.phone.trim() || null, focus: form.focus, note: form.note.trim() || null, active: true });
    if (error) return setMsg({ ok: false, text: friendly(error) });
    setMsg({ ok: true, text: `${form.name.trim()} is a tester now. Send them their links with Text or Email below.` });
    setForm({ name: "", email: "", phone: "", focus: form.focus, note: "" });
    void load();
  };
  const setActive = async (t: Tester, active: boolean) => {
    if (!sb) return;
    const { error } = await sb.from("app_testers").update({ active }).eq("email", t.email);
    if (error) return setMsg({ ok: false, text: friendly(error) });
    void load();
  };
  const remove = async (t: Tester) => {
    if (!sb || !window.confirm(`Remove ${t.name} as a tester? Their fixes stay.`)) return;
    const { error } = await sb.from("app_testers").delete().eq("email", t.email);
    if (error) return setMsg({ ok: false, text: friendly(error) });
    void load();
  };
  const copy = async (t: Tester) => {
    const m = invite(t);
    try { await navigator.clipboard.writeText(m.body); setCopied(t.email); setTimeout(() => setCopied(null), 2000); } catch { /* clipboard blocked */ }
  };

  const title = "Testers";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === false) return <Page title={title}><p className="hint">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <p className="hint">
        Add a tester, then send them their links by text or email. They sign in with that email, open the <a href="/check">check page</a>, make a test family
        with made-up information (sample student Emma) and go screen by screen. Spanish testers mark each line Correct or type a better one; fixes show in the app
        for everyone within seconds. Use a separate email for testing, not a real family account.
      </p>
      {msg && <p className={`note ${msg.ok ? "note-ok" : "note-err"}`}>{msg.text}</p>}

      <div className="panel">
        <h2>Add a tester</h2>
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" type="email" placeholder="Email they will sign in with" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" type="tel" placeholder="Cell phone (optional, for Text)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="input" value={form.focus} onChange={(e) => setForm({ ...form, focus: e.target.value as Tester["focus"] })}>
            <option value="spanish">Spanish check (message in Spanish)</option>
            <option value="app">General app test (message in English)</option>
          </select>
        </div>
        <input className="input" style={{ marginTop: 8 }} placeholder="Note for the team (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn btn-inline" style={{ marginTop: 10 }} onClick={() => void add()}>Add tester</button>
      </div>

      <div className="panel">
        <h2>{rows.length ? `${rows.length} tester${rows.length === 1 ? "" : "s"}` : "No testers yet"}</h2>
        {rows.map((t) => {
          const m = invite(t);
          const c = counts.get(t.email) ?? { ok: 0, fix: 0 };
          const phone = (t.phone ?? "").replace(/[^\d+]/g, "");
          return (
            <div key={t.email} style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
              <div>
                <b>{t.name}</b> <span className="pill">{FOCUS[t.focus]}</span> {!t.active && <span className="pill pill-late">paused</span>}
              </div>
              <div className="hint" style={{ margin: "2px 0 6px", fontSize: 14 }}>
                {t.email}{t.phone ? ` · ${t.phone}` : ""} · {t.last_seen ? `last on the check page ${new Date(t.last_seen).toLocaleString()}` : "hasn't opened the check page yet"}
                {t.focus === "spanish" && ` · ${c.ok + c.fix} lines checked, ${c.fix} changed`}
                {t.note ? ` · ${t.note}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="btn btn-inline btn-sm share-btn" href={`sms:${phone}?&body=${encodeURIComponent(m.body)}`}>💬 Text</a>
                <a className="btn btn-inline btn-sm share-btn" href={`mailto:${t.email}?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}`}>✉️ Email</a>
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void copy(t)}>{copied === t.email ? "Copied ✓" : "Copy message"}</button>
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void setActive(t, !t.active)}>{t.active ? "Pause" : "Turn back on"}</button>
                <button className="btn btn-ghost btn-inline btn-sm" onClick={() => void remove(t)}>Remove</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <h2>Links</h2>
        <p className="hint" style={{ margin: 0 }}>
          Check page: <a href="/check">{SITE}/check</a> · Sign in straight to it: <a href="/signin?next=/check">{SITE}/signin?next=/check</a>. The team can use the
          check page too.
        </p>
      </div>
    </Page>
  );
}
