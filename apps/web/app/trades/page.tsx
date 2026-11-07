"use client";

import { useEffect, useMemo, useState } from "react";
import { TRADE_CATEGORIES, TRADE_CATEGORY_INTROS, payLine, type TradeCategory } from "@scholartasks/core";
import { Page } from "../ui";
import { IconTabs } from "../icon-tabs";
import { useShowMore } from "../show-more";
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

  // /trades?group=cnc opens one group (used by the CNC machining link).
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("group");
    if (g && g in TRADE_CATEGORIES) setCat(g as TradeCategory);
  }, []);
  const pickGroup = (c: TradeCategory) => {
    setCat(c);
    window.location.hash = "find";
  };

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
  const { shown: visible, more } = useShowMore(shown, 8, `${q}|${cat}|${free}|${sort}`);

  return (
    <Page title="Trades and trade schools">
      <p className="lead">Skilled careers you can train for in weeks to a few years, often while getting paid. Tap one to see pay, training and how to apply.</p>

      <p className="trade-quick"><a className="btn btn-inline link-btn" href="/trades/quiz">🧭 Help me pick</a> <a className="btn btn-ghost btn-inline link-btn" href="/trades/openings">🧰 Openings</a></p>

      <IconTabs label="Parts of trades" tabs={[
        { key: "find", icon: "🔎", label: "Find a trade", count: shown.length, body: <>
      <section className="panel">
        <label className="field">
          <span>Search trades</span>
          <input id="trade-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try welding, nurse, horses, computers…" />
        </label>
        <label className="field">
          <span>Group</span>
          <select id="trade-group" value={cat} onChange={(e) => setCat(e.target.value as TradeCategory | "all")}>
            <option value="all">All trades</option>
            {(Object.keys(TRADE_CATEGORIES) as TradeCategory[]).map((c) => <option key={c} value={c}>{TRADE_CATEGORIES[c]}</option>)}
          </select>
        </label>
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

      <div id="trade-list" />
      {cat !== "all" && TRADE_CATEGORY_INTROS[cat] && (
        <section className="panel">
          <h2>{TRADE_CATEGORIES[cat]}</h2>
          <p>{TRADE_CATEGORY_INTROS[cat]}</p>
        </section>
      )}

      {shown.length === 0 ? <p className="hint">No trades match. Try another word or pick All.</p> : (
        <ul className="trade-grid">
          {visible.map((t) => (
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

      {more}
        </> },
        { key: "start", icon: "💡", label: "Where to start", body: <>
      <div className="trade-callouts">
        <a className="panel trade-callout" href="/trades/quiz">
          <b>Not sure where to start?</b>
          <span>Answer a few questions and see trades that fit what you enjoy.</span>
        </a>
        <a className="panel trade-callout" href="/trades/openings">
          <b>Apprenticeships and local openings</b>
          <span>Local companies post apprenticeships, paid training and jobs here. Our review team checks each one first.</span>
        </a>
        <button type="button" className="panel trade-callout" onClick={() => pickGroup("cnc")}>
          <b>CNC machining</b>
          <span>Run, set up and program the computer-controlled machines that make metal parts. Start in months, move up to $60,000 or more.</span>
        </button>
        <div className="panel trade-callout">
          <b>Free tuition in Georgia</b>
          <span>{freeCount} of these trades are on Georgia's HOPE Career Grant list: with the HOPE Grant, tuition is covered at Georgia's 22 technical colleges. No high school GPA is needed.</span>
        </div>
      </div>
        </> },
        { key: "grades", icon: "📅", label: "Steps by grade", body: <TradeGradeSteps /> },
        { key: "paying", icon: "💰", label: "Paying for it", body: <>
      <section className="panel">
        <h2>Paying for trade school</h2>
        <p className="hint">Grants you don&apos;t pay back, programs that pay you while you train, and free training in other states. <a href="/scholarships">Trade scholarships</a> are on the Scholarships page.</p>
        <TradeAidList />
      </section>
        </> },
      ]} />

      <p className="hint small">
        Pay: {TRADES_PACK.pay_source} Always confirm program details with the school or program before applying.
        Want a degree instead or as well? <a href="/majors">Search colleges by major</a>.
        {" "}Do you hire for a trade? <a href="/trades/post">Post an apprenticeship or opening for free</a>.
      </p>
    </Page>
  );
}
