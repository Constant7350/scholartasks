"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParentSave, PickKind } from "../../lib/parent-space";

const ICON: Record<PickKind, string> = { college: "🏫", scholarship: "💰", career: "💼", trade: "🔧" };
const linkFor = (r: ParentSave) =>
  r.kind === "trade" ? `/trades/${r.item_key}` : r.kind === "career" ? `/majors?q=${encodeURIComponent(r.name)}` : r.kind === "scholarship" ? "/scholarships" : "/colleges";

/** Parents: the way into their own space, with what's on their lists. */
export function ParentSpaceCard({ sb, firstName }: { sb: SupabaseClient; firstName: string | null }) {
  const [counts, setCounts] = useState<{ saved: number; shared: number } | null>(null);
  useEffect(() => {
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return;
      const { data } = await sb.from("parent_saves").select("shared").eq("user_id", s.session.user.id);
      const rows = (data as { shared: boolean }[]) ?? [];
      setCounts({ saved: rows.length, shared: rows.filter((r) => r.shared).length });
    })();
  }, [sb]);
  const who = firstName ?? "your student";
  return (
    <div className="panel family-card ps-card">
      <div>
        <h2>👤 My parent space</h2>
        <p className="hint" style={{ margin: 0 }}>
          Search colleges and scholarships for yourself, keep your own lists and notes, and look over {who}&apos;s career quiz. Nothing you save there shows as {who}&apos;s work.
          {counts && counts.saved > 0 ? ` You have ${counts.saved} saved, ${counts.shared} shared with ${who}.` : ""}
        </p>
      </div>
      <a className="btn btn-inline link-btn" href="/parent">Open my space</a>
    </div>
  );
}

/** Students: colleges, scholarships and careers a parent chose to share. */
export function ParentIdeasCard({ sb }: { sb: SupabaseClient }) {
  const [rows, setRows] = useState<ParentSave[]>([]);
  useEffect(() => {
    // Students only ever receive shared picks (database rule), so no filter is needed here.
    void sb.from("parent_saves").select("*").order("updated_at", { ascending: false }).limit(12)
      .then(({ data }) => setRows((data as ParentSave[]) ?? []));
  }, [sb]);
  if (!rows.length) return null;
  return (
    <section className="panel ps-ideas">
      <h2>💡 Ideas from your parents</h2>
      <p className="hint">Your parents shared these with you. They&apos;re ideas to talk about, not decisions.</p>
      <ul className="items">
        {rows.map((r) => (
          <li key={r.id}>
            <div className="item-main">
              <b><span aria-hidden="true">{ICON[r.kind]}</span> <a href={linkFor(r)}>{r.name}</a></b>
              {r.pick === "maybe" && <span className="hint small">Maybe</span>}
              {r.note && <span className="hint">“{r.note}”</span>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
