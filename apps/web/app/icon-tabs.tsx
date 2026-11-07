"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "./icons";

export interface IconTab {
  key: string; icon: string; label: string; count?: number;
  /** The part of this page to show. Leave out (or null) when `href` points to another page. */
  body?: ReactNode;
  /** A nearby page shown as a tile in the same row (for example Compare colleges next to Find colleges). */
  href?: string;
}

/**
 * A row of icon tiles that shows one part of a long page at a time, so nobody has to scroll
 * far (Constant, 2026-11-07). Tabs with no body (null/false) are left out. The address keeps the
 * open tab (#key), so a link can open a part directly and Back works as expected.
 * A tab with `href` is a link to a nearby page, so related pages feel like one.
 */
export function IconTabs({ tabs, label, start }: { tabs: IconTab[]; label: string; start?: string }) {
  const shown = tabs.filter((t) => t.href || (t.body !== null && t.body !== false && t.body !== undefined));
  const [tab, setTab] = useState<string | null>(null);
  useEffect(() => {
    const fromHash = () => { let h = window.location.hash.slice(1); try { h = decodeURIComponent(h); } catch {} if (h) setTab(h); };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const parts = shown.filter((t) => !t.href);
  const current = parts.find((t) => t.key === tab) ?? parts.find((t) => t.key === start) ?? parts[0];
  const pick = (k: string) => { setTab(k); window.history.replaceState(null, "", `#${k}`); };
  return (
    <>
      {shown.length > 1 && (
        <nav className="icon-tabs" aria-label={label}>
          {shown.map((t, n) => t.href ? (
            <a key={t.key} className="icon-tabs-link" href={t.href} data-n={n % 5}>
              <Icon of={t.icon} className="icon-tabs-icon" />
              <span>{t.label}</span>
              {!!t.count && t.count > 0 && <span className="icon-tabs-count">{t.count}</span>}
            </a>
          ) : (
            <button key={t.key} type="button" aria-pressed={t === current} onClick={() => pick(t.key)} data-n={n % 5}>
              <Icon of={t.icon} className="icon-tabs-icon" />
              <span>{t.label}</span>
              {!!t.count && t.count > 0 && <span className="icon-tabs-count">{t.count}</span>}
            </button>
          ))}
        </nav>
      )}
      {current && <div className="icon-tabs-body">{current.body}</div>}
    </>
  );
}

/** A row of links to nearby pages, in the same tile style, for a page that has no parts of its own. */
export function PageTabs({ tabs, label, here }: { tabs: { href: string; icon: string; label: string }[]; label: string; here: string }) {
  return (
    <nav className="icon-tabs icon-tabs-pages" aria-label={label}>
      {tabs.map((t, n) => (
        <a key={t.href} className="icon-tabs-link" href={t.href} aria-current={t.href === here ? "page" : undefined} data-n={n % 5}>
          <Icon of={t.icon} className="icon-tabs-icon" />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}
