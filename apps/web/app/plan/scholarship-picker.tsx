"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ScholarshipHit { id: string; name: string; url: string; amount_max: number | null; deadline: string | null; deadline_text: string | null }

/**
 * Type a scholarship's name on the plan and the app's own scholarship list fills in the due date,
 * amount and link (Constant, 2026-11-07: forms should fill from the database). Anything not in the
 * list can still be typed by hand.
 */
export function ScholarshipPicker({ sb, id, value, onChange }: {
  sb: SupabaseClient; id: string; value: string;
  onChange: (name: string, hit: ScholarshipHit | null) => void;
}) {
  const [hits, setHits] = useState<ScholarshipHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const term = value.trim().replace(/[%_,()]/g, " ");
    if (term.length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      const { data } = await sb.from("scholarships").select("id, name, url, amount_max, deadline, deadline_text")
        .ilike("name", `%${term.split(/\s+/).join("%")}%`).order("name").limit(8);
      if (n === seq.current) { setHits((data as ScholarshipHit[]) ?? []); setActive(0); }
    }, 180);
    return () => clearTimeout(t);
  }, [sb, value]);

  const pick = (h: ScholarshipHit) => { onChange(h.name, h); setOpen(false); };

  return (
    <div className="picker">
      <input
        id={id} className="input" autoComplete="off" placeholder="e.g. Coca-Cola Scholars" value={value}
        role="combobox" aria-expanded={open && hits.length > 0} aria-controls={`${id}-list`}
        onChange={(e) => { onChange(e.target.value, null); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!open || !hits.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && hits[active]) { e.preventDefault(); pick(hits[active]!); }
        }}
      />
      {open && hits.length > 0 && (
        <ul id={`${id}-list`} className="picker-list" role="listbox">
          {hits.map((h, i) => (
            <li key={h.id}>
              <button type="button" className="picker-item" role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                <b>{h.name}</b> <span className="hint">{h.deadline ? `due ${new Date(h.deadline + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : h.deadline_text ?? ""}{h.amount_max ? ` · up to $${h.amount_max.toLocaleString()}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
