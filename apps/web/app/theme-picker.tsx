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

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId>("campus");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    if (t === "sunrise" || t === "garden") setTheme(t);
  }, []);

  const pick = (id: ThemeId) => {
    setTheme(id);
    apply(id);
    try {
      if (id === "campus") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, id);
    } catch { /* private mode: the choice lasts until the page closes */ }
  };

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
