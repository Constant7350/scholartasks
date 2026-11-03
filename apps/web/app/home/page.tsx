"use client";

import { useEffect, useState } from "react";
import type { StatePack } from "@scholartasks/core";
import gaPack from "../../../../packs/states/GA.json";
import { supabase } from "../../lib/supabase";
import { NotConfigured, Page } from "../ui";

const GA = gaPack as unknown as StatePack;

interface Student { id: string; first_name: string; grade_level: number }
interface Invite { student_id: string; accepted_at: string | null }

const SOON = [
  { icon: "🤖", title: "AI counselor", text: "Ask anything about colleges, aid and deadlines. It builds a plan around your student." },
  { icon: "💰", title: "Scholarship matches", text: "Scholarships your student qualifies for, kept up to date for you." },
  { icon: "📝", title: "SAT and ACT practice", text: "Short daily practice and full practice tests with a score plan." },
  { icon: "📚", title: "Grades and study skills", text: "For grades 8 to 11: track grades and get nudges before they slip." },
];

export default function Home() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);

  useEffect(() => {
    if (!sb) return;
    (async () => {
      const { data } = await sb.auth.getSession();
      setSignedIn(!!data.session);
      if (!data.session) return;
      setEmail(data.session.user.email ?? "");
      const [st, inv] = await Promise.all([
        sb.from("students").select("id, first_name, grade_level").order("first_name"),
        sb.from("family_invites").select("student_id, accepted_at"),
      ]);
      setStudents((st.data as Student[]) ?? []);
      setInvites((inv.data as Invite[]) ?? []);
    })();
  }, [sb]);

  if (!sb) return <Page title="Home"><NotConfigured /></Page>;
  if (signedIn === null) return <Page><p className="hint">Loading…</p></Page>;
  if (signedIn === false) {
    // Keep any error from the sign-in provider so the sign-in page can show it.
    if (typeof window !== "undefined") window.location.replace("/signin" + window.location.search + window.location.hash);
    return <Page><p className="hint">Taking you to sign in…</p></Page>;
  }

  const connected = (id: string) => invites.some((i) => i.student_id === id && i.accepted_at);
  const dates = [...GA.deadlines].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  return (
    <Page>
      <section className="hero">
        <p className="eyebrow">Welcome{email ? `, ${email}` : ""}</p>
        <h1>Your college plan starts here</h1>
        <p className="hint">Look around and try the tools first. Add your student whenever you're ready.</p>
      </section>

      <div className="panel family-card">
        {students.length === 0 ? (
          <>
            <div>
              <h2>Add your student when you're ready</h2>
              <p className="hint" style={{ margin: 0 }}>Their plan, reminders and scholarship matches are built from their grade and goals. You choose what they can see and do.</p>
            </div>
            <a className="btn btn-ghost btn-inline link-btn" href="/family">Add a student</a>
          </>
        ) : (
          <>
            <div>
              <h2>Your students</h2>
              <ul className="kids">
                {students.map((s) => (
                  <li key={s.id}>
                    <strong>{s.first_name}</strong> · Grade {s.grade_level}{" "}
                    {connected(s.id) ? <span className="pill pill-ok">Connected</span> : <span className="pill">Not connected yet</span>}
                  </li>
                ))}
              </ul>
            </div>
            <a className="btn btn-ghost btn-inline link-btn" href="/family">Manage family</a>
          </>
        )}
      </div>

      <h2 className="section-title">Try it now</h2>
      <div className="tiles">
        <a className="tile" href="/tools/hope">
          <span className="tile-icon">🎓</span>
          <b>HOPE and Zell Miller checker</b>
          <span>Enter grades to see if your student is on track for Georgia's scholarships.</span>
          <span className="tile-go">Open the checker →</span>
        </a>
        <div className="tile">
          <span className="tile-icon">📅</span>
          <b>Key Georgia dates</b>
          <ul className="dates">
            {dates.map((d) => (
              <li key={d.id}>
                <span className="date">{new Date(d.date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                <span>{d.title}</span>
              </li>
            ))}
          </ul>
          <span className="hint" style={{ fontSize: 12 }}>Draft dates, being checked with the Georgia Student Finance Commission.</span>
        </div>
      </div>

      <h2 className="section-title">Coming soon</h2>
      <div className="tiles">
        {SOON.map((s) => (
          <div key={s.title} className="tile tile-soon">
            <span className="tile-icon">{s.icon}</span>
            <b>{s.title}</b>
            <span>{s.text}</span>
          </div>
        ))}
      </div>
    </Page>
  );
}
