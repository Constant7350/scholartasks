"use client";

import { useEffect, useRef, useState } from "react";
import { currentLang } from "../lib/lang-client";
import { platform } from "../lib/share";

/**
 * Talk instead of type, anywhere a student writes to an AI helper.
 *
 * "Speak" uses the browser's own speech-to-text (free, no AI use). The words
 * go into the box so the student can read and fix them before sending.
 * ScholarTasks never records or keeps any sound: only the typed words reach us,
 * the same as typing.
 *
 * Inside the phone app the keyboard's own microphone is the voice button
 * (Apple and Google dictation), so "Speak" opens the keyboard and shows where to tap.
 */

interface Alt { transcript: string }
interface Result { isFinal: boolean; length: number; [i: number]: Alt }
interface ResultEvent { results: { length: number; [i: number]: Result } }
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: ResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognizerClass = new () => Recognizer;

const SPEECH = { es: { lang: "es-US" }, en: { lang: "en-US" } } as const;
const speechLang = () => SPEECH[currentLang() === "es" ? "es" : "en"].lang;

function recognizerClass(): RecognizerClass | null {
  if (typeof window === "undefined" || platform() !== "web") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerClass; webkitSpeechRecognition?: RecognizerClass };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Puts spoken words after what is already in the box. */
export function addSpoken(before: string, spoken: string): string {
  const words = spoken.replace(/\s+/g, " ").trim();
  if (!words) return before;
  const startOfSentence = !before.trim() || /[.!?]\s*$/.test(before);
  const text = startOfSentence ? words.charAt(0).toUpperCase() + words.slice(1) : words;
  const gap = before && !/\s$/.test(before) ? " " : "";
  return before + gap + text;
}

export function VoiceButton({ value, onText, max = 4000, disabled, small, chat }: {
  value: string;
  onText: (text: string) => void;
  /** The box's maxLength. */
  max?: number;
  disabled?: boolean;
  small?: boolean;
  /** In a chat's send row: shows only the microphone on small phones. */
  chat?: boolean;
}) {
  const [Rec, setRec] = useState<RecognizerClass | null>(null);
  const [listening, setListening] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const rec = useRef<Recognizer | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const send = useRef(onText);
  send.current = onText;
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => { setRec(() => recognizerClass()); }, []);
  useEffect(() => () => rec.current?.abort(), []);
  useEffect(() => { if (disabled) rec.current?.stop(); }, [disabled]);

  /** The text box this button belongs to: the nearest one before it (or else after it). */
  const box = () => {
    const me = btn.current;
    let el = me?.parentElement ?? null;
    while (me && el) {
      const all = [...el.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>("textarea:not([readonly]), input:not([type]):not([readonly]), input[type=text]:not([readonly])")];
      const before = all.filter((t) => t.compareDocumentPosition(me) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (all.length) return before[before.length - 1] ?? all[0]!;
      el = el.parentElement;
    }
    return null;
  };

  const start = () => {
    setTip(null);
    if (!Rec) {
      box()?.focus();
      const p = platform();
      setTip(p === "ios" ? "Tap the 🎤 microphone on your keyboard, then talk. Your words show up in the box."
        : p === "android" ? "Tap the 🎤 microphone on your keyboard, then talk. Your words show up in the box."
        : "This browser can't listen. Use the 🎤 on your phone's keyboard, or your computer's dictation (Windows: Windows key + H. Mac: press Fn twice).");
      return;
    }
    const r = new Rec();
    r.lang = speechLang();
    // Android Chrome repeats words in continuous mode, so there each tap takes one sentence.
    r.continuous = !/Android/i.test(navigator.userAgent);
    r.interimResults = true;
    const before = latest.current;
    r.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += ` ${e.results[i]?.[0]?.transcript ?? ""}`;
      send.current(addSpoken(before, spoken).slice(0, max));
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      setTip(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "To talk instead of type, allow the microphone for ScholarTasks in your browser, then tap Speak again."
        : e.error === "no-speech" ? "I didn't hear anything. Tap Speak and try again."
        : e.error === "network" ? "Voice typing needs the internet. Check your connection and try again."
        : "Voice typing stopped. Tap Speak to try again.");
    };
    r.onend = () => { rec.current = null; setListening(false); };
    rec.current = r;
    try { r.start(); setListening(true); } catch { rec.current = null; }
  };

  const stop = () => rec.current?.stop();

  return (
    <span className={`voice${chat ? " voice-chat" : ""}`}>
      <button
        ref={btn}
        type="button"
        className={`btn btn-ghost btn-inline voice-btn${small ? " btn-sm" : ""}${listening ? " voice-on" : ""}`}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : "Speak instead of typing"}
        title={listening ? "Stop listening" : "Speak instead of typing"}
        disabled={disabled && !listening}
        onClick={listening ? stop : start}
      >
        <span aria-hidden="true">{listening ? "■" : "🎤"}</span>
        <span className="voice-word">{listening ? "Stop" : "Speak"}</span>
      </button>
      {listening && <span className="voice-pop voice-live" role="status">Listening… talk now. Tap Stop when you're done.</span>}
      {tip && (
        <span className="voice-pop" role="status">
          {tip} <button type="button" className="linklike" onClick={() => setTip(null)}>OK</button>
        </span>
      )}
    </span>
  );
}

/**
 * "Read aloud" for an AI answer, using the device's own voice (free, nothing sent anywhere).
 */
export function ReadAloud({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => { setOk(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"); }, []);
  useEffect(() => () => { if (speaking) window.speechSynthesis.cancel(); }, [speaking]);
  if (!ok) return null;
  const toggle = () => {
    const s = window.speechSynthesis;
    if (speaking) { s.cancel(); setSpeaking(false); return; }
    s.cancel();
    // Short pieces: some browsers stop a long reading partway through.
    const parts = chunks(plain(text));
    if (!parts.length) return;
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = speechLang();
      u.onerror = () => setSpeaking(false);
      if (i === parts.length - 1) u.onend = () => setSpeaking(false);
      s.speak(u);
    });
    setSpeaking(true);
  };
  return (
    <button type="button" className="linkish read-aloud" aria-pressed={speaking} onClick={toggle}>
      {speaking ? "■ Stop reading" : "🔊 Read aloud"}
    </button>
  );
}

/** Drops Markdown marks and links so the voice reads only the words. */
export function plain(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>|]+/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Splits text into sentences of up to about 200 letters. */
export function chunks(s: string): string[] {
  const out: string[] = [];
  for (const sentence of s.match(/[^.!?]+[.!?]*\s*/g) ?? []) {
    const last = out[out.length - 1];
    if (last !== undefined && last.length + sentence.length <= 200) out[out.length - 1] = last + sentence;
    else out.push(sentence);
  }
  return out.map((x) => x.trim()).filter(Boolean);
}

/**
 * For homework and tutor boxes: turns off the phone keyboard's suggestion bar,
 * which can offer the answer itself (for example a unit conversion like
 * "1 mile = 1,609 meters") while the student types the question.
 */
export const NO_SUGGEST = { autoComplete: "off", autoCorrect: "off" } as const;

