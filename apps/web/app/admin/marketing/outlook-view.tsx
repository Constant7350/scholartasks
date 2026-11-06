"use client";

import { useState } from "react";
import { ASSUME, CASES, LEVERS, MARKET_NOTES, OUTLOOK_RISKS, OUTLOOK_SOURCES, VALUE_NOTES, cashNeeded, project } from "./outlook";

/** "$1.2M", "$340k", "$900" */
export function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}k`;
  return `${sign}$${Math.round(a)}`;
}

/** The five-year outlook tab on /admin/marketing. All numbers come from outlook.ts. */
export function Outlook() {
  const [id, setId] = useState<(typeof CASES)[number]["id"]>("expected");
  const c = CASES.find((x) => x.id === id)!;
  const rows = project(c);
  const last = rows[rows.length - 1]!;
  const maxRev = Math.max(...rows.map((r) => r.revenue));
  return (
    <>
      <section className="panel">
        <h2>Revenue and company value, 2027 to 2031</h2>
        <p className="hint">Three ways it could go. Pick one to see its numbers. These are planning estimates worked out from the assumptions at the bottom, not promises.</p>
        <div className="share-row" role="radiogroup" aria-label="Which case">
          {CASES.map((x) => (
            <button key={x.id} role="radio" aria-checked={x.id === id} className={`btn btn-inline btn-sm ${x.id === id ? "" : "btn-ghost"}`} onClick={() => setId(x.id)}>{x.name}</button>
          ))}
        </div>
        <p style={{ marginTop: 10 }}>{c.summary}</p>
        <div className="mk-stats">
          <div className="mk-stat"><span className="mk-stat-value">{usd(last.revenue)}</span><span className="mk-stat-label">Revenue in 2031</span></div>
          <div className="mk-stat"><span className="mk-stat-value">{usd(last.profit)}</span><span className="mk-stat-label">Profit in 2031</span></div>
          <div className="mk-stat"><span className="mk-stat-value">{usd(last.value)}</span><span className="mk-stat-label">Company value, end of 2031</span><span className="hint">{c.multiple}x yearly revenue</span></div>
          <div className="mk-stat"><span className="mk-stat-value">{last.families.toLocaleString()}</span><span className="mk-stat-label">Paying families</span><span className="hint">{((last.families / ASSUME.usFamilies) * 100).toFixed(2)}% of US families with a teen</span></div>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>Value range at the end of 2031 (2x to 6x yearly revenue): {usd(last.runRate * 2)} to {usd(last.runRate * 6)}. Money needed before it pays for itself: about {usd(cashNeeded(rows))}.</p>
        <div className="bars" style={{ marginTop: 12 }}>
          {rows.map((r) => (
            <div key={r.year} className="bar-row">
              <span className="bar-label">{r.year}</span>
              <span className="bar-track"><span className="bar-fill" style={{ width: `${Math.max(1, (r.revenue / maxRev) * 100)}%` }} /></span>
              <span className="bar-value">{usd(r.revenue)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Year by year</h2>
        <div className="mk-table-wrap">
          <table className="mk-table">
            <thead><tr><th>Year</th><th>Paying families</th><th>School students</th><th>Revenue</th><th>Costs</th><th>Profit</th><th>Value at year end</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.year}>
                <td>{r.year}</td><td>{r.families.toLocaleString()}</td><td>{r.schoolStudents.toLocaleString()}</td>
                <td>{usd(r.revenue)}</td><td>{usd(r.costs)}</td>
                <td style={{ color: r.profit < 0 ? "#b42318" : undefined }}>{usd(r.profit)}</td><td>{usd(r.value)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>All three side by side (2031)</h2>
        <div className="mk-table-wrap">
          <table className="mk-table">
            <thead><tr><th>Case</th><th>Paying families</th><th>Revenue</th><th>Profit</th><th>Company value</th></tr></thead>
            <tbody>{CASES.map((x) => { const l = project(x)[4]!; return (
              <tr key={x.id}><td>{x.name}</td><td>{l.families.toLocaleString()}</td><td>{usd(l.revenue)}</td><td>{usd(l.profit)}</td><td>{usd(l.value)}</td></tr>
            ); })}</tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>How the app earns it</h2>
        <ul className="mk-list">{LEVERS.map((l) => <li key={l.title}><b>{l.title}.</b> {l.text}</li>)}</ul>
      </section>
      <section className="panel">
        <h2>The market</h2>
        <ul className="mk-list">{MARKET_NOTES.map((m) => <li key={m}>{m}</li>)}</ul>
      </section>
      <section className="panel">
        <h2>How company value is worked out</h2>
        <ul className="mk-list">{VALUE_NOTES.map((m) => <li key={m}>{m}</li>)}</ul>
      </section>
      <section className="panel">
        <h2>Assumptions</h2>
        <ul className="mk-list">
          <li>Each paying family brings about ${ASSUME.familyPlanPerYear} a year for the Family plan, plus Homework Helper (${ASSUME.homeworkPerYear} a year) for {ASSUME.homeworkShare * 100}% of them, plus about ${ASSUME.packsPerYear} in message packs.</li>
          <li>School Plus: ${ASSUME.schoolPerStudent} per student per year.</li>
          <li>Serving costs: ${ASSUME.costPerPayingFamily} a year per paying family, ${ASSUME.costPerHomework} more with Homework Helper, ${ASSUME.costPerFreeFamily} per free family ({ASSUME.freePerPaying} free for every paying family), ${ASSUME.costPerSchoolStudent} per school student.</li>
          <li>Team, hosting, tools, legal and insurance: {ASSUME.teamShare * 100}% of revenue plus {usd(ASSUME.teamBase)} a year. Marketing: {c.marketingShare * 100}% of revenue in this case.</li>
          <li>Revenue in a year uses the average number of customers during that year.</li>
        </ul>
      </section>
      <section className="panel">
        <h2>What could change these numbers</h2>
        <ul className="mk-list">{OUTLOOK_RISKS.map((m) => <li key={m}>{m}</li>)}</ul>
        <h2 style={{ marginTop: 16 }}>Sources</h2>
        <ul className="mk-list">{OUTLOOK_SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}</ul>
      </section>
    </>
  );
}
