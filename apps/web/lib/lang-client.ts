"use client";

import { useEffect, useState } from "react";
import { LANG_COOKIE, langFromCookie, type Lang } from "./lang";
import { supabase } from "./supabase";

export function currentLang(): Lang {
  if (typeof document === "undefined") return "en";
  return langFromCookie(document.cookie);
}

export function setLang(l: Lang) {
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
  // Save it to the account too, so reminder emails and texts come in the same language.
  void saveLang(l).finally(() => window.location.reload());
}

async function saveLang(l: Lang) {
  try {
    const sb = supabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    if (data.session) await sb.rpc("set_my_lang", { p_lang: l });
  } catch { /* the cookie still works on this device */ }
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
