"use client";

import { useMemo, useState } from "react";
import { TRADE_INTERESTS, matchTrades, payLine, type TradeInterest } from "@scholartasks/core";
import { Page } from "../../ui";
import { TRADES } from "../../../lib/trades";
import "../trades.css";

/** A short quiz: pick what you enjoy and see trades that fit. Open to everyone. */
export default function TradeQuiz() {
  const [picked, setPicked] = useState<TradeInterest[]>([]);
  const [paidOnly, setPaidOnly] = useState(false);
  const toggle = (i: TradeInterest) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));

  const results = useMemo(() => {
    const pool = paidOnly ? TRADES.filter((t) => t.paths.some((p) => p.kind === "union" || p.kind === "apprenticeship" || p.kind === "job")) : TRADES;
    return matchTrades(pool, picked, 8);
  }, [picked, paidOnly]);

  return (
    <Page title="Which trade fits me?">
      <p className="hint"><a href="/trades">← All trades</a> · Want college careers too? <a href="/majors/quiz">Take the full career quiz</a></p>
      <section className="panel">
        <h2>What do you enjoy?</h2>
        <p className="hint">Pick as many as you like. The more you pick, the better the match.</p>
        <div className="chips trade-chips">
          {(Object.keys(TRADE_INTERESTS) as TradeInterest[]).map((i) => (
            <button key={i} className={`chip${picked.includes(i) ? " chip-on" : ""}`} aria-pressed={picked.includes(i)} onClick={() => toggle(i)}>{TRADE_INTERESTS[i]}</button>
          ))}
        </div>
        <label className="check"><input id="quiz-paid" type="checkbox" checked={paidOnly} onChange={(e) => setPaidOnly(e.target.checked)} /> I'd like to get paid while I train (apprenticeships)</label>
      </section>

      {picked.length > 0 && (
        <section className="panel">
          <h2>Trades to look at</h2>
          {results.length === 0 ? <p className="hint">No matches yet. Try picking something else.</p> : (
            <ol className="items">
              {results.map(({ trade, score }) => (
                <li key={trade.slug}>
                  <div className="item-main">
                    <b><a href={`/trades/${trade.slug}`}>{trade.name}</a></b>
                    <span className="hint">{trade.summary}</span>
                    <span className="hint">{payLine(trade)} · fits {score} of your picks{trade.hope_career_grant ? " · tuition-free in Georgia" : ""}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="hint small">This is a starting point, not a test. Talk it over with your family, try a shop class or job shadow, and ask the <a href="/counselor">AI counselor</a>.</p>
        </section>
      )}
    </Page>
  );
}
