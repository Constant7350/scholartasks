"use client";

import { setLang, useLang } from "../lib/lang-client";

/** English / Español switch in the menu (and on the public site). */
export function LangPicker() {
  const lang = useLang();
  return (
    <div className="theme-pick" role="group" aria-label="Language / Idioma">
      <p className="menu-heading">Language · Idioma</p>
      <div className="theme-row">
        <button type="button" aria-pressed={lang === "en"} onClick={() => lang !== "en" && setLang("en")}>English</button>
        <button type="button" aria-pressed={lang === "es"} onClick={() => lang !== "es" && setLang("es")}>Español</button>
      </div>
      {lang === "es" && <p className="hint small" style={{ margin: "6px 0 0" }}>Toda la aplicación y las respuestas de la IA están en español. Una persona bilingüe está revisando la traducción.</p>}
    </div>
  );
}
