"use client";

import { useEffect, useState, type ReactNode } from "react";

export interface IconTab { key: string; icon: string; label: string; count?: number; body: ReactNode }

/**
 * A row of icon buttons that shows one part of a long page at a time, so nobody has to scroll
 * far (Constant, 2026-11-07). Tabs with no body (null/false) are left out. The address keeps the
 * open tab (#key), so a link can open a part directly and Back works as expected.
 */
export function IconTabs({ tabs, label, start }: { tabs: IconTab[]; label: string; start?: string }) {
  const shown = tabs.filter((t) => t.body !== null && t.body !== false && t.body !== undefined);
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    const fromHash = () => { const h = decodeURIComponent(window.location.hash.slice(1)); if (h) setTab(h); };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const current = shown.find((t) => t.key === tab) ?? shown.find((t) => t.key === start) ?? shown[0];
  if (!current) return null;
  const pick = (k: string) => { setTab(k); window.history.replaceState(null, "", `#${k}`); };
  return (
    <>
      {shown.length > 1 && (
        <nav className="icon-tabs" aria-label={label}>
          {shown.map((t) => (
            <button key={t.key} type="button" aria-pressed={t === current} onClick={() => pick(t.key)}>
              <span className="icon-tabs-icon" aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
              {!!t.count && t.count > 0 && <span className="icon-tabs-count">{t.count}</span>}
            </button>
          ))}
        </nav>
      )}
      <div className="icon-tabs-body">{current.body}</div>
    </>
  );
}
