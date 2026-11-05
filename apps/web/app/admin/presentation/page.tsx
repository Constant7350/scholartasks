"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";
import deck from "./slides.json";

/**
 * Team-only presenter for the "ScholarTasks for Families and Schools" deck.
 * Everything here is made by presentation/build.mjs from the files in /presentation
 * (slide HTML, narration.json). Do not edit slides.json or public/presentation by hand:
 * change the slide or its narration, then run the build. See presentation/README.md.
 */
const SLIDES: { id: string; title: string }[] = deck.slides;
const file = (i: number, ext: "jpg" | "mp3") => `/presentation/slide-${SLIDES[i]?.id}.${ext}`;
const VIDEO = "/presentation/scholartasks-presentation.mp4";
const GAP_MS = 900; // pause between slides when the voice moves on by itself
const BAR_BTN = { color: "#FAF7F0", borderColor: "#5A7DB0", padding: "8px 12px" };

export default function PresentationPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voice, setVoice] = useState(true);
  const [full, setFull] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/admin/presentation");
      const r = await sb.rpc("is_app_admin");
      setAdmin(r.data === true);
    })();
  }, [sb]);

  const go = useCallback((n: number) => {
    if (timer.current) clearTimeout(timer.current);
    setI(Math.max(0, Math.min(SLIDES.length - 1, n)));
  }, []);

  // Play (or stop) this slide's narration whenever the slide or the play state changes.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.src = file(i, "mp3");
    if (playing && voice) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [i, playing, voice]);

  const ended = () => {
    if (!playing) return;
    if (i >= SLIDES.length - 1) return setPlaying(false);
    timer.current = setTimeout(() => setI((n) => n + 1), GAP_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(i + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(i - 1); }
      else if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(SLIDES.length - 1);
    };
    const onFull = () => setFull(document.fullscreenElement === stage.current);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", onFull); };
  }, [i, go]);

  // Preload the next slide picture so changes are instant.
  useEffect(() => { if (i + 1 < SLIDES.length) { const im = new Image(); im.src = file(i + 1, "jpg"); } }, [i]);

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.();
  };
  const startShow = () => { go(0); setVoice(true); setPlaying(true); if (!document.fullscreenElement) void stage.current?.requestFullscreen?.(); };

  const title = "Presentation for parents and schools";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        {SLIDES.length} slides with narration in the Max voice (about {deck.minutes} minutes). Press <b>Start the show</b> to play it full screen with the voice, or step through the slides yourself and talk over them.
      </p>
      <div className="share-row" style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
        <button className="btn btn-inline" onClick={startShow}>▶ Start the show</button>
        <a className="btn btn-ghost btn-inline" style={{ textDecoration: "none" }} href={VIDEO} download="ScholarTasks presentation.mp4">⬇ Download the video</a>
      </div>

      <div
        ref={stage}
        style={{ position: "relative", background: "#0b1a33", borderRadius: full ? 0 : 12, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", ...(full ? { width: "100vw", height: "100vh" } : {}) }}
      >
        <img
          src={file(i, "jpg")}
          alt={`Slide ${i + 1}: ${SLIDES[i]?.title}`}
          onClick={() => go(i + 1)}
          style={{ width: "100%", height: full ? "100%" : "auto", aspectRatio: "16 / 9", objectFit: "contain", display: "block", cursor: "pointer" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, background: "rgba(11,26,51,0.92)", color: "#FAF7F0", ...(full ? { position: "absolute", left: 0, right: 0, bottom: 0, opacity: 0.85 } : {}) }}>
          <button className="btn btn-ghost btn-inline" style={BAR_BTN} onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide">◀</button>
          <button className="btn btn-inline" onClick={() => setPlaying((p) => !p)} style={{ minWidth: 110 }}>{playing ? "⏸ Pause" : "▶ Play"}</button>
          <button className="btn btn-ghost btn-inline" style={BAR_BTN} onClick={() => go(i + 1)} disabled={i === SLIDES.length - 1} aria-label="Next slide">▶</button>
          <span style={{ flex: 1, fontSize: 14, textAlign: "center" }}>{i + 1} / {SLIDES.length} · {SLIDES[i]?.title}</span>
          <label style={{ fontSize: 14, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Voice
          </label>
          <button className="btn btn-ghost btn-inline" style={BAR_BTN} onClick={toggleFull}>{full ? "Exit full screen" : "⛶ Full screen"}</button>
        </div>
      </div>
      <audio ref={audio} onEnded={ended} preload="auto" />

      <p className="hint" style={{ marginTop: 8 }}>
        Keys: → next, ← back, space play or pause. Click the slide to go to the next one. With <b>Voice</b> off, Play does nothing and you move the slides yourself.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginTop: 16 }}>
        {SLIDES.map((s, n) => (
          <button
            key={s.id}
            onClick={() => go(n)}
            aria-label={`Go to slide ${n + 1}: ${s.title}`}
            style={{ padding: 0, border: n === i ? "3px solid #F2B33D" : "1px solid #d5dce6", borderRadius: 8, overflow: "hidden", background: "none", cursor: "pointer", textAlign: "left" }}
          >
            <img src={file(n, "jpg")} alt="" loading="lazy" style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", display: "block" }} />
            <span style={{ display: "block", fontSize: 12, padding: "4px 6px" }}>{n + 1}. {s.title}</span>
          </button>
        ))}
      </div>
    </Page>
  );
}
