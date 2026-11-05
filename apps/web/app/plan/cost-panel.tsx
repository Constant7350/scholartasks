"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateCost, type CostInput } from "@scholartasks/core";
import { money, toFacts, type CollegeRow } from "../../lib/colleges";

export interface CostCollege { id: string; name: string; status: string; college_id: number | null; aid_offer: number | null }

/**
 * "What it will cost us": a yearly and four-year estimate for every college on
 * the list that is linked to the federal data, with the math shown, a place to
 * type the grants from each award letter, and the student's outside awards.
 */
export function CostPanel({ sb, studentId, colleges, data, ctx, canEdit, onChanged }: {
  sb: SupabaseClient; studentId: string; colleges: CostCollege[]; data: Map<number, CollegeRow>; ctx: CostInput;
  canEdit: boolean; onChanged: () => Promise<void>;
}) {
  const [outside, setOutside] = useState(ctx.outsideAwards?.toString() ?? "");
  const [offers, setOffers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const linked = colleges.filter((c) => c.college_id && data.has(c.college_id) && c.status !== "withdrawn" && c.status !== "denied");
  const rows = linked.map((c) => ({ c, row: data.get(c.college_id!)!, est: estimateCost(toFacts(data.get(c.college_id!)!), { ...ctx, aidOffer: c.aid_offer }) }))
    .sort((a, b) => (a.est.estimate ?? 1e9) - (b.est.estimate ?? 1e9));
  const unlinked = colleges.filter((c) => !c.college_id && c.status !== "withdrawn");

  const saveOutside = async () => {
    setMsg(null);
    const { error } = await sb.rpc("set_outside_awards", { p_student: studentId, p_amount: outside ? Number(outside) : null });
    if (error) return setMsg("Couldn't save. Try again.");
    await onChanged();
    setMsg("✓ Saved");
  };
  const saveOffer = async (c: CostCollege) => {
    const v = offers[c.id];
    const { error } = await sb.from("student_colleges").update({ aid_offer: v ? Number(v) : null }).eq("id", c.id);
    if (error) return setMsg("Couldn't save the offer. Try again.");
    await onChanged();
  };

  return (
    <section className="panel">
      <h2>What it will cost us</h2>
      {rows.length === 0 ? (
        <p className="hint" style={{ margin: 0 }}>
          Add a college from the list below (pick it as you type its name) and its yearly price shows here.
          {" "}Or <a href="/colleges">find colleges</a> that fit your student and budget.
        </p>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>Cheapest first. Estimates per year, before loans or work-study. Tap a college to see the math. Award letters in? <a href="/plan/offers">Compare them side by side</a>, with loans split out.</p>
          <div style={{ overflowX: "auto" }}>
            <table className="cost-compare">
              <thead><tr><th>College</th><th className="num">Full price</th><th className="num">Our estimate</th><th className="num">4 years</th></tr></thead>
              <tbody>
                {rows.map(({ c, est }) => (
                  <tr key={c.id}>
                    <td>
                      <details>
                        <summary>{c.name}{est.basis === "offer" ? " ✓ offer" : ""}</summary>
                        <div className="cost-box">
                          <table>
                            <tbody>
                              {est.lines.map((l, i) => <tr key={i}><td>{l.label}</td><td>{l.amount < 0 ? `−${money(-l.amount)}` : money(l.amount)}</td></tr>)}
                              <tr className="cost-total"><td>Estimated yearly price</td><td>{money(est.estimate)}</td></tr>
                            </tbody>
                          </table>
                          {est.notes.map((n) => <p key={n} className="hint" style={{ margin: "6px 0 0" }}>{n}</p>)}
                          {canEdit && (
                            <div className="row" style={{ marginTop: 8, alignItems: "end" }}>
                              <div className="field" style={{ flex: "0 1 230px" }}>
                                <label htmlFor={`offer-${c.id}`}>Grants and scholarships in the award letter ($/year)</label>
                                <input id={`offer-${c.id}`} className="input" inputMode="numeric" placeholder="From the college's offer"
                                  value={offers[c.id] ?? c.aid_offer?.toString() ?? ""} onChange={(e) => setOffers({ ...offers, [c.id]: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
                              </div>
                              <button className="btn btn-inline btn-sm" onClick={() => void saveOffer(c)}>Save</button>
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                    <td className="num">{money(est.sticker)}</td>
                    <td className="num"><b>{money(est.estimate)}</b></td>
                    <td className="num">{money(est.fourYears)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {canEdit && (
        <div className="row" style={{ marginTop: 12, alignItems: "end" }}>
          <div className="field" style={{ flex: "0 1 260px" }}>
            <label htmlFor="outside">Outside scholarships won ($/year, any college)</label>
            <input id="outside" className="input" inputMode="numeric" value={outside} onChange={(e) => setOutside(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </div>
          <button className="btn btn-inline btn-sm" onClick={() => void saveOutside()}>Save</button>
          {msg && <span className="hint">{msg}</span>}
        </div>
      )}
      {unlinked.length > 0 && <p className="hint">No price yet for {unlinked.map((c) => c.name).join(", ")}. Remove and re-add {unlinked.length === 1 ? "it" : "them"}, picking the name from the list, to link the federal data.</p>}
      <p className="hint" style={{ marginBottom: 0 }}>How we estimate: full price is the college&apos;s cost of attendance (tuition, fees, housing, food, books). Without an award letter we use what families at your income typically paid there (U.S. Department of Education), or HOPE/Zell if that&apos;s lower, then take off outside scholarships. Every college&apos;s own net price calculator gives a closer number.</p>
    </section>
  );
}
