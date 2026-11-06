"use client";

import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { faithLabel } from "@scholartasks/core";
import { OWNERSHIP, searchColleges, type CollegeRow } from "../../lib/colleges";

/**
 * Type a college name and pick it from the federal list, so its costs and
 * facts come along. Anything typed that isn't on the list still works.
 */
export function CollegePicker({ sb, id, value, onChange }: {
  sb: SupabaseClient; id: string; value: string;
  onChange: (name: string, college: CollegeRow | null) => void;
}) {
  const [hits, setHits] = useState<CollegeRow[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    const t = setTimeout(async () => {
      const rows = await searchColleges(sb, value).catch(() => []);
      if (n === seq.current) { setHits(rows); setActive(0); }
    }, 180);
    return () => clearTimeout(t);
  }, [sb, value]);

  const pick = (c: CollegeRow) => { onChange(c.name, c); setOpen(false); };

  return (
    <div className="picker">
      <input
        id={id} className="input" autoComplete="off" placeholder="Start typing, e.g. Georgia Southern" value={value}
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
          {hits.map((c, i) => (
            <li key={c.id}>
              <button type="button" className="picker-item" role="option" aria-selected={i === active} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}>
                <b>{c.name}</b> <span className="hint">{c.city ? `${c.city}, ` : ""}{c.state} · {OWNERSHIP[c.ownership]}{faithLabel(c.religious_affiliation) ? ` · ${faithLabel(c.religious_affiliation)}` : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
