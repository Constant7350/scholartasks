"use client";

import { useMemo, useState } from "react";
import { displayGpa, evaluateStatePrograms, type CourseGrade, type StatePack } from "@scholartasks/core";
import gaPack from "../../../packs/states/GA.json";

const GA = gaPack as unknown as StatePack;
const LETTERS = ["A", "B", "C", "D", "F"] as const;
const LEVELS = ["standard", "honors", "AP", "IB", "DE"] as const;

export function HopeChecker() {
  const [grades, setGrades] = useState<CourseGrade[]>([]);
  const [course, setCourse] = useState("");
  const [grade, setGrade] = useState<CourseGrade["grade"]>("A");
  const [level, setLevel] = useState<CourseGrade["level"]>("standard");
  const [sat, setSat] = useState("");

  const results = useMemo(
    () => evaluateStatePrograms({ state: "GA", gradeLevel: 10, grades, sat: sat ? Number(sat) : undefined }, GA),
    [grades, sat],
  );

  const add = () => {
    if (!course.trim()) return;
    setGrades([...grades, { term: "current", course: course.trim(), grade, level, core: true, gradeLevel: 10 }]);
    setCourse("");
  };

  return (
    <section style={{ background: "#fff", borderRadius: 12, padding: 16, margin: "24px 0", border: "1px solid #e4e4e0" }}>
      <h2 style={{ marginTop: 0 }}>Georgia HOPE and Zell Miller checker</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input aria-label="Core course" placeholder="Core course" value={course} onChange={(e) => setCourse(e.target.value)} />
        <select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value as CourseGrade["grade"])}>
          {LETTERS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value as CourseGrade["level"])}>
          {LEVELS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <button onClick={add}>Add course</button>
        <input aria-label="SAT score" placeholder="SAT (optional)" value={sat} inputMode="numeric" onChange={(e) => setSat(e.target.value.replace(/\D/g, ""))} />
      </div>
      <ul>
        {grades.map((g, i) => (
          <li key={i}>{g.course}: {g.grade} ({g.level})</li>
        ))}
      </ul>
      {results.map((r) => (
        <div key={r.programId} style={{ marginTop: 12 }}>
          <strong>{r.programName}</strong>: {r.status === "eligible" ? "on track to qualify" : "not yet"}
          {r.gpa !== null && <span> (HOPE GPA {displayGpa(r.gpa)})</span>}
          <ul>
            {r.gaps.map((g, i) => <li key={i}>{g.message}</li>)}
          </ul>
        </div>
      ))}
    </section>
  );
}
