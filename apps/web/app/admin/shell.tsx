"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { appSignOut } from "../../lib/share";
import { BrandMark } from "../brand";
import { NAV, NAV_GROUPS, bestMatch, type NavItem } from "../nav";

/**
 * Team admin layout: a menu down the left side with a colored icon for each page,
 * the page on the right (same layout as the HiveTask admin). On phones the menu
 * becomes a bar across the top that scrolls sideways.
 *
 * The list of pages comes from the team sections of nav.ts, so a new team page
 * added there shows up here by itself. Give it an icon and color in LOOK below.
 */

/** True inside the team admin layout: Page() then leaves out the family top bar and footer. */
const InShell = createContext(false);
export const useInAdminShell = () => useContext(InShell);

type Tone = "navy" | "blue" | "green" | "gold" | "coral" | "purple";

// Line icons (same style as the HiveTask admin).
const ICONS: Record<string, string> = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21V5"/><path d="M8 7h7M8 11h5"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  school: '<path d="M2.5 9L12 4l9.5 5-9.5 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/><path d="M21.5 9v6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5"/><path d="M4 19h16"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  bug: '<rect x="7.5" y="8" width="9" height="12" rx="4.5"/><path d="M9.5 8a2.5 2.5 0 015 0M3.5 13h4M16.5 13h4M4.5 8.5l3 2M19.5 8.5l-3 2M4.5 18.5l3-2M19.5 18.5l-3-2"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z"/><path d="M9 12l2 2 4-4"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  logout: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
};

/** Icon and color for each team page. Pages not listed get a plain page icon. */
const LOOK: Record<string, [icon: string, tone: Tone]> = {
  "/admin": ["home", "gold"],
  "/admin/answers": ["chat", "blue"],
  "/admin/questions": ["check", "green"],
  "/admin/lessons": ["book", "purple"],
  "/admin/scholarships": ["money", "gold"],
  "/admin/trades": ["gear", "coral"],
  "/admin/openings": ["bag", "coral"],
  "/admin/schools": ["school", "blue"],
  "/admin/ratings": ["star", "gold"],
  "/admin/consents": ["shield", "purple"],
  "/check": ["globe", "green"],
  "/admin/college-data": ["upload", "navy"],
  "/admin/presentation": ["slides", "coral"],
  "/admin/marketing": ["share", "purple"],
  "/admin/testers": ["bug", "green"],
};

export function Icon({ name }: { name: string }) {
  return <svg className="ai-icon" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] ?? ICONS.file! }} />;
}

export function lookOf(href: string): { icon: string; tone: Tone } {
  const [icon, tone] = LOOK[href] ?? ["file", "navy"];
  return { icon, tone };
}

/** Team pages from nav.ts, in their menu sections (Home first). */
export function teamSections(): { title: string; items: NavItem[] }[] {
  return NAV_GROUPS.filter((g) => g.team).map((g) => ({
    title: g.en.replace(/^Team: /, ""),
    items: NAV.filter((i) => i.group === g.key && i.href !== "/admin"),
  }));
}

export function AdminShell({ children }: { children: ReactNode }) {
  const sb = supabase();
  const path = usePathname() ?? "/admin";
  // undefined = still checking. Only the team gets the admin layout; everyone else sees the
  // normal page (which says "This page is for the ScholarTasks team").
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!sb) return setAdmin(false);
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return setAdmin(false);
      const u = s.session.user;
      setName(String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? (u.email ?? "").split("@")[0] ?? ""));
      const r = await sb.rpc("is_app_admin");
      setAdmin(r.data === true);
    })();
  }, [sb]);

  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  // On phones the menu scrolls sideways: bring the page you are on into view.
  useEffect(() => {
    if (admin) document.querySelector(".admin-nav a.on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [admin, path]);

  if (admin === false) return <>{children}</>;

  const sections = teamSections();
  const all = [...sections.flatMap((s) => s.items)];
  const here = path === "/admin" ? undefined : bestMatch(all, path);

  const signOut = async () => {
    if (appSignOut()) return;
    await sb?.auth.signOut();
    window.location.href = "/signin";
  };

  const link = (href: string, label: string, on: boolean) => {
    const { icon, tone } = lookOf(href);
    return (
      <a key={href + label} href={href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
        <span className={`ai-tile ai-${tone}`}><Icon name={icon} /></span>
        {label}
      </a>
    );
  };

  return (
    <InShell.Provider value={true}>
      <div className="admin-app">
        <aside className="admin-side">
          <div className="admin-topline">
            <a href="/admin" className="admin-brand">
              <BrandMark className="admin-logo" />
              <span><b>ScholarTasks</b><small>Team admin</small></span>
            </a>
            <button type="button" className="admin-signout-sm" onClick={signOut}><Icon name="logout" />Sign out</button>
          </div>
          <nav className="admin-nav" aria-label="Team pages">
            {link("/admin", "Home", path === "/admin")}
            {sections.map((s) => (
              <div key={s.title} className="admin-navgroup">
                <span className="admin-navhead">{s.title}</span>
                {s.items.map((i) => link(i.href, i.label, here === i))}
              </div>
            ))}
            <a href="/home" className="admin-backlink">
              <span className="ai-tile ai-navy"><Icon name="back" /></span>
              Back to the family app
            </a>
          </nav>
          <div className="admin-me">
            <span className="admin-avatar" aria-hidden="true">{(name[0] ?? "S").toUpperCase()}</span>
            <div>
              <b>{name || "ScholarTasks team"}</b>
              <button type="button" className="admin-linkbtn" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </aside>
        <div className="admin-main">{children}</div>
      </div>
    </InShell.Provider>
  );
}
