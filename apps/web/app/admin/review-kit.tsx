"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { LESSONS } from "../study/lessons";

/**
 * Shared pieces for the team review pages, so every page works the same way:
 * - each item shows whether it was already reviewed (and when),
 * - pressing Approve or Save shows "✓ Saved" right on that item (with Undo)
 *   instead of the item vanishing,
 * - "One at a time" shows a single item with buttons that move to the next,
 * - "Approve all" handles everything left in two taps.
 */

export type Mode = "list" | "one";

export interface Done { label: string; at: Date; ok: boolean }

export const timeOf = (d: Date | string) => new Date(d).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const whenOf = (d: Date | string) => {
  const x = new Date(d);
  return x.toDateString() === new Date().toDateString() ? `today at ${timeOf(x)}` : x.toLocaleDateString();
};

/** Status badge: green for approved/verified, gold for waiting, grey otherwise. */
export function StatusPill({ status, label }: { status: "ok" | "wait" | "off"; label: string }) {
  return <span className={`pill ${status === "ok" ? "pill-ok" : status === "wait" ? "pill-soon" : ""}`}>{label}</span>;
}

/** A reviewed item, folded to one line so it's clear it was saved. */
export function DoneRow({ title, done, onUndo }: { title: string; done: Done; onUndo?: () => void }) {
  return (
    <section className={`panel review-done ${done.ok ? "" : "review-done-off"}`} role="status">
      <span><b>{done.ok ? "✓" : "✕"} {done.label}</b> · saved {timeOf(done.at)}</span>
      <span className="review-done-title">{title}</span>
      {onUndo && <button className="btn btn-ghost btn-inline btn-sm" onClick={onUndo}>Undo</button>}
    </section>
  );
}

/** Progress, the list / one-at-a-time switch, and "Approve all" (two taps). */
export function ReviewBar({
  left, doneCount, mode, setMode, allLabel, allNote, onAll,
}: {
  left: number; doneCount: number; mode: Mode; setMode: (m: Mode) => void;
  allLabel?: (n: number) => string; allNote?: string; onAll?: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel review-bar">
      <div className="review-bar-row">
        <span>
          <b>{left === 0 ? "All done here" : `${left} left to review`}</b>
          {doneCount > 0 && <span className="hint"> · {doneCount} saved this visit</span>}
        </span>
        <div className="tabs review-mode" role="tablist" aria-label="How to review">
          <button role="tab" aria-selected={mode === "one"} onClick={() => setMode("one")}>One at a time</button>
          <button role="tab" aria-selected={mode === "list"} onClick={() => setMode("list")}>Show all</button>
        </div>
      </div>
      {onAll && allLabel && left > 1 && (
        <div className="review-bar-row">
          <button
            className="btn btn-inline"
            disabled={busy}
            onClick={async () => {
              if (!confirm) return setConfirm(true);
              setConfirm(false); setBusy(true);
              try { await onAll(); } finally { setBusy(false); }
            }}
          >
            {busy ? "Saving…" : confirm ? `Tap again to ${allLabel(left).toLowerCase()}` : allLabel(left)}
          </button>
          {confirm && <button className="btn btn-ghost btn-inline" onClick={() => setConfirm(false)}>Cancel</button>}
          {allNote && <span className="hint" style={{ fontSize: 13 }}>{allNote}</span>}
        </div>
      )}
    </div>
  );
}

/** Shown in one-at-a-time mode above the single item. */
export function OneHeader({ index, total, onSkip }: { index: number; total: number; onSkip?: () => void }) {
  return (
    <div className="review-one-head">
      <span className="hint">Item {index} of {total} left</span>
      {onSkip && total > 1 && <button className="btn btn-ghost btn-inline btn-sm" onClick={onSkip}>Skip for now →</button>}
    </div>
  );
}

/** Splits ids into chunks so a bulk update stays a reasonable size. */
export function chunks<T>(list: T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** The chosen mode (one at a time by default), remembered on this device. */
export function useMode(page: string): [Mode, (m: Mode) => void] {
  const [mode, setModeState] = useState<Mode>("one");
  useEffect(() => {
    try { const m = localStorage.getItem(`st-review-${page}`); if (m === "list" || m === "one") setModeState(m); } catch { /* private mode */ }
  }, [page]);
  const setMode = (m: Mode) => {
    setModeState(m);
    try { localStorage.setItem(`st-review-${page}`, m); } catch { /* private mode */ }
  };
  return [mode, setMode];
}

const REVIEWS = [
  ["/admin/answers", "Counselor answers"],
  ["/admin/questions", "Practice questions"],
  ["/admin/lessons", "Study lessons"],
  ["/admin/scholarships", "Scholarships"],
  ["/admin/trades", "Trade facts"],
] as const;

/** Tabs at the top of every review page, with how many wait in each, so you can switch without the main menu. */
export function ReviewNav() {
  const path = usePathname();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  useEffect(() => {
    const sb = supabase();
    if (!sb) return;
    const n = (r: { count: number | null; error: unknown }) => (r.error ? null : r.count);
    void Promise.all([
      sb.from("answer_bank").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("practice_questions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("lesson_reviews").select("lesson_id", { count: "exact", head: true }),
      sb.from("scholarship_updates").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("scholarships").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("trade_checks").select("subject", { count: "exact", head: true }).eq("status", "review"),
    ]).then(([a, q, l, su, sp, t]) => {
      const lessons = n(l);
      const sch = n(su) == null || n(sp) == null ? null : n(su)! + n(sp)!;
      setCounts({
        "/admin/answers": n(a), "/admin/questions": n(q),
        "/admin/lessons": lessons == null ? null : Math.max(0, LESSONS.length - lessons),
        "/admin/scholarships": sch, "/admin/trades": n(t),
      });
    });
  }, [path]);
  return (
    <nav className="review-nav" aria-label="Review pages">
      {REVIEWS.map(([href, label]) => (
        <a key={href} href={href} aria-current={path === href ? "page" : undefined}>
          {label}{counts[href] ? <span className="sch-count">{counts[href]}</span> : counts[href] === 0 ? <span aria-label="nothing waiting"> ✓</span> : null}
        </a>
      ))}
    </nav>
  );
}
