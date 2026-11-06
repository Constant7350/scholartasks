"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { compile, lookup, lookupKeepSpace, splitTags, type Compiled, type Dict } from "../lib/i18n/core";
import { currentLang } from "../lib/lang-client";
import { CHECK_COOKIE } from "../lib/i18n/check";
import { supabase } from "../lib/supabase";

/**
 * Shows every page in Spanish when the family picks Español.
 *
 * Pages are written in English. This reads what is on the screen and swaps
 * each line for its Spanish from the word list (lib/i18n/es/*.json), plus any
 * fix our review team made on the check page (/check), which shows right away.
 * Whole sentences are matched with their links and bold words, so the Spanish
 * can use its own word order. Things people type, and AI answers (already in
 * Spanish), are left alone.
 *
 * A reviewer signed in to the check page also sends the lines on their screen
 * there, so the check page can follow them screen by screen.
 */

const INLINE = new Set(["A", "B", "STRONG", "EM", "I", "SPAN", "SMALL", "U", "MARK", "ABBR", "TIME", "SUP", "SUB", "KBD", "Q", "CITE"]);
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT", "TEMPLATE", "svg", "SVG", "IFRAME", "VIDEO", "AUDIO", "CANVAS"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const NO_TR = '[translate="no"],[data-no-tr],[contenteditable="true"],[contenteditable=""]';

interface Seen { en: string; es: string | null }

type Fn = (s: string) => string | null;

class PageTranslator {
  private c: Compiled;
  private text = new WeakMap<Text, { en: string; es: string }>();
  private attrs = new WeakMap<Element, Map<string, { en: string; es: string }>>();
  private obs: MutationObserver;
  /** Lines translated or missed on this screen, for the check page. */
  seen = new Map<string, Seen>();
  onSeen: (() => void) | null = null;

  constructor(dict: Dict) {
    this.c = compile(dict);
    this.obs = new MutationObserver((list) => this.mutated(list));
  }

  setDict(dict: Dict) {
    this.c = compile(dict);
    this.run(document.documentElement);
  }

  t: Fn = (s) => lookup(this.c, s);

  start() {
    this.run(document.documentElement);
    this.obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  stop() { this.obs.disconnect(); }

  private run(el: Element) {
    if (!el.isConnected) return;
    if (el.closest(NO_TR)) return;
    this.el(el);
    this.obs.takeRecords(); // our own changes
  }

  private mutated(list: MutationRecord[]) {
    const todo = new Set<Element>();
    for (const m of list) {
      if (m.type === "attributes") {
        const el = m.target as Element;
        if (!el.closest(NO_TR)) this.attr(el, m.attributeName!);
        continue;
      }
      let el = m.type === "characterData" ? (m.target as Text).parentElement : (m.target as Element);
      if (!el) continue;
      // A change inside a link or bold word: look at the whole sentence.
      if (INLINE.has(el.tagName) && el.parentElement) el = el.parentElement;
      todo.add(el);
    }
    for (const el of todo) {
      let covered = false;
      for (let p = el.parentElement; p; p = p.parentElement) if (todo.has(p)) { covered = true; break; }
      if (!covered) this.run(el);
    }
    this.obs.takeRecords();
  }

  /** The English of a text node, even after it has been put into Spanish. */
  private src(n: Text): string {
    const r = this.text.get(n);
    const v = n.nodeValue ?? "";
    if (r && v === r.es) return r.en;
    return v;
  }

  private put(n: Text, en: string, es: string) {
    this.text.set(n, { en, es });
    if (n.nodeValue !== es) n.nodeValue = es;
  }

  private note(en: string, es: string | null) {
    const k = en.replace(/\s+/g, " ").trim();
    if (!k || !/[A-Za-z]{2,}/.test(k) || k.length > 700) return;
    const was = this.seen.get(k);
    if (was && was.es === es) return;
    this.seen.set(k, { en: k, es });
    this.onSeen?.();
  }

  private attr(el: Element, name: string) {
    const v = el.getAttribute(name);
    if (v === null) return;
    let map = this.attrs.get(el);
    const r = map?.get(name);
    const en = r && v === r.es ? r.en : v;
    const es = lookup(this.c, en);
    this.note(en, es);
    if (es === null) return;
    if (!map) this.attrs.set(el, (map = new Map()));
    map.set(name, { en, es });
    if (v !== es) el.setAttribute(name, es);
  }

  private el(el: Element) {
    if (SKIP.has(el.tagName)) return;
    if (el.hasAttribute("translate") && el.getAttribute("translate") === "no") return;
    if (el.hasAttribute("data-no-tr") || (el as HTMLElement).isContentEditable) return;
    for (const a of ATTRS) if (el.hasAttribute(a)) this.attr(el, a);
    if (el.tagName === "INPUT") {
      const i = el as HTMLInputElement;
      if ((i.type === "submit" || i.type === "button") && i.value) {
        const es = lookup(this.c, i.value);
        if (es) i.value = es;
      }
      return;
    }
    if (this.sentence(el)) return;
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === 3) this.one(n as Text);
      else if (n.nodeType === 1) this.el(n as Element);
    }
  }

  private one(n: Text) {
    const en = this.src(n);
    if (!/[A-Za-z]/.test(en)) return;
    const es = lookupKeepSpace(this.c, en);
    this.note(en, es === null ? null : es.trim());
    if (es !== null) this.put(n, en, es);
    else if (this.text.has(n)) this.put(n, en, en); // the list lost this line: back to English
  }

  /** A whole sentence: text, links and bold words together. True when done. */
  private sentence(el: Element): boolean {
    const kids = Array.from(el.childNodes).filter((n) => n.nodeType === 3 || n.nodeType === 1);
    if (kids.length < 2) return false;
    const inl: Element[] = [];
    for (const k of kids) {
      if (k.nodeType === 3) continue;
      const e = k as Element;
      if (!INLINE.has(e.tagName) || e.matches(NO_TR)) return false;
      if (!Array.from(e.childNodes).every((c) => c.nodeType === 3 || c.nodeType === 8)) return false;
      inl.push(e);
    }
    // The English as the word list writes it.
    let sig = "";
    let words = false;
    for (const k of kids) {
      if (k.nodeType === 3) {
        const s = this.src(k as Text);
        if (/[A-Za-z]{2,}/.test(s)) words = true;
        sig += s;
      } else {
        const e = k as Element;
        const inner = Array.from(e.childNodes).filter((c) => c.nodeType === 3).map((c) => this.src(c as Text)).join("");
        sig += `<${inl.indexOf(e) + 1}>${inner}</${inl.indexOf(e) + 1}>`;
      }
    }
    if (!words) return false;
    const es = lookup(this.c, sig);
    if (es === null) return false;
    const parts = splitTags(es);
    const order = parts.filter((p) => "tag" in p).map((p) => (p as { tag: number }).tag);
    if (order.length !== inl.length || order.some((t, i) => t !== i + 1)) return false;
    this.note(sig, es);

    // Text between the tags goes into the text nodes at the same place.
    const between: string[] = [""];
    for (const p of parts) {
      if ("tag" in p) between.push("");
      else between[between.length - 1] += p.text;
    }
    const inner = parts.filter((p) => "tag" in p).map((p) => p.text);
    let seg = 0;
    const segNodes: Text[][] = [[]];
    for (const k of kids) {
      if (k.nodeType === 3) segNodes[seg]!.push(k as Text);
      else { seg++; segNodes.push([]); }
    }
    segNodes.forEach((nodes, i) => {
      const want = between[i] ?? "";
      if (!nodes.length) {
        if (!want) return;
        const t = document.createTextNode(want);
        const before = i < inl.length ? inl[i]! : null;
        el.insertBefore(t, before);
        this.text.set(t, { en: "", es: want });
        return;
      }
      nodes.forEach((n, j) => this.put(n, this.src(n), j === 0 ? want : ""));
    });
    inl.forEach((e, i) => {
      const texts = Array.from(e.childNodes).filter((c) => c.nodeType === 3) as Text[];
      texts.forEach((n, j) => this.put(n, this.src(n), j === 0 ? inner[i] ?? "" : ""));
      for (const a of ATTRS) if (e.hasAttribute(a)) this.attr(e, a);
    });
    return true;
  }
}

let shared: PageTranslator | null = null;

/** Spanish for a line from code (pop-ups and the like), or the English. */
export function trEs(s: string): string {
  return shared?.t(s) ?? s;
}

async function loadDict(): Promise<Dict> {
  const base = (await import("../lib/i18n/es")).ES;
  return base;
}

/** Lines our reviewers fixed on the check page. They win over the built-in word list. */
async function loadFixes(): Promise<Dict> {
  try {
    const sb = supabase();
    if (!sb) return {};
    const { data } = await sb.rpc("i18n_fixes");
    const out: Dict = {};
    for (const r of (data as { en: string; es: string }[] | null) ?? []) out[r.en] = r.es;
    return out;
  } catch {
    return {};
  }
}

const reviewing = () => typeof document !== "undefined" && document.cookie.includes(`${CHECK_COOKIE}=1`);

export function Translator() {
  const path = usePathname();

  // Keep the account's language in step with this device, once per visit, so reminder
  // emails and texts come in the language the person reads the app in.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("st-lang-synced")) return;
      const sb = supabase();
      if (!sb) return;
      void sb.auth.getSession().then(async ({ data }) => {
        if (!data.session) return;
        const { error } = await sb.rpc("set_my_lang", { p_lang: currentLang() });
        if (!error) sessionStorage.setItem("st-lang-synced", "1");
      });
    } catch { /* private window: skip */ }
  }, [path]);

  useEffect(() => {
    if (currentLang() !== "es") return;
    let live = true;
    const show = () => document.documentElement.classList.remove("tr-wait");
    (async () => {
      try {
        const base = await loadDict();
        if (!live) return;
        const t = new PageTranslator(base);
        shared = t;
        t.start();
        show();
        // Pop-ups from code.
        const ask = window.confirm.bind(window);
        const tell = window.alert.bind(window);
        const q = window.prompt.bind(window);
        window.confirm = (m?: string) => ask(m ? trEs(m) : m);
        window.alert = (m?: string) => tell(m ? trEs(String(m)) : m);
        window.prompt = (m?: string, d?: string) => q(m ? trEs(m) : m, d);
        // Our review team's fixes.
        const fixes = await loadFixes();
        if (live && Object.keys(fixes).length) t.setDict({ ...base, ...fixes });
        if (reviewing()) startLiveReport(t, base);
      } catch {
        show();
      }
    })();
    return () => { live = false; };
  }, []);

  // New screen: start a new list of lines for the check page.
  useEffect(() => {
    if (shared) { shared.seen.clear(); shared.onSeen?.(); }
  }, [path]);

  return null;
}

/** Sends the lines on a reviewer's screen to the check page, a few seconds after they change. */
function startLiveReport(t: PageTranslator, base: Dict) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastFixes = "";
  const send = async () => {
    timer = null;
    const lines = [...t.seen.values()].slice(0, 400);
    try {
      const sb = supabase();
      if (!sb) return;
      await sb.rpc("i18n_live_report", { p_path: location.pathname, p_title: document.title, p_lines: lines });
      // Fixes saved on the check page show on this screen right away.
      const fixes = await loadFixes();
      const key = JSON.stringify(fixes);
      if (key !== lastFixes) { lastFixes = key; t.setDict({ ...base, ...fixes }); }
    } catch { /* try again on the next change */ }
  };
  t.onSeen = () => { if (!timer) timer = setTimeout(send, 2500); };
  t.onSeen();
  setInterval(() => { if (!document.hidden && !timer) timer = setTimeout(send, 100); }, 8000);
}
