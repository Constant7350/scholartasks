"use client";

import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "../lib/theme";

/** Color themes a student or parent can pick. Bright Campus is the default. */
export const THEMES = [
  { id: "campus", name: "Campus", dot: "linear-gradient(135deg, #14305a 50%, #f2b33d 50%)" },
  { id: "sunrise", name: "Sunrise", dot: "linear-gradient(135deg, #fde3cf 50%, #f2b33d 50%)" },
  { id: "garden", name: "Garden", dot: "linear-gradient(135deg, #d6ece3 50%, #1f6f6b 50%)" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];


function apply(id: ThemeId) {
  if (id === "campus") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = id;
}

function current(): ThemeId {
  const t = document.documentElement.dataset.theme;
  return t === "sunrise" || t === "garden" ? t : "campus";
}

function save(id: ThemeId) {
  apply(id);
  try {
    if (id === "campus") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, id);
  } catch { /* private mode: the choice lasts until the page closes */ }
  window.dispatchEvent(new Event("st-theme"));
}

/**
 * One-tap color button in the top bar (Constant, 2026-11-07): each tap moves to the next
 * color theme, Campus, Sunrise, Garden. The full picker with names stays in the menu.
 */
export function ThemeButton() {
  const [theme, setTheme] = useState<ThemeId>("campus");
  useEffect(() => {
    const sync = () => setTheme(current());
    sync();
    window.addEventListener("st-theme", sync);
    return () => window.removeEventListener("st-theme", sync);
  }, []);
  const next = THEMES[(THEMES.findIndex((t) => t.id === theme) + 1) % THEMES.length]!;
  const now = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  return (
    <button type="button" className="theme-btn" onClick={() => save(next.id)} aria-label={`App colors: ${now.name}. Switch to ${next.name}`} title={`Colors: ${now.name}. Tap for ${next.name}`}>
      <span className="theme-dot theme-dot-sm" style={{ background: now.dot }} aria-hidden="true" />
    </button>
  );
}

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>("campus");
  useEffect(() => {
    const sync = () => setTheme(current());
    sync();
    window.addEventListener("st-theme", sync);
    return () => window.removeEventListener("st-theme", sync);
  }, []);

  const pick = (id: ThemeId) => { setTheme(id); save(id); };

  return (
    <div className="theme-pick" role="group" aria-label="App colors">
      <p className="menu-heading">App colors</p>
      <div className="theme-row">
        {THEMES.map((t) => (
          <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => pick(t.id)}>
            <span className="theme-dot" style={{ background: t.dot }} aria-hidden="true" />
            {t.name}
          </button>
        ))}
      </div>
    </div>
  );
}
