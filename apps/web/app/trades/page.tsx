"use client";

import { useMemo, useState } from "react";
import { TRADE_CATEGORIES, payLine, type TradeCategory } from "@scholartasks/core";
import { Page } from "../ui";
import { TRADES, TRADES_PACK } from "../../lib/trades";
import { TradeAidList } from "./aid-list";
import { TradeGradeSteps } from "./grade-steps";
import "./trades.css";

/**
 * Trades explorer: skilled careers you can train for in months or a few
 * years instead of a four-year degree. Open to everyone, signed in or not.
 */
export default function TradesPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<TradeCategory | "all">("all");
  const [free, setFree] = useState(false);
  const [sort, setSort] = useState<"pay" | "name">("pay");

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return TRADES
      .filter((t) => cat === "all" || t.category === cat)
      .filter((t) => !free || t.hope_career_grant)
      .filter((t) => !term || `${t.name} ${t.summary} ${t.work}`.toLowerCase().includes(term))
      .sort((a, b) => sort === "name" ? a.name.localeCompare(b.name)
        : (b.pay.ga_typical ?? b.pay.us_typical ?? 0) - (a.pay.ga_typical ?? a.pay.us_typical ?? 0));
  }, [q, cat, free, sort]);

  const freeCount = TRADES.filter((t) => t.hope_career_grant).length;

  return (
    <Page title="Trades and trade schools">
      <p className="lead">
        A trade is a skilled career you can train for in weeks, months or a few years, often while getting paid.
        Pick one to see what it pays, how to train for it in Georgia and anywhere in the U.S., and the steps to apply.
      </p>

      <div className="trade-callouts">
        <a className="panel trade-callout" href="/trades/quiz">
          <b>Not sure where to start?</b>
          <span>Answer a few questions and see trades that fit what you enjoy.</span>
        </a>
        <div className="panel trade-callout">
          <b>Free tuition in Georgia</b>
          <span>{freeCount} of these trades are on Georgia's HOPE Career Grant list: with the HOPE Grant, tuition is covered at Georgia's 22 technical colleges. No high school GPA is needed.</span>
        </div>
      </div>

      <section className="panel">
        <label className="field">
          <span>Search trades</span>
          <input id="trade-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try welding, nurse, horses, computers…" />
        </label>
        <div className="chips trade-chips">
          <button className={`chip${cat === "all" ? " chip-on" : ""}`} onClick={() => setCat("all")}>All</button>
          {(Object.keys(TRADE_CATEGORIES) as TradeCategory[]).map((c) => (
            <button key={c} className={`chip${cat === c ? " chip-on" : ""}`} onClick={() => setCat(c)}>{TRADE_CATEGORIES[c]}</button>
          ))}
        </div>
        <div className="trade-filters">
          <label className="check"><input id="trade-free" type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Tuition-free in Georgia only</label>
          <label className="check">Sort by{" "}
            <select id="trade-sort" value={sort} onChange={(e) => setSort(e.target.value as "pay" | "name")}>
              <option value="pay">Pay</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </section>

      {shown.length === 0 ? <p className="hint">No trades match. Try another word or pick All.</p> : (
        <ul className="trade-grid">
          {shown.map((t) => (
            <li key={t.slug}>
              <a href={`/trades/${t.slug}`} className="trade-card">
                <b>{t.name}</b>
                <span className="hint">{t.summary}</span>
                <span className="trade-pay">{payLine(t)}</span>
                <span className="trade-tags">
                  <span className="pill">{t.paths[0]?.length}</span>
                  {t.hope_career_grant && <span className="pill pill-ok">Tuition-free in GA</span>}
                  {t.license.needed && <span className="pill">License or certificate</span>}
                  {t.thin_in_georgia && <span className="pill pill-soon">Mostly outside Georgia</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <TradeGradeSteps />

      <section className="panel" id="paying">
        <h2>Paying for trade school</h2>
        <p className="hint">Grants you don&apos;t pay back, programs that pay you while you train, and free training in other states. <a href="/scholarships">Trade scholarships</a> are on the Scholarships page.</p>
        <TradeAidList />
      </section>

      <p className="hint small">
        Pay: {TRADES_PACK.pay_source} Always confirm program details with the school or program before applying.
        Want a degree instead or as well? <a href="/majors">Search colleges by major</a>.
      </p>
    </Page>
  );
}
