"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { searchTopics, tipsFor, topicForPath, type Tip, type Topic } from "./content";

/**
 * Help balloons, shown only when someone asks for them.
 * The ? button in the top bar turns them on and off; the choice is remembered on this device.
 * Balloons attach to existing page elements by selector (see TIPS in content.ts), so pages need no changes.
 * The bar at the bottom also searches the whole manual (Constant, 2026-11-07: the manual should be
 * right there when ? is pressed), so an answer is one tap away without finding the Help page.
 */

const KEY = "st-help-balloons";
const EVENT = "st-help-change";

export function setHelpOn(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* private mode: just this page view */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
}

/** [on, set, ready]: ready is true once the remembered choice has been read on this device. */
export function useHelpOn(): [boolean, (on: boolean) => void, boolean] {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try { setOn(localStorage.getItem(KEY) === "1"); } catch { /* ignore */ }
    setReady(true);
    const fn = (e: Event) => setOn(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
  }, []);
  return [on, setHelpOn, ready];
}

export function HelpButton() {
  const [on, set] = useHelpOn();
  return (
    <button
      type="button"
      className={`help-toggle ${on ? "help-toggle-on" : ""}`}
      aria-pressed={on}
      aria-label={on ? "Turn off help balloons" : "Turn on help balloons"}
      title={on ? "Turn off help" : "Show help on this page"}
      onClick={(e) => { e.stopPropagation(); set(!on); }}
    >
      ?
    </button>
  );
}

interface Mark { tip: Tip; x: number; y: number }

function findAnchor(tip: Tip): Element | null {
  const want = tip.text?.toLowerCase();
  for (const el of Array.from(document.querySelectorAll(tip.sel))) {
    if (el.closest("[data-help-layer]")) continue;
    if (want && !(el.textContent ?? "").trim().toLowerCase().startsWith(want)) continue;
    return el;
  }
  return null;
}

function measure(path: string): Mark[] {
  const marks: Mark[] = [];
  const used = new Set<Element>();
  const maxX = document.documentElement.clientWidth + window.scrollX - 30;
  for (const tip of tipsFor(path)) {
    const el = findAnchor(tip);
    if (!el || used.has(el)) continue;
    if (el instanceof HTMLElement && el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue; // hidden
    // Measure the text itself, so the ? sits right after a heading instead of at the far edge of the card.
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = Array.from(range.getClientRects()).filter((x) => x.width > 0);
    // End of the last line of text, so wrapped headings get the ? after their last word.
    let r: DOMRect = lines.length ? lines.reduce((a, b) => (b.bottom > a.bottom + 2 || (Math.abs(b.bottom - a.bottom) <= 2 && b.right > a.right) ? b : a)) : range.getBoundingClientRect();
    if (!r.width && !r.height) r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    used.add(el);
    marks.push({
      tip,
      x: Math.min(r.right + window.scrollX + 6, maxX),
      y: r.top + window.scrollY + Math.min(r.height, 40) / 2 - 11,
    });
  }
  return marks;
}

export function HelpLayer() {
  const [on, set, ready] = useHelpOn();
  const path = usePathname() ?? "/";
  const [marks, setMarks] = useState<Mark[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [openTopic, setOpenTopic] = useState<string | null>(null);
  const last = useRef("");
  const frame = useRef(0);

  const update = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const next = measure(path);
      const sig = next.map((m) => `${m.tip.sel}|${m.tip.text}|${Math.round(m.x)}|${Math.round(m.y)}`).join(";");
      if (sig === last.current) return;
      last.current = sig;
      setMarks(next);
    });
  }, [path]);

  useEffect(() => {
    if (!on) { setMarks([]); setActive(null); last.current = ""; return; }
    update();
    document.body.classList.add("help-on");
    // Pages load their data after the first paint, so keep the marks in step with the page.
    const obs = new MutationObserver((list) => {
      if (list.every((m) => (m.target as Element).closest?.("[data-help-layer]"))) return;
      update();
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["open", "class", "style"] });
    window.addEventListener("resize", update);
    window.addEventListener("load", update);
    return () => { document.body.classList.remove("help-on"); obs.disconnect(); window.removeEventListener("resize", update); window.removeEventListener("load", update); cancelAnimationFrame(frame.current); };
  }, [on, update]);

  useEffect(() => { setActive(null); setQ(""); setOpenTopic(null); }, [path]);

  // Arriving on the Help page (from "Help manual", "More in the manual" or Enter in the search box)
  // turns the balloons off by itself: the manual is open, so the balloons and bottom bar only get in the way
  // (Constant, 2026-11-07). Pressing ? while already on the Help page still works.
  const helpPageSeen = useRef(false);
  useEffect(() => {
    if (path !== "/help") { helpPageSeen.current = false; return; }
    if (!ready || helpPageSeen.current) return;
    helpPageSeen.current = true;
    if (on) set(false);
  }, [path, on, ready, set]);

  useEffect(() => {
    if (active === null) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setActive(null); };
    const click = (e: MouseEvent) => { if (!(e.target as Element).closest?.(".help-balloon, .help-mark")) setActive(null); };
    document.addEventListener("keydown", key);
    document.addEventListener("click", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("click", click); };
  }, [active]);

  if (!on || typeof document === "undefined") return null;
  const pageTopic = topicForPath(path);
  const open = active === null ? null : marks[active];
  const vw = document.documentElement.clientWidth;
  const width = Math.min(300, vw - 32);

  return createPortal(
    <div data-help-layer="" className="help-layer no-print">
      {marks.map((m, i) => (
        <button
          key={`${m.tip.sel}|${m.tip.text ?? ""}`}
          type="button"
          className={`help-mark ${active === i ? "help-mark-on" : ""}`}
          style={{ left: m.x, top: m.y }}
          aria-label="What is this?"
          aria-expanded={active === i}
          onClick={() => setActive(active === i ? null : i)}
        >
          ?
        </button>
      ))}
      {open && (
        <div
          className="help-balloon"
          role="dialog"
          aria-label="Help"
          style={{ top: open.y + 30, left: Math.max(16 + window.scrollX, Math.min(open.x - width / 2 + 11, vw + window.scrollX - width - 16)), width }}
        >
          <p>{open.tip.body}</p>
          <div className="help-balloon-actions">
            {open.tip.topic && <a href={`/help#${open.tip.topic}`}>Read more</a>}
            <button type="button" className="linklike" onClick={() => setActive(null)}>Got it</button>
          </div>
        </div>
      )}
      <HelpBar q={q} setQ={(v) => { setQ(v); setOpenTopic(null); }} openTopic={openTopic} setOpenTopic={setOpenTopic} pageTopic={pageTopic} path={path} off={() => set(false)} />
    </div>,
    document.body,
  );
}

/** The bar at the bottom while help is on: a search box over the whole manual, with answers shown right there. */
function HelpBar({ q, setQ, openTopic, setOpenTopic, pageTopic, path, off }: {
  q: string; setQ: (v: string) => void; openTopic: string | null; setOpenTopic: (id: string | null) => void;
  pageTopic: Topic | undefined; path: string; off: () => void;
}) {
  const onHelpPage = path === "/help"; // the Help page has its own search box pinned at the top
  const searching = !onHelpPage && q.trim().length > 0;
  const results = searching ? searchTopics(q).slice(0, 5) : [];
  const shown = openTopic ? results.find((t) => t.id === openTopic) : undefined;
  return (
    <div className="help-bar" role="region" aria-label="Help">
      {searching && (
        <div className="help-bar-results">
          {!results.length && <p className="hint" style={{ margin: 0 }}>Nothing found. Try fewer or different words.</p>}
          {results.map((t) => (
            <div key={t.id} className={`help-bar-hit ${shown?.id === t.id ? "help-bar-hit-open" : ""}`}>
              <button type="button" className="help-bar-hit-head" aria-expanded={shown?.id === t.id} onClick={() => setOpenTopic(shown?.id === t.id ? null : t.id)}>
                <span><b>{t.title}</b><span className="hint" style={{ margin: 0, fontSize: 13 }}>{t.summary}</span></span>
                <span className="help-chev" aria-hidden="true">{shown?.id === t.id ? "–" : "+"}</span>
              </button>
              {shown?.id === t.id && (
                <div className="help-bar-hit-body">
                  {t.steps && <ol>{t.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>}
                  {t.body?.map((b, i) => <p key={i}>{b}</p>)}
                  <div className="help-bar-actions">
                    {t.href && t.href !== path && <a href={t.href}>Open this page</a>}
                    <a href={`/help#${t.id}`}>More in the manual</a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!onHelpPage && <form className="help-bar-search" onSubmit={(e) => { e.preventDefault(); if (searching) window.location.href = `/help?q=${encodeURIComponent(q.trim())}`; }}>
        <span className="help-dot" aria-hidden="true">?</span>
        <input
          className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search help, e.g. remove a student" aria-label="Search the help manual" autoComplete="off" enterKeyHint="search"
        />
      </form>}
      <div className="help-bar-row">
        <span>{searching ? "Answers from the manual." : onHelpPage ? <>Tap any <b className="help-dot">?</b> on the page, or search at the top.</> : <>Tap any <b className="help-dot">?</b> on the page, or ask above.</>}</span>
        <span className="help-bar-actions">
          {!onHelpPage && <a href={pageTopic ? `/help#${pageTopic.id}` : "/help"}>Help manual</a>}
          <button type="button" className="linklike" onClick={off}>Turn off help</button>
        </span>
      </div>
    </div>
  );
}
