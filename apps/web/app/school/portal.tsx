"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { friendly, supabase } from "../../lib/supabase";
import { appSignOut } from "../../lib/share";
import { BrandMark } from "../brand";
import { Icon, NoFamilyChrome } from "../admin/shell";
import { NotConfigured } from "../ui";
import type { Row, School } from "./parts";

/**
 * The school portal: its own workspace for counselors, separate from the family app.
 * A menu down the left (a bar across the top on phones), the page on the right.
 * Every /school page reads the chosen school and its connected students from usePortal().
 */

type Role = "admin" | "counselor";
export interface Portal {
  school: School; role: Role; schools: (School & { my_role: Role })[];
  rows: Row[] | null; pending: number; papersOpen: number; me: string;
  pick: (id: string) => void; reload: () => void; error: string | null;
}
const Ctx = createContext<Portal | null>(null);
export function usePortal(): Portal {
  const p = useContext(Ctx);
  if (!p) throw new Error("usePortal: no portal");
  return p;
}

const PAGES: [href: string, label: string, icon: string, tone: string][] = [
  ["/school", "Today", "home", "gold"],
  ["/school/students", "Students", "users", "blue"],
  ["/school/papers", "Transcripts and letters", "file", "coral"],
  ["/school/messages", "Messages", "chat", "green"],
  ["/school/scholarships", "Local scholarships", "money", "gold"],
  ["/school/events", "Events", "calendar", "purple"],
  ["/school/settings", "Families and staff", "school", "navy"],
];

export function PortalShell({ children }: { children: ReactNode }) {
  const sb = supabase();
  const path = usePathname() ?? "/school";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [me, setMe] = useState("");
  const [schools, setSchools] = useState<(School & { my_role: Role })[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pending, setPending] = useState(0);
  const [papersOpen, setPapersOpen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadSchools = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    setSignedIn(!!s.session);
    if (!s.session) return;
    const u = s.session.user;
    setMe(String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? (u.email ?? "").split("@")[0] ?? ""));
    const [sc, st] = await Promise.all([
      sb.from("schools").select("id, name, city, state, status, join_code, staff_code, ai_plan").order("name"),
      sb.from("school_staff").select("school_id, role, full_name").eq("user_id", u.id),
    ]);
    if (sc.error) {
      setError(/schools/.test(sc.error.message) && /exist|schema cache/i.test(sc.error.message)
        ? "The school portal needs database update 37. Run it in Supabase, then reload this page."
        : friendly(sc.error));
      setLoaded(true);
      return;
    }
    const staff = (st.data as { school_id: string; role: Role; full_name: string }[]) ?? [];
    const roles = new Map(staff.map((r) => [r.school_id, r.role]));
    if (staff[0]?.full_name) setMe(staff[0].full_name);
    const mine = ((sc.data as School[]) ?? []).filter((x) => roles.has(x.id)).map((x) => ({ ...x, my_role: roles.get(x.id)! }));
    setSchools(mine);
    setCurrent((c) => (c && mine.some((m) => m.id === c) ? c : mine[0]?.id ?? null));
    setLoaded(true);
  }, [sb]);
  useEffect(() => { void loadSchools(); }, [loadSchools]);

  const school = schools.find((s) => s.id === current);
  const ready = school?.status === "approved";

  // The connected students and the counts the menu shows. Loaded once, refreshed after changes.
  const loadStudents = useCallback(async () => {
    if (!sb || !school || school.status !== "approved") return;
    const [c, p, t] = await Promise.all([
      sb.rpc("school_caseload", { p_school: school.id }),
      sb.rpc("school_pending_count", { p_school: school.id }),
      sb.rpc("school_transcript_requests", { p_school: school.id }),
    ]);
    if (c.error) setError(friendly(c.error));
    setRows((c.data as Row[]) ?? []);
    setPending((p.data as number) ?? 0);
    setPapersOpen(((t.data as { status: string }[]) ?? []).filter((r) => r.status === "asked" || r.status === "to_ask").length);
  }, [sb, school]);
  useEffect(() => { void loadStudents(); }, [loadStudents]);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  useEffect(() => {
    if (ready) document.querySelector(".admin-nav a.on")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [ready, path]);

  const signOut = async () => {
    if (appSignOut()) return;
    await sb?.auth.signOut();
    window.location.href = "/signin?next=/school";
  };

  if (!sb) return <Bare><NotConfigured /></Bare>;
  if (signedIn === null || (signedIn && !loaded)) return <Bare><p className="hint">Loading…</p></Bare>;
  if (!signedIn)
    return (
      <Bare>
        <Intro />
        <div className="panel">
          <h2>Sign in to start</h2>
          <p className="hint">Use your school email. If you don't have a ScholarTasks sign-in yet, the sign-in page makes one in a minute.</p>
          <a className="btn btn-inline" style={{ display: "inline-block", textDecoration: "none" }} href="/signin?next=/school">Sign in</a>
        </div>
      </Bare>
    );
  if (!school)
    return (
      <Bare>
        {error && <p className="note note-err" role="alert">{error}</p>}
        <Intro />
        <SignUp onDone={loadSchools} />
        <JoinStaff onDone={loadSchools} />
      </Bare>
    );
  if (!ready)
    return (
      <Bare>
        {school.status === "pending" ? (
          <div className="panel">
            <h2>Thanks! We're checking your school</h2>
            <p className="hint" style={{ marginBottom: 0 }}>
              The ScholarTasks team confirms every school before anyone there can see students. This usually takes a school day.
              We may email you at the address you signed in with. Questions: <a href="mailto:support@scholartasks.com">support@scholartasks.com</a>.
            </p>
          </div>
        ) : (
          <p className="note note-err">This school account is closed. Email <a href="mailto:support@scholartasks.com">support@scholartasks.com</a> if that's a mistake.</p>
        )}
        <button type="button" className="btn btn-ghost btn-inline" onClick={signOut}>Sign out</button>
      </Bare>
    );

  const portal: Portal = {
    school, role: school.my_role, schools, rows, pending, papersOpen, me, error,
    pick: (id) => { setRows(null); setCurrent(id); },
    reload: () => { void loadSchools(); void loadStudents(); },
  };
  const here = PAGES.slice(1).find(([href]) => path.startsWith(href))?.[0] ?? "/school";

  return (
    <NoFamilyChrome>
      <Ctx.Provider value={portal}>
        <div className="admin-app portal-app">
          <aside className="admin-side">
            <div className="admin-topline">
              <a href="/school" className="admin-brand">
                <BrandMark className="admin-logo" />
                <span><b>{school.name}</b><small>School portal · {school.city}, {school.state}</small></span>
              </a>
              <button type="button" className="admin-signout-sm" onClick={signOut}><Icon name="logout" />Sign out</button>
            </div>
            {schools.length > 1 && (
              <select aria-label="School" className="input portal-pick" value={school.id} onChange={(e) => portal.pick(e.target.value)}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <nav className="admin-nav" aria-label="School portal pages">
              {PAGES.map(([href, label, icon, tone]) => {
                const count = href === "/school/papers" ? papersOpen : 0;
                return (
                  <a key={href} href={href} className={here === href ? "on" : ""} aria-current={here === href ? "page" : undefined}>
                    <span className={`ai-tile ai-${tone}`}><Icon name={icon} /></span>
                    <span className="admin-navlabel">{label}</span>
                    {count > 0 && <span className="admin-count" aria-label={`${count} to send`}>{count}</span>}
                  </a>
                );
              })}
            </nav>
            <div className="admin-me">
              <span className="admin-avatar" aria-hidden="true">{(me[0] ?? "C").toUpperCase()}</span>
              <div>
                <b>{me || "Counselor"}</b>
                <button type="button" className="admin-linkbtn" onClick={signOut}>Sign out</button>
              </div>
            </div>
          </aside>
          <div className="admin-main">{children}</div>
        </div>
      </Ctx.Provider>
    </NoFamilyChrome>
  );
}

/** Before the portal opens (signed out, signing a school up, waiting for approval): just the brand and the card. */
function Bare({ children }: { children: ReactNode }) {
  return (
    <NoFamilyChrome>
      <div className="portal-bare">
        <a href="/school" className="admin-brand">
          <BrandMark className="admin-logo" />
          <span><b>ScholarTasks</b><small>School portal</small></span>
        </a>
        <main className="page">{children}</main>
      </div>
    </NoFamilyChrome>
  );
}

function Intro() {
  return (
    <div className="panel">
      <p className="eyebrow">Free for every school</p>
      <h1>See which students need you, without the spreadsheets</h1>
      <ul style={{ margin: "8px 0 0", paddingLeft: 20, lineHeight: 1.6 }}>
        <li>Families connect with your school's code and choose what to share.</li>
        <li>See who hasn't filed the FAFSA, who has no college list, and who has overdue deadlines.</li>
        <li>Send transcripts and letters students ask for, and check them off.</li>
        <li>Email a whole grade, post local scholarships and school events.</li>
      </ul>
      <p className="hint" style={{ margin: "12px 0 0" }}>
        The school portal is free. Families use ScholarTasks free, and can upgrade for the AI counselor and tutor.
        You only see what each family chooses to share, and every look is recorded.
      </p>
    </div>
  );
}

export function SignUp({ onDone }: { onDone: () => void }) {
  const sb = supabase();
  const [f, setF] = useState({ name: "", city: "", state: "GA", website: "", phone: "", full_name: "", job_title: "School counselor" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const ok = f.name.trim().length >= 3 && f.city.trim().length >= 2 && f.full_name.trim().length >= 2;
  return (
    <div className="panel">
      <h2>Set up your school</h2>
      <p className="hint">You'll be the school's admin and can add other counselors with a staff code.</p>
      <div className="row">
        <div className="field"><label htmlFor="s-name">School name</label><input id="s-name" className="input" value={f.name} onChange={set("name")} placeholder="e.g. Central High School" /></div>
        <div className="field"><label htmlFor="s-city">City</label><input id="s-city" className="input" value={f.city} onChange={set("city")} /></div>
        <div className="field" style={{ flex: "0 1 110px" }}><label htmlFor="s-state">State</label>
          <input id="s-state" className="input" maxLength={2} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value.toUpperCase() })} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="s-web">School website (helps us confirm it)</label><input id="s-web" className="input" value={f.website} onChange={set("website")} placeholder="https://" /></div>
        <div className="field"><label htmlFor="s-phone">School phone</label><input id="s-phone" className="input" value={f.phone} onChange={set("phone")} /></div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="field"><label htmlFor="s-you">Your name</label><input id="s-you" className="input" value={f.full_name} onChange={set("full_name")} /></div>
        <div className="field"><label htmlFor="s-title">Your job title</label><input id="s-title" className="input" value={f.job_title} onChange={set("job_title")} /></div>
        <button
          className="btn btn-inline"
          disabled={!ok || busy}
          onClick={async () => {
            if (!sb) return;
            setBusy(true); setErr(null);
            const website = f.website.trim() && !/^https?:\/\//i.test(f.website.trim()) ? `https://${f.website.trim()}` : f.website.trim();
            const { error } = await sb.rpc("create_school", {
              p_name: f.name, p_city: f.city, p_state: f.state, p_website: website || null,
              p_phone: f.phone || null, p_full_name: f.full_name, p_job_title: f.job_title || null,
            });
            setBusy(false);
            if (error) setErr(friendly(error)); else onDone();
          }}
        >
          {busy ? "Sending…" : "Set up school"}
        </button>
      </div>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </div>
  );
}

export function JoinStaff({ onDone }: { onDone: () => void }) {
  const sb = supabase();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("staff");
    if (c) setCode(c.toUpperCase());
  }, []);
  return (
    <div className="panel">
      <h2>Your school is already set up?</h2>
      <p className="hint">Ask the person who set it up for the staff code.</p>
      <div className="row">
        <div className="field"><label htmlFor="j-code">Staff code</label>
          <input id="j-code" className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} /></div>
        <div className="field"><label htmlFor="j-name">Your name</label><input id="j-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <button
          className="btn btn-inline"
          disabled={code.trim().length < 8 || name.trim().length < 2}
          onClick={async () => {
            if (!sb) return;
            setErr(null);
            const { error } = await sb.rpc("join_school_staff", { p_code: code, p_full_name: name, p_job_title: "School counselor" });
            if (error) setErr(friendly(error)); else onDone();
          }}
        >
          Join school
        </button>
      </div>
      {err && <p className="note note-err" role="alert">{err}</p>}
    </div>
  );
}
