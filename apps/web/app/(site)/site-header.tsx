"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { Brand } from "../brand";

export const SITE_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/#how", label: "How it works" },
  { href: "/compare", label: "Compare" },
  { href: "/schools", label: "For schools" },
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact" },
  { href: "/es", label: "Español" },
];

/** Header for the public website. Signed-in visitors get a button back to their plan. */
export function SiteHeader() {
  const path = usePathname() ?? "/";
  const [signedIn, setSignedIn] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    supabase()?.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const links = SITE_LINKS.map((l) => (
    <a key={l.href} href={l.href} aria-current={path === l.href ? "page" : undefined} onClick={() => menu.current && (menu.current.open = false)}>
      {l.label}
    </a>
  ));
  const main = signedIn
    ? <a className="btn" href="/home">Open my plan</a>
    : <a className="btn" href="/signin">Start free</a>;

  return (
    <header className="site-head">
      <div className="site-head-inner">
        <Brand href="/" />
        <nav className="site-nav" aria-label="Website">{links}</nav>
        <div className="site-actions">
          {!signedIn && <a className="site-signin" href="/signin">Sign in</a>}
          {main}
          <details className="site-burger" ref={menu}>
            <summary aria-label="Open menu">Menu</summary>
            <nav className="site-burger-list" aria-label="Website">
              {links}
              {!signedIn && <a href="/signin">Sign in</a>}
              {signedIn ? <a className="btn" href="/home">Open my plan</a> : <a className="btn" href="/signin">Start free</a>}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
