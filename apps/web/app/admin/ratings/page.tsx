"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../../lib/supabase";
import { NotConfigured, Page } from "../../ui";

interface Rating { user_id: string; stars: number; note: string | null; platform: string; updated_at: string }
const WHERE: Record<string, string> = { web: "Website", ios: "iPhone app", android: "Android app" };

/** Team view of every "Rate ScholarTasks" rating: the average, how many of each, and the notes (newest first). */
export default function RatingsPage() {
  const sb = supabase();
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);
  const [rows, setRows] = useState<Rating[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [onlyNotes, setOnlyNotes] = useState(true);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/admin/ratings");
    const isAdmin = await sb.rpc("is_app_admin");
    setAdmin(isAdmin.data === true);
    if (isAdmin.data !== true) return;
    const { data, error: e } = await sb.from("app_ratings").select("user_id, stars, note, platform, updated_at").order("updated_at", { ascending: false });
    if (e) setError(friendly(e));
    setRows((data as Rating[]) ?? []);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const title = "App ratings";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (admin === false) return <Page title={title}><p className="hint">This page is for the ScholarTasks team.</p></Page>;

  const avg = rows.length ? rows.reduce((t, r) => t + r.stars, 0) / rows.length : 0;
  const count = (n: number) => rows.filter((r) => r.stars === n).length;
  const shown = onlyNotes ? rows.filter((r) => r.note) : rows;

  return (
    <Page title={title}>
      <p className="hint">What families and students said on the Rate ScholarTasks page. Each person has one rating (rating again replaces it). Notes are also emailed to support@scholartasks.com.</p>
      {error && <p className="note note-err">{error}</p>}
      <div className="panel">
        <h2>{rows.length ? `${avg.toFixed(1)} of 5 stars` : "No ratings yet"}</h2>
        <p className="hint">{rows.length} rating{rows.length === 1 ? "" : "s"}</p>
        {[5, 4, 3, 2, 1].map((n) => (
          <div key={n} className="hint" style={{ margin: "2px 0" }}>
            <span className="star-text" style={{ color: "var(--gold)" }}>{"★".repeat(n)}</span> {count(n)}
          </div>
        ))}
      </div>
      <div className="panel">
        <h2>Notes</h2>
        <label className="hint" style={{ display: "block", marginBottom: 8 }}>
          <input type="checkbox" checked={onlyNotes} onChange={(e) => setOnlyNotes(e.target.checked)} /> Only ratings with a note
        </label>
        {shown.length === 0 && <p className="hint">Nothing here yet.</p>}
        {shown.map((r) => (
          <div key={r.user_id} className="rating-row">
            <div><span className="star-text">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span> <span className="pill">{WHERE[r.platform] ?? r.platform}</span> <span className="hint" style={{ fontSize: 13 }}>{new Date(r.updated_at).toLocaleDateString()}</span></div>
            {r.note && <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{r.note}</p>}
          </div>
        ))}
      </div>
    </Page>
  );
}
