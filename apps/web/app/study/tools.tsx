"use client";

import { useEffect, useRef, useState } from "react";

const fmt = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Picks review days before a test: growing gaps, the last one the day before. */
export function reviewDays(today: Date, test: Date): Date[] {
  const days = Math.round((test.getTime() - today.getTime()) / 864e5);
  if (days < 1) return [];
  const offsets = [days - 1, Math.round(days * 0.6), Math.round(days * 0.3), 0].filter((o, i, a) => o >= 0 && o < days && a.indexOf(o) === i);
  return offsets.sort((a, b) => a - b).map((o) => new Date(today.getTime() + o * 864e5));
}

export function SpacingPlanner() {
  const [date, setDate] = useState("");
  const today = new Date(); today.setHours(12, 0, 0, 0);
  const test = date ? new Date(date + "T12:00:00") : null;
  const plan = test ? reviewDays(today, test) : [];
  return (
    <div className="tool">
      <b>Review planner</b>
      <div className="field" style={{ maxWidth: 220, marginTop: 8 }}><label htmlFor="sp-date">When is the test?</label>
        <input id="sp-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      {test && plan.length === 0 && <p className="hint">Pick a date after today.</p>}
      {plan.length > 0 && (
        <ol className="tool-list">
          {plan.map((d, i) => (
            <li key={d.toISOString()}><b>{fmt(d)}</b> · {i === 0 ? "Learn it and test yourself once" : i === plan.length - 1 ? "Final practice test, then sleep" : "20-30 min: quiz yourself, fix mistakes"}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function FocusTimer() {
  const [mode, setMode] = useState<"focus" | "break">("focus");
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [blocks, setBlocks] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    tick.current = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);
  useEffect(() => {
    if (left > 0) return;
    setRunning(false);
    if (mode === "focus") { setBlocks((b) => b + 1); setMode("break"); setLeft(5 * 60); }
    else { setMode("focus"); setLeft(25 * 60); }
  }, [left, mode]);

  const reset = () => { setRunning(false); setMode("focus"); setLeft(25 * 60); };
  return (
    <div className="tool tool-timer">
      <b>{mode === "focus" ? "Focus block" : "Break time: stand up and stretch"}</b>
      <span className="timer-num" aria-live="polite">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-inline" onClick={() => setRunning(!running)}>{running ? "Pause" : "Start"}</button>
        <button className="btn btn-ghost btn-inline" onClick={reset}>Reset</button>
      </div>
      <span className="hint" style={{ margin: 0 }}>{blocks} {blocks === 1 ? "block" : "blocks"} done this session. Phone in another room!</span>
    </div>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
interface Item { text: string; day: string; done: boolean }

export function WeekPlanner() {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState("");
  const [day, setDay] = useState("Mon");
  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem("st-week-plan") ?? "[]") as Item[]); } catch { /* private mode */ } }, []);
  const save = (l: Item[]) => { setItems(l); try { localStorage.setItem("st-week-plan", JSON.stringify(l)); } catch { /* private mode */ } };
  return (
    <div className="tool">
      <b>This week&apos;s plan</b> <span className="hint" style={{ fontSize: 12 }}>(saved on this device)</span>
      <form className="row" style={{ alignItems: "end", marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); if (text.trim()) { save([...items, { text: text.trim().slice(0, 100), day, done: false }]); setText(""); } }}>
        <div className="field"><label htmlFor="wp-text">What to do</label><input id="wp-text" className="input" value={text} placeholder="Study for biology quiz" onChange={(e) => setText(e.target.value)} /></div>
        <div className="field" style={{ flex: "0 1 110px" }}><label htmlFor="wp-day">Day</label>
          <select id="wp-day" className="input" value={day} onChange={(e) => setDay(e.target.value)}>{DAYS.map((d) => <option key={d}>{d}</option>)}</select></div>
        <button className="btn btn-inline" disabled={!text.trim()}>Add</button>
      </form>
      {DAYS.filter((d) => items.some((i) => i.day === d)).map((d) => (
        <div key={d} style={{ marginTop: 8 }}>
          <span className="eyebrow">{d}</span>
          {items.map((it, i) => it.day === d && (
            <label key={i} className="tool-item">
              <input type="checkbox" checked={it.done} onChange={() => save(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
              <span style={{ textDecoration: it.done ? "line-through" : "none" }}>{it.text}</span>
              <button type="button" className="linklike" onClick={() => save(items.filter((_, j) => j !== i))}>remove</button>
            </label>
          ))}
        </div>
      ))}
      {items.length > 0 && <button className="linklike" style={{ marginTop: 8 }} onClick={() => save([])}>Start a new week</button>}
    </div>
  );
}
