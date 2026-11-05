"use client";

import { useEffect, useRef, useState } from "react";
import { searchCourses, subjectOf } from "./courses";

/**
 * A course box with a dropdown of common courses grouped by subject (A to Z)
 * that filters as you type. Any course name can still be typed by hand.
 */
export function CoursePicker({ value, onChange, onPick, id = "g-course" }: { value: string; onChange: (v: string) => void; onPick: (course: string, core: boolean) => void; id?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const groups = searchCourses(value);

  return (
    <div className="picker" ref={box}>
      <input
        id={id}
        className="input"
        placeholder="Search or pick a course"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      />
      {open && (
        <div className="picker-list" id={`${id}-list`} role="listbox">
          {groups.length === 0 ? (
            <p className="hint" style={{ margin: 8 }}>Not in the list. That's fine, the name you typed will be used.</p>
          ) : (
            groups.map((g) => (
              <div key={g.name}>
                <p className="picker-group">{g.name}{g.core ? " · core class" : ""}</p>
                {g.courses.map((c) => (
                  <button
                    type="button"
                    role="option"
                    aria-selected={c === value}
                    key={c}
                    className="picker-item"
                    onClick={() => { onPick(c, subjectOf(c)?.core ?? false); setOpen(false); }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
