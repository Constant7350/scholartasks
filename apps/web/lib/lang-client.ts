"use client";

import { useEffect, useState } from "react";
import { LANG_COOKIE, langFromCookie, type Lang } from "./lang";

export function currentLang(): Lang {
  if (typeof document === "undefined") return "en";
  return langFromCookie(document.cookie);
}

export function setLang(l: Lang) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

/** The page's language; starts as English on the server, then reads the cookie. */
export function useLang(): Lang {
  const [lang, set] = useState<Lang>("en");
  useEffect(() => {
    const l = currentLang();
    set(l);
    document.documentElement.lang = l;
  }, []);
  return lang;
}
