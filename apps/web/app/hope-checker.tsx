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
    <section className="panel">
      <h2>Georgia HOPE and Zell Miller checker</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="hc-course">Core course</label>
          <input id="hc-course" className="input" placeholder="e.g. Algebra II" value={course} onChange={(e) => setCourse(e.target.value)} />
        </div>
        <div className="field" style={{ flex: "0 1 90px" }}>
          <label htmlFor="hc-grade">Grade</label>
          <select id="hc-grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value as CourseGrade["grade"])}>
            {LETTERS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "0 1 130px" }}>
          <label htmlFor="hc-level">Level</label>
          <select id="hc-level" className="input" value={level} onChange={(e) => setLevel(e.target.value as CourseGrade["level"])}>
            {LEVELS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <button className="btn btn-inline" onClick={add} disabled={!course.trim()}>Add course</button>
      </div>
      <div className="field" style={{ maxWidth: 220, marginTop: 14 }}>
        <label htmlFor="hc-sat">SAT score (optional)</label>
        <input id="hc-sat" className="input" placeholder="e.g. 1200" value={sat} inputMode="numeric" onChange={(e) => setSat(e.target.value.replace(/\D/g, ""))} />
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
