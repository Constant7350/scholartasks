"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { compile, lookup, missingParts, type Dict } from "../../lib/i18n/core";
import { CHECK_COOKIE, CHECK_STEPS, type CheckScreen } from "../../lib/i18n/check";
import { LANG_COOKIE } from "../../lib/lang";
import { NotConfigured, Page } from "../ui";

// The Spanish check page for our bilingual testers. Written in Spanish on purpose.
// It walks the tester screen by screen, shows the lines on the screen in front of them,
// and saves each "Correcto" or "Cambiar" straight away; fixes show in the app for
// everyone within a few seconds. The list of lines comes from lines.json, which the
// extractor rebuilds whenever pages change, so new screens and lines appear here on their own.

interface Line { en: string; screens: string[] }
interface Fix { en: string; es: string; status: "ok" | "fix"; note: string | null; by_email: string | null; updated_at: string }
interface Me { tester: boolean; team?: boolean; email?: string; name?: string; sample_family?: string | null }
interface Live { path: string; title: string | null; lines: { en: string; es: string | null }[]; updated_at: string }

const cookieOn = (name: string, value: string) => typeof document !== "undefined" && document.cookie.split("; ").includes(`${name}=${value}`);
const setCookie = (name: string, value: string) => { document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`; };
const ago = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `hace ${s} s` : s < 3600 ? `hace ${Math.round(s / 60)} min` : new Date(iso).toLocaleString("es-US");
};
const routeMatches = (route: string, path: string) =>
  route === path || (route.includes(":") && new RegExp("^" + route.replace(/:[^/]+/g, "[^/]+") + "$").test(path));

export default function CheckPage() {
  const sb = supabase();
  const [me, setMe] = useState<Me | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [dict, setDict] = useState<Dict>({});
  const [fixes, setFixes] = useState<Map<string, Fix>>(new Map());
  const [live, setLive] = useState<Live | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [find, setFind] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [checkOn, setCheckOn] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadFixes = useCallback(async () => {
    if (!sb) return;
    const { data } = await sb.from("translation_fixes").select("en, es, status, note, by_email, updated_at");
    setFixes(new Map(((data as Fix[]) ?? []).map((f) => [f.en, f])));
  }, [sb]);

  useEffect(() => {
    setCheckOn(cookieOn(CHECK_COOKIE, "1") && cookieOn(LANG_COOKIE, "es"));
    if (!sb) return;
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/check");
      const r = await sb.rpc("tester_me");
      const m = (r.data as Me) ?? { tester: false };
      setMe(m);
      if (!m.tester) return;
      const [cat, es] = await Promise.all([import("../../lib/i18n/lines.json"), import("../../lib/i18n/es")]);
      setLines((cat.default as unknown as { lines: Line[] }).lines);
      setDict(es.ES);
      await loadFixes();
    })();
  }, [sb, loadFixes]);

  // "On your screen now": the tester's other device reports every few seconds.
  useEffect(() => {
    if (!sb || !me?.tester) return;
    let stop = false;
    const tick = async () => {
      if (document.hidden) return;
      const { data } = await sb.from("translation_live").select("path, title, lines, updated_at").maybeSingle();
      if (!stop) setLive((data as Live) ?? null);
    };
    void tick();
    const t = setInterval(() => { void tick(); void loadFixes(); }, 6000);
    return () => { stop = true; clearInterval(t); };
  }, [sb, me, loadFixes]);

  const compiled = useMemo(() => compile(dict), [dict]);
  const spanishOf = useCallback((en: string) => {
    const f = fixes.get(en);
    if (f?.status === "fix") return f.es;
    return dict[en] ?? lookup(compiled, en) ?? "";
  }, [fixes, dict, compiled]);

  const byScreen = useMemo(() => {
    const m = new Map<string, Line[]>();
    for (const l of lines) for (const s of l.screens) m.set(s, [...(m.get(s) ?? []), l]);
    return m;
  }, [lines]);

  // Screens the tour doesn't list yet (a page added after this list was written).
  const newScreens = useMemo(() => {
    const known = new Set(CHECK_STEPS.flatMap((s) => s.screens.map((x) => x.route)));
    return [...byScreen.keys()].filter((r) => !known.has(r)).sort().map((route): CheckScreen => ({ route, title: route }));
  }, [byScreen]);

  const done = (en: string) => fixes.has(en);
  const total = lines.length;
  const checked = lines.filter((l) => done(l.en)).length;
  const changed = [...fixes.values()].filter((f) => f.status === "fix").length;

  const save = useCallback(async (en: string, status: "ok" | "fix" | "clear", es?: string, note?: string) => {
    if (!sb) return false;
    const { error } = await sb.rpc("i18n_save", { p_en: en, p_status: status, p_es: es ?? null, p_note: note ?? null });
    if (error) { setMsg({ ok: false, text: friendly(error) }); return false; }
    // Show it right away, then refresh from the database.
    setFixes((old) => {
      const n = new Map(old);
      if (status === "clear") n.delete(en);
      else n.set(en, { en, es: status === "fix" ? (es ?? "").trim() : "", status, note: note ?? null, by_email: me?.email ?? null, updated_at: new Date().toISOString() });
      return n;
    });
    void loadFixes();
    return true;
  }, [sb, me, loadFixes]);

  const makeSample = async () => {
    if (!sb) return;
    if (me?.sample_family && !window.confirm("¿Volver a crear la familia de prueba? Se borra lo que cambiaste en ella y se empieza de nuevo.")) return;
    setBusy(true);
    const { error } = await sb.rpc("tester_make_sample_family");
    setBusy(false);
    if (error) return setMsg({ ok: false, text: error.message.includes("real family") ? "Esta cuenta ya tiene una familia real. Usa otro correo solo para las pruebas." : friendly(error) });
    setMsg({ ok: true, text: "Listo: la familia de prueba con Emma (grado 11, Georgia) tiene notas, universidades, fechas límite, actividades, un ensayo y becas guardadas." });
    setMe((m) => (m ? { ...m, sample_family: "yes" } : m));
  };

  const turnOnCheck = () => {
    setCookie(LANG_COOKIE, "es");
    setCookie(CHECK_COOKIE, "1");
    setCheckOn(true);
    void sb?.rpc("set_my_lang", { p_lang: "es" });
  };
  const turnOffCheck = () => { setCookie(CHECK_COOKIE, "0"); setCheckOn(false); };

  const title = "Revisión del español";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (!me) return <Page title={title}><p className="hint">Cargando…</p></Page>;
  if (!me.tester) {
    return (
      <Page title={title}>
        <p className="hint">Esta página es para las personas que revisan la aplicación. Si nuestro equipo te invitó, inicia sesión con el mismo correo al que te llegó la invitación.</p>
      </Page>
    );
  }

  const q = find.trim().toLowerCase();
  const found = q.length >= 3 ? lines.filter((l) => l.en.toLowerCase().includes(q) || spanishOf(l.en).toLowerCase().includes(q)).slice(0, 40) : [];
  const pct = total ? Math.round((checked / total) * 100) : 0;
  const steps = [...CHECK_STEPS, ...(newScreens.length ? [{ id: "new", title: "Pantallas nuevas", todo: "Estas pantallas se agregaron hace poco. Revísalas también.", screens: newScreens }] : [])];

  return (
    <Page title={title}>
      <div data-no-tr translate="no">
        <p className="hint">
          Hola{me.name ? `, ${me.name}` : ""}. Gracias por ayudarnos. Recorre la aplicación pantalla por pantalla y marca cada texto como <b>Correcto</b> o
          escribe uno mejor con <b>Cambiar</b>. Lo que cambies aparece en la aplicación para todos en unos segundos. Las palabras en inglés como FAFSA, HOPE o
          GAfutures son nombres oficiales y se quedan así.
        </p>
        {msg && <p className={`note ${msg.ok ? "note-ok" : "note-err"}`}>{msg.text}</p>}

        <div className="panel">
          <h2>{checked} de {total} textos revisados ({pct}%)</h2>
          <div style={{ height: 10, background: "var(--warm-tint)", borderRadius: 999, overflow: "hidden", margin: "6px 0 10px" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--ok)" }} />
          </div>
          <p className="hint" style={{ margin: 0 }}>{changed} cambiados · {checked - changed} marcados como correctos</p>
        </div>

        <div className="panel">
          <h2>Antes de empezar</h2>
          <ol style={{ paddingLeft: 20, margin: "0 0 10px" }}>
            <li style={{ marginBottom: 10 }}>
              <b>Familia de prueba.</b> Llena tu cuenta con una familia de ejemplo (Emma, grado 11, Georgia) para que todas las pantallas tengan algo que mostrar. Todo es inventado.
              <div style={{ marginTop: 6 }}>
                <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void makeSample()}>
                  {busy ? "Creando…" : me.sample_family ? "Volver a crear la familia de prueba" : "Crear mi familia de prueba"}
                </button>
              </div>
            </li>
            <li style={{ marginBottom: 10 }}>
              <b>Modo de revisión.</b> En el teléfono o la computadora donde vas a recorrer la aplicación, abre esta página y toca el botón. Así la aplicación queda en
              español y esta página ve lo que tienes en pantalla.
              <div style={{ marginTop: 6 }}>
                {checkOn ? (
                  <><span className="pill pill-ok">Activado en este dispositivo</span> <button className="btn btn-ghost btn-inline btn-sm" onClick={turnOffCheck}>Apagar</button></>
                ) : (
                  <button className="btn btn-inline btn-sm" onClick={turnOnCheck}>Activar el modo de revisión aquí</button>
                )}
              </div>
            </li>
            <li>
              <b>Recorre los pasos de abajo.</b> Abre cada pantalla (se abre en otra pestaña), mírala completa y vuelve aquí. Puedes trabajar en dos dispositivos:
              la aplicación en el teléfono y esta página en la computadora.
            </li>
          </ol>
        </div>

        <div className="panel">
          <h2>📱 En tu pantalla ahora</h2>
          {!live ? (
            <p className="hint">Todavía nada. Activa el modo de revisión en el dispositivo donde recorres la aplicación y abre cualquier pantalla.</p>
          ) : (
            <>
              <p className="hint">
                <b>{live.path}</b>{live.title ? ` · ${live.title}` : ""} · {ago(live.updated_at)} · {live.lines.length} textos
              </p>
              {live.lines.length === 0 && <p className="hint">Esta pantalla no tiene textos de la lista.</p>}
              {live.lines.map((l) => <LineCard key={"live" + l.en} en={l.en} es={spanishOf(l.en)} fix={fixes.get(l.en)} onSave={save} />)}
            </>
          )}
        </div>

        <div className="panel">
          <h2>Buscar un texto</h2>
          <input className="input" placeholder="Escribe al menos 3 letras, en inglés o en español" value={find} onChange={(e) => setFind(e.target.value)} />
          {q.length >= 3 && found.length === 0 && <p className="hint" style={{ marginTop: 8 }}>No se encontró nada.</p>}
          {found.map((l) => <LineCard key={"find" + l.en} en={l.en} es={spanishOf(l.en)} fix={fixes.get(l.en)} onSave={save} where={l.screens.join(", ")} />)}
        </div>

        <label className="hint" style={{ display: "block", margin: "8px 0" }}>
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> Mostrar solo los textos sin revisar
        </label>

        {steps.map((step) => {
          const stepLines = [...new Set(step.screens.flatMap((s) => (byScreen.get(s.route) ?? []).map((l) => l.en)))];
          const stepDone = stepLines.filter(done).length;
          return (
            <div key={step.id} className="panel">
              <h2>{step.title}</h2>
              <p className="hint">{step.todo} <b>{stepDone} de {stepLines.length} revisados.</b></p>
              {step.screens.map((s) => {
                const sl = byScreen.get(s.route) ?? [];
                if (!sl.length) return null;
                const sd = sl.filter((l) => done(l.en)).length;
                const isOpen = open === s.route;
                const shown = onlyOpen ? sl.filter((l) => !done(l.en)) : sl;
                const href = s.open ?? (s.route.startsWith("/") ? s.route : null);
                const onNow = live && routeMatches(s.route, live.path);
                return (
                  <div key={s.route} style={{ borderTop: "1px solid var(--line)", padding: "10px 0" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setOpen(isOpen ? null : s.route)} aria-expanded={isOpen}>
                        {isOpen ? "▾" : "▸"} {s.title}
                      </button>
                      <span className={`pill ${sd === sl.length ? "pill-ok" : ""}`}>{sd} de {sl.length}</span>
                      {onNow && <span className="pill pill-soon">en tu pantalla</span>}
                      {href && <a href={href} target="_blank" rel="noreferrer" className="hint" style={{ margin: 0 }}>Abrir la pantalla ↗</a>}
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 8 }}>
                        {s.how && <p className="hint">{s.how}</p>}
                        {shown.length === 0 && <p className="hint">✓ Todo revisado en esta pantalla.</p>}
                        {shown.slice(0, 300).map((l) => <LineCard key={s.route + l.en} en={l.en} es={spanishOf(l.en)} fix={fixes.get(l.en)} onSave={save} />)}
                        {shown.length > 300 && <p className="hint">Se muestran los primeros 300. Marca estos y aparecerán más.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <p className="hint">¿Algo que no es un texto, como un botón que no funciona? Escribe a <a href="mailto:support@scholartasks.com">support@scholartasks.com</a>.</p>
      </div>
    </Page>
  );
}

function LineCard({ en, es, fix, onSave, where }: { en: string; es: string; fix?: Fix; onSave: (en: string, s: "ok" | "fix" | "clear", es?: string, note?: string) => Promise<boolean>; where?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(es);
  const [note, setNote] = useState(fix?.note ?? "");
  const [saving, setSaving] = useState(false);
  const missing = editing ? missingParts(en, text) : [];
  const status = fix?.status === "fix" ? <span className="pill pill-soon">cambiado</span> : fix?.status === "ok" ? <span className="pill pill-ok">correcto</span> : null;
  const run = async (s: "ok" | "fix" | "clear") => {
    setSaving(true);
    const ok = await onSave(en, s, s === "fix" ? text : undefined, s === "fix" ? note : undefined);
    setSaving(false);
    if (ok) setEditing(false);
  };
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 10, margin: "8px 0", background: fix ? "transparent" : "var(--card)" }}>
      <div className="hint" style={{ margin: "0 0 4px", fontSize: 13 }}>Inglés{where ? ` · ${where}` : ""} {status}</div>
      <div style={{ marginBottom: 6 }}>{en}</div>
      {!editing ? (
        <>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{es || <span className="hint">(sin traducción: se muestra en inglés)</span>}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-inline btn-sm" disabled={saving} onClick={() => void run("ok")}>✓ Correcto</button>
            <button className="btn btn-ghost btn-inline btn-sm" onClick={() => { setText(es); setEditing(true); }}>✎ Cambiar</button>
            {fix && <button className="btn btn-ghost btn-inline btn-sm" disabled={saving} onClick={() => void run("clear")}>Deshacer</button>}
          </div>
        </>
      ) : (
        <>
          <textarea className="input" rows={Math.min(8, 2 + Math.floor(text.length / 70))} value={text} onChange={(e) => setText(e.target.value)} />
          {missing.length > 0 && (
            <p className="note note-err" style={{ margin: "6px 0" }}>
              Falta {missing.join(" ")}. Las partes entre {"{ }"} se llenan solas (un nombre, un número) y {"<1> </1>"} marca un enlace o negrita: déjalas en tu texto.
            </p>
          )}
          <input className="input" style={{ marginTop: 6 }} placeholder="Nota para el equipo (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn btn-inline btn-sm" disabled={saving || !text.trim()} onClick={() => void run("fix")}>Guardar</button>
            <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setEditing(false)}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}
