"use client";

import { useMemo, useState } from "react";
import { checkablePrograms, displayGpa, evaluateStatePrograms, primaryGpa, type CourseGrade } from "@scholartasks/core";
import { PACKED_STATES, packFor } from "../lib/state-packs";

const LETTERS = ["A", "B", "C", "D", "F"] as const;
const LEVELS = ["standard", "honors", "AP", "IB", "DE"] as const;
/** States with a grade-based scholarship to check. */
const STATES = PACKED_STATES.filter((p) => checkablePrograms(p).length > 0);

export function HopeChecker({ initialState = "GA" }: { initialState?: string }) {
  const [state, setState] = useState(STATES.some((s) => s.state === initialState) ? initialState : "GA");
  const [grades, setGrades] = useState<CourseGrade[]>([]);
  const [course, setCourse] = useState("");
  const [grade, setGrade] = useState<CourseGrade["grade"]>("A");
  const [level, setLevel] = useState<CourseGrade["level"]>("standard");
  const [sat, setSat] = useState("");
  const [act, setAct] = useState("");
  const pack = packFor(state)!;
  const label = primaryGpa(pack)?.label ?? "GPA";

  const results = useMemo(
    () => evaluateStatePrograms({ state, gradeLevel: 10, grades, sat: sat ? Number(sat) : undefined, act: act ? Number(act) : undefined }, pack),
    [grades, sat, act, state, pack],
  );

  const add = () => {
    if (!course.trim()) return;
    setGrades([...grades, { term: "current", course: course.trim(), grade, level, core: true, gradeLevel: 10 }]);
    setCourse("");
  };

  return (
    <section className="panel">
      <h2>{pack.name} scholarship checker</h2>
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="hc-state">State you live in</label>
        <select id="hc-state" className="input" value={state} onChange={(e) => setState(e.target.value)}>
          {STATES.map((s) => <option key={s.state} value={s.state}>{s.name}</option>)}
        </select>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
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
      <div className="row" style={{ marginTop: 14 }}>
        <div className="field" style={{ maxWidth: 200 }}>
          <label htmlFor="hc-sat">SAT score (optional)</label>
          <input id="hc-sat" className="input" placeholder="e.g. 1200" value={sat} inputMode="numeric" onChange={(e) => setSat(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="field" style={{ maxWidth: 200 }}>
          <label htmlFor="hc-act">ACT score (optional)</label>
          <input id="hc-act" className="input" placeholder="e.g. 25" value={act} inputMode="numeric" onChange={(e) => setAct(e.target.value.replace(/\D/g, ""))} />
        </div>
      </div>
      <ul>
        {grades.map((g, i) => (
          <li key={i}>{g.course}: {g.grade} ({g.level})</li>
        ))}
      </ul>
      {results.map((r) => (
        <div key={r.programId} style={{ marginTop: 12 }}>
          <strong>{r.programName}</strong>: {r.status === "eligible" ? "on track to qualify" : "not yet"}
          {r.gpa !== null && <span> ({label} {displayGpa(r.gpa)})</span>}
          <ul>
            {r.gaps.map((g, i) => <li key={i}>{g.message}</li>)}
            {r.checks.map((c, i) => <li key={`c${i}`} className="hint">Also needed: {c}</li>)}
          </ul>
        </div>
      ))}
      <p className="hint" style={{ fontSize: 12 }}>
        Rules for {pack.name} come from a draft data pack still being checked with the {pack.agency.name}. Confirm on <a href={pack.aid_site?.url ?? pack.agency.url} target="_blank" rel="noreferrer noopener">{pack.aid_site?.name ?? pack.agency.name}</a>.
      </p>
    </section>
  );
}
