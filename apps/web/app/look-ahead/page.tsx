"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { NotConfigured, Page } from "../ui";
import { Icon } from "../icons";
import { ParentsOnlyForNow } from "./gate";

interface Student { id: string; first_name: string; grade_level: number }

/**
 * Look ahead (Constant, 2026-11-08): while a student is in grades 6 to 8, colleges and scholarships are for
 * parents only and sit behind this one tile instead of filling the menu. The student's own app doesn't show them.
 */
export default function LookAheadPage() {
  const sb = supabase();
  const [ready, setReady] = useState(false);
  const [isParent, setIsParent] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();

  useEffect(() => {
    if (!sb) return;
    void (async () => {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) return window.location.replace("/signin?next=/look-ahead");
      const [mem, st] = await Promise.all([
        sb.from("family_members").select("role").eq("user_id", s.session.user.id),
        sb.from("students").select("id, first_name, grade_level").order("first_name"),
      ]);
      setIsParent(((mem.data as { role: string }[]) ?? []).some((m) => m.role === "parent"));
      const list = (st.data as Student[]) ?? [];
      setStudents(list);
      setCurrent((c) => c ?? pickStudent(list, list[0]?.id));
      setReady(true);
    })();
  }, [sb, setCurrent]);

  const title = "Look ahead";
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (!ready) return <Page title={title}><p className="hint">Loading…</p></Page>;
  if (!isParent) return <ParentsOnlyForNow title={title} />;
  const student = students.find((s) => s.id === current) ?? students[0];
  const tiles: [string, string, string][] = [
    ["🔎", "Find colleges", "/colleges"],
    ["🧭", "Colleges by major", "/majors"],
    ["💰", "Scholarships", "/scholarships"],
    ["🗂️", "College list", "/plan"],
  ];

  return (
    <Page title={title}>
      {students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === student?.id} onClick={() => setCurrent(s.id)}>{s.first_name}</button>)}
        </div>
      )}
      <p className="hint" style={{ marginTop: 0 }}>
        {student ? <>Colleges and scholarships, for parents only while {student.first_name} is in grades 6 to 8. {student.first_name} sees them in 9th grade.</> : "Colleges and scholarships, for parents only while your student is in grades 6 to 8."}
      </p>
      <nav className="home-grid home-grid-top" aria-label="Look ahead">
        {tiles.map(([icon, label, href]) => <a key={href} href={href}><Icon of={icon} />{label}</a>)}
      </nav>
    </Page>
  );
}
