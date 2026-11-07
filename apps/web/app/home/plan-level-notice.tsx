"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { noticeShowing, type LevelNotice } from "@scholartasks/core";
import { FAMILY_LEVELS, money } from "../../lib/prices";

/**
 * Parents only: the Family plan price is moving to another level at the next bill (the oldest
 * student's grade changed, or they graduated or left). Shown from the notice email (about 30
 * days ahead) until the new price starts. Nothing shows before database update 65.
 */
export function PlanLevelNotice({ sb }: { sb: SupabaseClient }) {
  const [n, setN] = useState<LevelNotice | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const { data, error } = await sb.from("billing_subscriptions").select("level_notice, status")
        .eq("kind", "family").in("status", ["active", "trialing", "past_due"]);
      if (error || !live) return;
      const today = new Date().toLocaleDateString("en-CA");
      const found = ((data as { level_notice: LevelNotice | null }[]) ?? []).map((r) => r.level_notice).find((x) => noticeShowing(x, today));
      setN(found ?? null);
    })();
    return () => { live = false; };
  }, [sb]);
  if (!n) return null;
  const to = FAMILY_LEVELS.find((l) => l.key === n.to)!;
  const from = FAMILY_LEVELS.find((l) => l.key === n.from);
  const levelUp = !!from && FAMILY_LEVELS.indexOf(to) > FAMILY_LEVELS.indexOf(from);
  const levelDown = !!from && FAMILY_LEVELS.indexOf(to) < FAMILY_LEVELS.indexOf(from);
  const more = n.cents > (n.old_cents ?? 0);
  const when = new Date(`${n.starts_on.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const per = n.interval === "year" ? "a year" : "a month";
  return (
    <section className="panel" aria-label="Plan price change">
      <h2>{more ? "Your plan price is changing" : "Your plan price is going down"}</h2>
      <p>
        {levelUp && <>{n.student} is now in grade {n.grade}, so your family moves to the <b>{to.name}</b> level (grades {to.grades}). </>}
        {levelDown && <>{n.student} (grade {n.grade}) is now your oldest student, so your family moves to the <b>{to.name}</b> level (grades {to.grades}). </>}
        {!levelUp && !levelDown && n.students != null && <>Your family now has {n.students} students on the account ({n.extras ?? 0} additional beyond the 2 included). </>}
        <span>From your bill on <b>{when}</b>, the Family plan is <b>{money(n.cents)} {per}</b>{n.old_cents != null && n.old_cents !== n.cents ? (more ? `, ${money(n.cents - n.old_cents)} more than now` : `, ${money(n.old_cents - n.cents)} less than now`) : ""}. Nothing is charged before then.</span>
      </p>
      <a className="home-more" href="/billing#family-plan">See Plan and billing</a>
    </section>
  );
}
