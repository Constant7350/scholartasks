"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { appSignOut } from "../../lib/share";
import { BrandMark } from "../brand";
import { NAV, NAV_GROUPS, bestMatch, type NavItem } from "../nav";
import { attentionLabel, loadAttention, type Attention } from "./attention";
import { ICONS } from "../icons";

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
/** Wraps a layout that brings its own menu (the school portal): Page() leaves out the family top bar and footer. */
export function NoFamilyChrome({ children }: { children: ReactNode }) {
  return <InShell.Provider value={true}>{children}</InShell.Provider>;
}

/** How many things wait on each team page (see attention.ts). Empty until loaded. */
const AttentionCtx = createContext<Attention>({});
export const useAttention = () => useContext(AttentionCtx);

/** Red number: how many things on that page still need someone to look at them. */
export function Badge({ href, count }: { href: string; count: number | undefined }) {
  if (!count) return null;
  const label = attentionLabel(href, count);
  return <span className="admin-count" title={label} aria-label={label}>{count > 99 ? "99+" : count}</span>;
}

type Tone = "navy" | "blue" | "green" | "gold" | "coral" | "purple";

// Line icons: the one drawn set used across the app (app/icons.tsx).
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
  "/admin/families": ["users", "blue"],
  "/admin/consents": ["shield", "purple"],
  "/admin/challenges": ["star", "coral"],
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
  const [attention, setAttention] = useState<Attention>({});

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

  // Fresh counts on every page change, so a number drops as soon as you finish a review.
  useEffect(() => {
    if (!sb || !admin) return;
    let live = true;
    loadAttention(sb).then((a) => { if (live) setAttention(a); }).catch(() => undefined);
    return () => { live = false; };
  }, [sb, admin, path]);

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
        <span className="admin-navlabel">{label}</span>
        <Badge href={href} count={attention[href]} />
      </a>
    );
  };

  return (
    <InShell.Provider value={true}>
      <AttentionCtx.Provider value={attention}>
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
      </AttentionCtx.Provider>
    </InShell.Provider>
  );
}
