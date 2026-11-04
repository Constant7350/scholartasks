"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../lib/supabase";
import { pickStudent, rememberStudent, useCurrentStudent } from "../lib/current-student";
import { Brand } from "./brand";
import { HelpButton, HelpLayer } from "./help/balloons";
import { NAV, bestMatch, isActive, type NavGroup, type NavItem, type NavRole } from "./nav";

interface Who { role: NavRole; students: { id: string; first_name: string }[]; own: string | null; admin: boolean }

/**
 * Top navigation for signed-in people:
 * - top bar with the menu (role-aware: students see only student pages, parents also see family pages)
 * - a page strip under it with the main pages and, for parents, which student they are looking at
 * - on phones, a tab bar along the bottom with the main pages and "More" for the full menu
 * The list of pages lives in nav.ts.
 */
export function TopBar() {
  const sb = supabase();
  const path = usePathname() ?? "/";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [who, setWho] = useState<Who | null>(null);
  const [current, setCurrent] = useCurrentStudent();
  const menu = useRef<HTMLDetailsElement>(null);

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
      const [mem, st, adm] = await Promise.all([
        sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
        sb.from("students").select("id, first_name").order("first_name"),
        sb.rpc("is_app_admin"),
      ]);
      const rows = (mem.data as { role: "parent" | "student"; student_id: string | null }[]) ?? [];
      const own = rows.find((r) => r.role === "student")?.student_id ?? null;
      const role: NavRole = rows.some((r) => r.role === "parent") ? "parent" : own ? "student" : "none";
      const students = (st.data as Who["students"]) ?? [];
      setWho({ role, students, own, admin: adm.data === true });
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
  useEffect(() => { if (menu.current) menu.current.open = false; }, [path]);

  const signOut = async () => {
    await sb?.auth.signOut();
    window.location.href = "/signin";
  };

  const role: NavRole = who?.role ?? "none";
  const items = NAV.filter((i) => i.roles.includes(role) && (i.group !== "team" || who?.admin));
  const here = bestMatch(items, path);
  const isParent = role === "parent";
  const kids = who?.students ?? [];
  const student = kids.find((k) => k.id === current);
  const studentTitle = role === "student" ? "My pages" : isParent && student ? `${student.first_name}'s pages` : "Pages";

  const groups: { key: NavGroup; title: string }[] = [
    { key: "student", title: studentTitle },
    { key: "family", title: isParent ? "Family" : "Get connected" },
    { key: "help", title: "Help" },
    { key: "team", title: "ScholarTasks team" },
  ];

  const link = (i: NavItem, cls: string, label: string) => (
    <a key={i.href + i.label} className={`${cls} ${here === i ? "nav-on" : ""}`} href={i.href} aria-current={here === i ? "page" : undefined}>
      <span aria-hidden="true">{i.icon}</span> {label}
    </a>
  );

  const switcher = isParent && kids.length > 0 && (
    <label className="student-switch">
      <span className="student-switch-label">Viewing</span>
      {kids.length === 1 ? (
        <b>{kids[0]?.first_name}</b>
      ) : (
        <select value={current ?? ""} onChange={(e) => { setCurrent(e.target.value); rememberStudent(e.target.value); }} aria-label="Choose a student">
          {kids.map((k) => <option key={k.id} value={k.id}>{k.first_name}</option>)}
        </select>
      )}
    </label>
  );

  const openMenu = () => {
    if (menu.current) menu.current.open = !menu.current.open;
  };

  const tabs = items.filter((i) => i.tab).sort((a, b) => (a.tab ?? 0) - (b.tab ?? 0));
  const moreOn = !!here && !tabs.some((t) => isActive(t.href, path));

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand href={signedIn ? "/home" : "/"} />
        <nav>
          <HelpButton />
          {signedIn === false && <a href="/signin">Sign in</a>}
          {signedIn && (
            <details className="menu" ref={menu}>
              <summary aria-label="Open menu">
                Menu
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <div className="menu-list" role="menu">
                {switcher && <div className="menu-switch">{switcher}</div>}
                {groups.map((g) => {
                  const list = items.filter((i) => i.group === g.key);
                  if (!list.length) return null;
                  return (
                    <div key={g.key} className="menu-group">
                      <p className="menu-heading">{g.title}</p>
                      {list.map((i) => link(i, "menu-item", i.label))}
                    </div>
                  );
                })}
                <hr />
                <button role="menuitem" className="menu-item" onClick={signOut}><span aria-hidden="true">🚪</span> Sign out</button>
              </div>
            </details>
          )}
        </nav>
      </div>

      {signedIn && (
        <div className="pagestrip">
          <div className="pagestrip-inner">
            {switcher}
            <nav className="strip-links" aria-label="Main pages">
              {items.filter((i) => i.strip).map((i) => (
                <a key={i.href} className={isActive(i.href, path) ? "nav-on" : ""} href={i.href} aria-current={isActive(i.href, path) ? "page" : undefined}>
                  {i.short ?? i.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {signedIn && (
        <nav className="tabbar" aria-label="Main pages">
          {tabs.map((i) => (
            <a key={i.href} className={isActive(i.href, path) ? "nav-on" : ""} href={i.href} aria-current={isActive(i.href, path) ? "page" : undefined}>
              <span className="tabbar-icon" aria-hidden="true">{i.icon}</span>
              <span>{i.short ?? i.label}</span>
            </a>
          ))}
          <button type="button" data-menu-toggle className={moreOn ? "nav-on" : ""} onClick={openMenu} aria-label="More pages">
            <span className="tabbar-icon" aria-hidden="true">☰</span>
            <span>More</span>
          </button>
        </nav>
      )}
      <HelpLayer />
    </header>
  );
}
