import { aidFor, type TradeAid } from "@scholartasks/core";
import { STATE_NAMES, TRADE_AID } from "../../lib/trades";

function Program({ a }: { a: TradeAid }) {
  return (
    <li className="trade-aid">
      <div className="trade-aid-head">
        <b><a href={a.url} target="_blank" rel="noreferrer">{a.name}</a></b>
        <span className="pill">{a.state === "US" ? "Any state" : STATE_NAMES[a.state] ?? a.state}</span>
      </div>
      <span className="trade-pay">{a.amount}</span>
      <span>{a.summary}</span>
      <span className="hint">Who: {a.who}</span>
      <span className="hint">How: {a.apply}</span>
    </li>
  );
}

/**
 * Ways to pay for trade training. Programs for every state and the student's
 * home state come first; other states' free-training programs follow, so a
 * family can weigh moving for a trade that isn't taught near them.
 */
export function TradeAidList({ homeState }: { homeState?: string | null }) {
  const home = homeState || "GA";
  const { here, elsewhere } = aidFor(TRADE_AID, home);
  return (
    <>
      <ul className="trade-aid-list">{here.map((a) => <Program key={a.id} a={a} />)}</ul>
      {elsewhere.length > 0 && (
        <details className="trade-more">
          <summary>Free or low-cost training in other states ({elsewhere.length})</summary>
          <p className="hint">
            These programs are for people who live in that state, usually for at least a year before they start.
            They can make moving for a trade worth it, especially for trades with few programs in {STATE_NAMES[home] ?? home}.
            Out-of-state students pay more and don&apos;t get these programs.
          </p>
          <ul className="trade-aid-list">{elsewhere.map((a) => <Program key={a.id} a={a} />)}</ul>
        </details>
      )}
    </>
  );
}
