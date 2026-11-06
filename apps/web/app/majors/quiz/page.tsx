"use client";

import { useMemo, useState } from "react";
import { CAREER_INTERESTS, careerYears, isTradeInterest, matchCareers, matchTrades, payLine, type CareerInterest } from "@scholartasks/core";
import { Page } from "../../ui";
import { TRADES } from "../../../lib/trades";

const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

/**
 * "Which career fits me?": pick what you enjoy, see college careers and skilled
 * trades side by side, each linked to the colleges or training that lead there.
 * Open to everyone, no sign-in, nothing saved.
 */
export default function CareerQuiz() {
  const [picked, setPicked] = useState<CareerInterest[]>([]);
  const [path, setPath] = useState<"all" | "college" | "trade">("all");
  const toggle = (i: CareerInterest) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const careers = useMemo(() => matchCareers(picked, 8), [picked]);
  const trades = useMemo(() => matchTrades(TRADES, picked.filter(isTradeInterest), 6), [picked]);

  return (
    <Page title="Which career fits me?">
      <p className="hint"><a href="/majors">← Search colleges by major</a> · <a href="/trades">Trades</a></p>
      <section className="panel">
        <h2>What do you enjoy?</h2>
        <p className="hint">Pick everything that sounds like you. You&apos;ll see careers that need college and skilled trades you can train for, with real pay and how long it takes.</p>
        <div className="chips">
          {(Object.keys(CAREER_INTERESTS) as CareerInterest[]).map((i) => (
            <button key={i} className={`chip${picked.includes(i) ? " chip-on" : ""}`} aria-pressed={picked.includes(i)} onClick={() => toggle(i)}>{CAREER_INTERESTS[i]}</button>
          ))}
        </div>
        {picked.length > 0 && (
          <div className="tabs" role="tablist" style={{ maxWidth: 420, marginTop: 12 }}>
            {([["all", "Both paths"], ["college", "College"], ["trade", "Trades"]] as const).map(([k, l]) => (
              <button key={k} role="tab" aria-selected={path === k} onClick={() => setPath(k)}>{l}</button>
            ))}
          </div>
        )}
      </section>

      {picked.length > 0 && path !== "trade" && (
        <section className="panel">
          <h2>Careers through college</h2>
          {careers.length === 0 ? <p className="hint">None yet. Try picking a school subject you like.</p> : (
            <ol className="items">
              {careers.map(({ key, career, score, fieldId }) => (
                <li key={key}>
                  <div className="item-main">
                    <b>{career.name}</b>
                    <span className="hint">{usd(career.pay)} typical pay in the US · {career.education} · {careerYears(career)} after high school</span>
                    <span className="hint small">Fits {score} of your picks · jobs {career.growth >= 0 ? `growing ${career.growth}%` : `shrinking ${-career.growth}%`} over 10 years · <a href={career.url} target="_blank" rel="noopener noreferrer">U.S. Labor Department details</a></span>
                  </div>
                  <div className="item-actions">
                    <a className="btn btn-inline btn-sm link-btn" href={fieldId ? `/majors?field=${fieldId}` : `/majors?q=${encodeURIComponent(career.name)}`}>Colleges for this</a>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {picked.length > 0 && path !== "college" && (
        <section className="panel">
          <h2>Skilled trades</h2>
          {trades.length === 0 ? <p className="hint">No trades match these picks. Try building, machines, outdoors or helping people.</p> : (
            <ol className="items">
              {trades.map(({ trade, score }) => (
                <li key={trade.slug}>
                  <div className="item-main">
                    <b>{trade.name}</b>
                    <span className="hint">{trade.summary}</span>
                    <span className="hint small">{payLine(trade)} · fits {score} of your picks{trade.hope_career_grant ? " · tuition-free in Georgia" : ""}</span>
                  </div>
                  <div className="item-actions"><a className="btn btn-inline btn-sm link-btn" href={`/trades/${trade.slug}`}>How to start</a></div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {picked.includes("serving") && (
        <section className="panel">
          <h2>Military paths</h2>
          <p className="hint">Serve as an officer after a service academy or ROTC (college paid for), study at a military college, or enlist and get paid training in hundreds of jobs, many of them trades. The GI Bill can pay for college or trade school later.</p>
          <a className="btn btn-inline btn-sm link-btn" href="/military">Compare military paths</a>
        </section>
      )}

      {picked.length > 0 && (
        <p className="hint small">This is a starting point, not a test. Pay is the U.S. median (half earn more, half less) and varies by state. Try a job shadow, a summer program or a class in the subject, and talk it over with your family and the <a href="/counselor">AI counselor</a>.</p>
      )}
    </Page>
  );
}
