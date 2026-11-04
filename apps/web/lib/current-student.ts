"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";

/**
 * Which student a parent is looking at, shared by every page and the top bar.
 * The choice is kept on this device, so moving from Grades to Scholarships stays on the same student.
 * A ?student= link wins over the saved choice.
 */

const KEY = "st-student";
const EVENT = "st-student-change";

export function rememberStudent(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* private mode: this page view only */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

export function rememberedStudent(): string | null {
  if (typeof window === "undefined") return null;
  const fromLink = new URLSearchParams(window.location.search).get("student");
  if (fromLink) return fromLink;
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/** The saved student if they are in this list, otherwise the page's own default. */
export function pickStudent(list: { id: string }[], fallback: string | null | undefined): string | null {
  const want = rememberedStudent();
  return want && list.some((s) => s.id === want) ? want : fallback ?? null;
}

/** Like useState for the current student id, but kept in step with the top bar and other pages. */
export function useCurrentStudent(): [string | null, (v: SetStateAction<string | null>) => void] {
  const [current, setCurrentState] = useState<string | null>(null);

  useEffect(() => {
    const fn = (e: Event) => setCurrentState((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
  }, []);

  useEffect(() => {
    if (!current) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    if (saved !== current) rememberStudent(current);
  }, [current]);

  const setCurrent = useCallback((v: SetStateAction<string | null>) => setCurrentState(v), []);
  return [current, setCurrent];
}
