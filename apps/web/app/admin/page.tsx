"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";
import { Icon, lookOf, teamSections } from "./shell";

/** One line under each team page on the admin home. Pages not listed just show their name. */
const ABOUT: Record<string, string> = {
  "/admin/answers": "Check the counselor answers before families see them.",
  "/admin/questions": "Approve new practice and SAT/ACT questions.",
  "/admin/lessons": "Review study skills lessons.",
  "/admin/scholarships": "Check new scholarships and run the AI finder.",
  "/admin/trades": "Check trade pay, training and school facts.",
  "/admin/openings": "Approve apprenticeships, local openings and weekend jobs.",
  "/admin/schools": "Approve schools that asked for the counselor portal.",
  "/admin/ratings": "What families said on Rate ScholarTasks.",
  "/admin/consents": "Parent consent signatures for people on camera.",
  "/check": "Read the Spanish, screen by screen.",
  "/admin/college-data": "Load or refresh the college list.",
  "/admin/presentation": "Present the narrated slides to parents and schools.",
  "/admin/marketing": "Growth plan, outlook and the social media posts.",
  "/admin/testers": "Invite testers and send test links.",
};

/** Team home: every team page as a card, in its section. */
export default function AdminHome() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/admin");
      const r = await sb.rpc("is_app_admin");
      setAdmin(r.data === true);
    })();
  }, [sb]);

  const title = "Team admin";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === undefined) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!admin) return <Page title={title}><p className="note note-info">This page is for the ScholarTasks team.</p></Page>;

  return (
    <Page title={title}>
      <p className="hint">Everything the team looks after, in one place. Pick a page below or from the menu.</p>
      {teamSections().map((s) => (
        <section key={s.title}>
          <h2 className="admin-sub">{s.title}</h2>
          <div className="admin-cards">
            {s.items.map((i) => {
              const { icon, tone } = lookOf(i.href);
              return (
                <a key={i.href} href={i.href} className="admin-card">
                  <span className={`ai-tile ai-tile-lg ai-${tone}`}><Icon name={icon} /></span>
                  <span>
                    <b>{i.label}</b>
                    {ABOUT[i.href] && <small>{ABOUT[i.href]}</small>}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </Page>
  );
}
