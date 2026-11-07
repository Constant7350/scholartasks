import { notFound } from "next/navigation";
import { IconTabs } from "../../icon-tabs";
import { PATH_KINDS, TRADE_CATEGORIES, TRADE_KINDS } from "@scholartasks/core";
import { Page } from "../../ui";
import { NATIONAL_FINDERS, TRADES, TRADES_PACK, checklistById, dollars, tradeBySlug } from "../../../lib/trades";
import { AddChecklist } from "../add-checklist";
import { TradeAidList } from "../aid-list";
import { TrainingFinder } from "../finder";
import { OpeningsList } from "../openings-list";
import "../trades.css";

export function generateStaticParams() {
  return TRADES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = tradeBySlug((await params).slug);
  return t ? { title: `${t.name}: pay, training and how to apply | ScholarTasks`, description: t.summary } : {};
}

/** One trade: what the work is, pay, ways to train, licensing, where to train and the steps to apply. */
export default async function TradePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = tradeBySlug((await params).slug);
  if (!t) notFound();
  const max = Math.max(t.pay.ga_typical ?? 0, t.pay.us_typical ?? 0, 1);
  const bar = (label: string, v: number | null) => (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track"><span className="bar-fill" style={{ width: `${v ? Math.max(3, Math.round((v / max) * 100)) : 0}%` }} /></span>
      <span className="bar-value">{v ? dollars(v) : "no data"}</span>
    </div>
  );
  const checklists = [...new Set(t.paths.map((p) => p.checklist).filter((c): c is string => !!c))].map(checklistById).filter((c) => !!c);

  return (
    <Page title={t.name}>
      <p className="hint"><a href="/trades">← All trades</a> · {TRADE_CATEGORIES[t.category]}</p>
      <p className="lead">{t.summary}</p>
      <p>{t.work}</p>
      <p className="trade-tags">
        {t.hope_career_grant && <span className="pill pill-ok">Tuition-free at Georgia technical colleges with HOPE</span>}
        {t.license.needed && <span className="pill">License or certificate needed</span>}
        {t.min_age && <span className="pill">Usually {t.min_age}+ to start</span>}
      </p>

      {t.thin_in_georgia && (
        <p className="note trade-away"><b>Mostly outside Georgia.</b> {t.thin_in_georgia} The finder below shows programs in every state.</p>
      )}

      <IconTabs label="Parts of this trade" tabs={[
        { key: "pay", icon: "💵", label: "Pay", body: <>
      <section className="panel">
        <h2>What it pays</h2>
        {t.pay.ga_typical || t.pay.us_typical ? (
          <div className="bars">
            {t.pay.ga_start ? bar("Georgia, starting", t.pay.ga_start) : null}
            {bar("Georgia, typical", t.pay.ga_typical)}
            {t.pay.us_typical ? bar("U.S., typical", t.pay.us_typical) : null}
          </div>
        ) : null}
        {t.pay.note && <p className="hint">{t.pay.note}</p>}
        {t.outlook && <p className="hint">Jobs: {t.outlook}</p>}
        <p className="hint small">Starting means what the lowest-paid 10% earn, often new workers. Typical is the middle (median). {TRADES_PACK.pay_source}</p>
      </section>
        </> },
        { key: "training", icon: "🎓", label: "Training", body: <>
      <section className="panel">
        <h2>Ways to train</h2>
        <ul className="trade-paths">
          {t.paths.map((p, i) => (
            <li key={i}>
              <span className="pill">{PATH_KINDS[p.kind]}</span>
              <b>{p.label}</b>
              <span className="hint">Time: {p.length} · Cost: {p.cost}</span>
              {p.note && <span className="hint">{p.note}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>License and certificates</h2>
        <p>{t.license.georgia}</p>
        {t.license.other_states && <p className="hint">Other states: {t.license.other_states}</p>}
        {t.license.url && <p className="hint"><a href={t.license.url} target="_blank" rel="noreferrer">Official rules</a></p>}
      </section>

      <TrainingFinder slug={t.slug} />
        </> },
        { key: "openings", icon: "🧰", label: "Openings", body: <>
      <section className="panel">
        <h2>Local openings and apprenticeships</h2>
        <p className="hint">Posted by companies and checked by our review team. Your home state first, then across the country.</p>
        <OpeningsList trade={t.slug} compact kinds={TRADE_KINDS} />
      </section>

      <section className="panel">
        <h2>Apprenticeships and union programs anywhere in the U.S.</h2>
        <p className="hint">Apply to the program where you want to live and work. Union and employer apprenticeships pay you while you learn, in any state.</p>
        <ul className="trade-links">
          {[...t.finders, ...NATIONAL_FINDERS].map((f) => (
            <li key={f.url}><a href={f.url} target="_blank" rel="noreferrer">{f.label}</a></li>
          ))}
        </ul>
      </section>
        </> },
        { key: "apply", icon: "✅", label: "Apply", body: <>
      <section className="panel">
        <h2>Steps to apply</h2>
        <p className="hint">Add a checklist to your To-do list and calendar. You can change the dates there.</p>
        {checklists.map((c) => <AddChecklist key={c!.id} id={c!.id} trade={t.slug} />)}
      </section>
        </> },
        { key: "paying", icon: "💰", label: "Paying for it", body: <>
      <section className="panel">
        <h2>Paying for it</h2>
        {t.hope_career_grant && <p className="note">Georgia residents: the HOPE Grant plus the HOPE Career Grant cover tuition for this trade at Georgia&apos;s technical colleges. You still pay fees, books and tools.</p>}
        <p className="hint">Georgia&apos;s HOPE money only works at Georgia schools, and out-of-state tuition is usually 2 to 4 times higher. Look for <a href="/scholarships">trade scholarships</a> too, such as mikeroweWORKS and the American Welding Society.</p>
        <TradeAidList />
      </section>
        </> },
      ]} />

      {t.related_majors.length > 0 && (
        <p className="hint">Thinking about a degree too? <a href={`/majors?q=${encodeURIComponent(t.name)}`}>Search colleges by major</a>.</p>
      )}
      <p className="hint small">Sources: {t.sources.map((s, i) => <span key={s}>{i ? " · " : ""}<a href={s} target="_blank" rel="noreferrer">{new URL(s).hostname.replace(/^www\./, "")}</a></span>)}. ScholarTasks gives advice only; your family makes the decisions.</p>
    </Page>
  );
}
