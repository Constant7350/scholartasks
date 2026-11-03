"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { Brand } from "./brand";

/** Top navigation. Signed-in people get Home plus a menu; family setup lives in the menu, not in the way. */
export function TopBar() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!sb) return setSignedIn(false);
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const signOut = async () => {
    await sb?.auth.signOut();
    window.location.href = "/signin";
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand href={signedIn ? "/home" : "/"} />
        <nav>
          {signedIn === false && <a href="/signin">Sign in</a>}
          {signedIn && (
            <>
              <a href="/home">Home</a>
              <details className="menu" ref={menu}>
                <summary aria-label="Open menu">
                  Menu
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </summary>
                <div className="menu-list" role="menu">
                  <a role="menuitem" href="/plan">🗂️ College list and deadlines</a>
                  <a role="menuitem" href="/family">👪 Add a student</a>
                  <a role="menuitem" href="/family">🔒 Family and permissions</a>
                  <a role="menuitem" href="/tools/hope">🎓 HOPE and Zell checker</a>
                  <a role="menuitem" href="/join">🔑 I'm a student: join with a code</a>
                  <hr />
                  <button role="menuitem" onClick={signOut}>Sign out</button>
                </div>
              </details>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
