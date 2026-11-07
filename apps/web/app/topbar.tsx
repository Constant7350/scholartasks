"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { pickStudent, rememberStudent, useCurrentStudent } from "../lib/current-student";
import { Brand } from "./brand";
import { HelpButton, HelpLayer } from "./help/balloons";
import { inPhoneApp } from "../lib/passkeys-client";
import { appSignOut } from "../lib/share";
import { ThemeButton, ThemePicker } from "./theme-picker";
import { Icon } from "./icons";
import { Avatar } from "./avatar";
import { LangPicker } from "./lang-picker";
import { UI, navLabel, navShort } from "./nav-es";
import { useLang } from "../lib/lang-client";
import { useSpace } from "../lib/parent-space";
import { NAV, NAV_GROUPS, bestMatch, isActive, tabOf, type NavItem, type NavRole } from "./nav";

interface Who { role: NavRole; students: { id: string; first_name: string }[]; own: string | null; admin: boolean; tester: boolean }

/**
 * Top navigation for signed-in people:
 * - top bar with the menu (role-aware: students see only student pages, parents also see family pages)
 * - the menu has a search box at the top, then folded sections
 * - on computers, a strip under the top bar with the four main pages and, for parents with more than one student, which one they are looking at
 * - on phones, a tab bar along the bottom with the same four pages and "More" for the full menu
 * - a color button (one tap moves to the next color theme) next to the help button
 * The list of pages and their order lives in nav.ts.
 */
export function TopBar() {
  const sb = supabase();
  const path = usePathname() ?? "/";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [who, setWho] = useState<Who | null>(null);
  const [current, setCurrent] = useCurrentStudent();
  const [space] = useSpace();
  const menu = useRef<HTMLDetailsElement>(null);
  const bar = useRef<HTMLElement>(null);
  // The header is sticky, so pages that pin something under it (the Help search box, the test-prep bar)
  // read its height from --header-h instead of guessing.
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => {
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
      const row = el.querySelector<HTMLElement>(".topbar-inner");
      if (row) document.documentElement.style.setProperty("--topbar-row-h", `${row.offsetHeight}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--header-h"); document.documentElement.style.removeProperty("--topbar-row-h"); };
  });
  // Where the menu scrolls to when opened from a page's "back to section" link.
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  // Menu search: type a word to find any page without knowing its section.
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!sb) return setSignedIn(false);
    sb.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!sb || !signedIn) return;
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return;
      const [mem, st, adm, tst] = await Promise.all([
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        sb.from("students").select("id, first_name").order("first_name"),
        sb.rpc("is_app_admin"),
        sb.rpc("is_tester"),
      ]);
      const rows = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
      const own = rows.find((r) => r.role === "student")?.student_id ?? null;
      const role: NavRole = rows.some((r) => r.role === "parent") ? "parent" : own ? "student" : "none";
      const students = (st.data as Who["students"]) ?? [];
      setWho({ role, students, own, admin: adm.data === true, tester: tst.data === true });
      setCurrent((c) => (c && students.some((x) => x.id === c) ? c : role === "parent" ? pickStudent(students, students[0]?.id) : own));
    })();
  }, [sb, signedIn, setCurrent]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const t = e.target as Element;
      if (t.closest?.("[data-menu-toggle]")) return;
      if (menu.current?.open && !menu.current.contains(t)) menu.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  // Close the menu after moving to another page.
  useEffect(() => { if (menu.current) menu.current.open = false; setQ(""); }, [path]);

  // Inside the phone app, website-only pages (plans and payments) are left out of the menu.
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(inPhoneApp()), []);

  const signOut = async () => {
    // In the phone app the app decides: lock with Face ID, or sign out fully.
    if (appSignOut()) return;
    await sb?.auth.signOut();
    window.location.href = "/signin";
  };

  const lang = useLang();
  const t = UI[lang];
  const role: NavRole = who?.role ?? "none";
  const items = NAV.filter((i) => i.roles.includes(role) && (!i.group.startsWith("team") || who?.admin || (i.href === "/check" && who?.tester)) && !(i.webOnly && inApp));
  const here = bestMatch(items, path);
  const isParent = role === "parent";
  const kids = who?.students ?? [];

  // The menu shows every page at once (Constant, 2026-11-07: no folding): each section is a small
  // heading and a grid of colored tiles, the same look as the tiles on Home. Team sections stay as lists.
  const onMenuToggle = () => {
    if (!menu.current?.open) return setJumpTo(null);
    const key = jumpTo;
    if (key) setTimeout(() => document.getElementById(`menu-sec-${key}`)?.scrollIntoView({ block: "start" }), 0);
    else menu.current.querySelector(".menu-list")?.scrollTo({ top: 0 });
  };
  const section = (key: string, title: string, body: ReactNode, icon?: string) => (
    <section key={key} id={`menu-sec-${key}`} className={`menu-group menu-group-${key}`}>
      <h3 className="menu-sec-title">{icon && <Icon of={icon} className="menu-ico" />}{title}</h3>
      {body}
    </section>
  );
  const tile = (i: NavItem) => (
    <a key={i.href + i.label} className={`menu-tile ${here === i ? "nav-on" : ""}`} href={i.href} aria-current={here === i ? "page" : undefined}>
      <Icon of={i.icon} />
      <span>{navShort(i, lang)}</span>
    </a>
  );

  const groups = NAV_GROUPS.map((g) => ({ key: g.key, icon: g.icon, title: g.key === "family" && !isParent ? t.connected : g[lang] }));

  const link = (i: NavItem, cls: string, label: string) => (
    <a key={i.href + i.label} className={`${cls} ${here === i ? "nav-on" : ""}`} href={i.href} aria-current={here === i ? "page" : undefined}>
      <Icon of={i.icon} className="menu-ico" /> {label}
    </a>
  );
  // Pages reached from a tab row on a nearby page stay out of the lists (still found by search); small links sit at the bottom.
  const listed = items.filter((i) => i.inMenu !== false && !i.small);
  const smalls = items.filter((i) => i.small);

  // In a parent's own space (My parent space, or a search page switched to it) the bar says so,
  // instead of naming the student, so nothing looks like it is being done as the student.
  const ownSpace = isParent && (path === "/parent" || (space === "parent" && ["/colleges", "/majors", "/scholarships"].includes(path)));
  const switcher = ownSpace ? (
    <a className="student-switch student-switch-own" href="/parent"><Icon of="👤" className="menu-ico" /> <b>{t.mySpace}</b></a>
  ) : isParent && kids.length > 0 && (
    <label className="student-switch">
      {kids.length === 1 ? (
        <a href="/students"><Avatar name={kids[0]!.first_name} size={24} /> <b>{kids[0]?.first_name}</b></a>
      ) : (<>
        <Avatar name={kids.find((k) => k.id === current)?.first_name ?? kids[0]!.first_name} size={24} />
        <select value={current ?? ""} onChange={(e) => { setCurrent(e.target.value); rememberStudent(e.target.value); }} aria-label="Choose a student">
          {kids.map((k) => <option key={k.id} value={k.id}>{k.first_name}</option>)}
        </select>
      </>)}
    </label>
  );
  // With one student there is nothing to switch, so the strip stays empty (and hidden on phones); the menu still names them.
  const stripSwitcher = ownSpace || kids.length > 1 ? switcher : null;

  const openMenu = () => {
    if (menu.current) menu.current.open = !menu.current.open;
  };

  // "Back to section" link at the top of every page: opens the menu on the section this page is in.
  const crumbGroup = here && here.href !== "/home" ? groups.find((g) => g.key === here.group) : undefined;
  const openSection = () => {
    if (!menu.current) return;
    setJumpTo(here?.group ?? null);
    menu.current.open = true;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const tabs = items.filter((i) => tabOf(i, role)).sort((a, b) => (tabOf(a, role) ?? 0) - (tabOf(b, role) ?? 0));
  // Search matches the English and Spanish names and the section name, ignoring accents.
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const query = fold(q.trim());
  const found = query ? items.filter((i, n, all) => all.findIndex((x) => x.href === i.href) === n && query.split(/\s+/).every((w) =>
    fold([i.label, navLabel(i, "es"), i.short ?? "", groups.find((g) => g.key === i.group)?.title ?? ""].join(" ")).includes(w))) : [];
  const moreOn = !!here && !tabs.some((t) => isActive(t.href, path));

  return (
    <>
    <header className="topbar" ref={bar}>
      <div className="topbar-inner">
        <Brand href={signedIn ? "/home" : "/"} />
        <nav>
          <HelpButton />
          {signedIn && <ThemeButton />}
          {signedIn === false && <a href="/signin">{t.signIn}</a>}
          {signedIn && (
            <details className="menu" ref={menu} onToggle={onMenuToggle}>
              <summary aria-label={t.openMenu}>
                {t.menu}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="menu-list" role="menu">
                {switcher && <div className="menu-switch">{switcher}</div>}
                <div className="menu-search">
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.find} aria-label={t.find} enterKeyHint="go"
                    onKeyDown={(e) => { if (e.key === "Enter" && found[0]) window.location.href = found[0].href; }} />
                </div>
                {query ? (
                  found.length ? found.map((i) => link(i, "menu-item", navLabel(i, lang))) : <p className="menu-none">{t.noMatch}</p>
                ) : groups.map((g) => {
                  const list = listed.filter((i) => i.group === g.key);
                  if (!list.length) return null;
                  return section(g.key, g.title, g.key.startsWith("team") ? list.map((i) => link(i, "menu-item", navLabel(i, lang))) : <div className="menu-tiles">{list.map(tile)}</div>, g.icon);
                })}
                {!query && section("look", t.look, <><ThemePicker /><LangPicker /></>, "🎨")}
                <div className="menu-small">
                  {smalls.map((i) => link(i, "menu-small-link", navShort(i, lang)))}
                  <button role="menuitem" className="menu-small-link" onClick={signOut}><Icon of="🚪" className="menu-ico" /> {t.signOut}</button>
                </div>
              </div>
            </details>
          )}
        </nav>
      </div>

      {signedIn && (
        <div className="pagestrip">
          <div className="pagestrip-inner">
            {stripSwitcher}
            <nav className="strip-links" aria-label="Main pages">
              {tabs.map((i) => (
                <a key={i.href} className={isActive(i.href, path) ? "nav-on" : ""} href={i.href} aria-current={isActive(i.href, path) ? "page" : undefined}>
                  {navShort(i, lang)}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {signedIn && crumbGroup && here && (
        <div className="crumb">
          <div className="crumb-inner">
            <button type="button" data-menu-toggle onClick={openSection} aria-label={`${t.backTo} ${crumbGroup.title}`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
              {crumbGroup.title}
            </button>
            <span className="crumb-here" aria-current="page">{navLabel(here, lang)}</span>
          </div>
        </div>
      )}

      {signedIn && (
        <nav className="tabbar" aria-label="Main pages">
          {tabs.map((i) => (
            <a key={i.href} className={isActive(i.href, path) ? "nav-on" : ""} href={i.href} aria-current={isActive(i.href, path) ? "page" : undefined}>
              <Icon of={i.icon} className="tabbar-icon" />
              <span>{navShort(i, lang)}</span>
            </a>
          ))}
          <button type="button" data-menu-toggle className={moreOn ? "nav-on" : ""} onClick={openMenu} aria-label={t.more}>
            <Icon of="☰" className="tabbar-icon" />
            <span>{t.more}</span>
          </button>
        </nav>
      )}
    </header>
    {/* Help balloons use page coordinates, so they live outside the sticky header. */}
    <HelpLayer />
    </>
  );
}
