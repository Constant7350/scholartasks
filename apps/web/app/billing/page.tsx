"use client";

import { useCallback, useEffect, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { extraStudents, familyPlanLevel, noticeShowing, type LevelNotice, type PlanLevel } from "@scholartasks/core";
import { CATALOG as C, EXTRA_STUDENT, FAMILY_LEVELS, familyCents, FAMILY_DAILY_LIMIT, FREE_DAILY_LIMIT, FREE_PLAN_INCLUDES, HOMEWORK_DAILY_LIMIT, HOMEWORK_MONTHLY_LIMIT, PAYWALL_ON, money } from "../../lib/prices";
import { inPhoneApp } from "../../lib/passkeys-client";
import { NotConfigured, Page } from "../ui";
import { currentStudents } from "../../lib/current-students";

interface Plan { family_id: string | null; family_plan: boolean; study_coach: boolean; ai_credits: number }
interface Sub { id: string; kind: "family" | "study_coach"; status: string; billing_interval: "month" | "year" | null; current_period_end: string | null; cancel_at_period_end: boolean; level?: PlanLevel | null; level_notice?: LevelNotice | null }
interface Kid { first_name: string; grade_level: number }

const levelOf = (k: PlanLevel) => FAMILY_LEVELS.find((l) => l.key === k)!;
const longDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const todayIso = () => new Date().toLocaleDateString("en-CA");

const ACTIVE = ["active", "trialing", "past_due"];
const DONE_TEXT: Record<string, string> = {
  family: "Thanks! Your Family plan is starting.",
  coach_month: "Thanks! Homework Helper is being added.",
  coach_year: "Thanks! Homework Helper is being added.",
  pack_100: "Thanks! Your extra AI messages are being added.",
};

function renewal(s: Sub | undefined) {
  if (!s?.current_period_end) return "";
  const d = new Date(s.current_period_end).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  if (s.status === "past_due") return ` Your last payment didn't go through. Please update your card in Manage billing.`;
  return s.cancel_at_period_end ? ` Ends on ${d}.` : ` Renews on ${d}.`;
}

export default function BillingPage() {
  const sb = supabase();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [isParent, setIsParent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(inPhoneApp()), []);

  const load = useCallback(async (): Promise<Plan | null> => {
    if (!sb) return null;
    const { data: u } = await sb.auth.getUser();
    if (!u.user) { setSignedIn(false); return null; }
    setSignedIn(true);
    const p = await sb.rpc("my_plan", {});
    if (p.error) {
      setError(p.error.code === "PGRST202" || p.error.code === "42883" ? "Plans need the latest database update first." : friendly(p.error));
      return null;
    }
    const row = ((p.data as Plan[]) ?? [])[0] ?? null;
    setPlan(row);
    const m = await sb.from("family_members").select("role").eq("user_id", u.user.id);
    const parent = ((m.data as { role: string }[]) ?? []).some((r) => r.role === "parent");
    setIsParent(parent);
    if (row?.family_id) {
      setKids(await currentStudents<Kid>(sb, row.family_id, "first_name, grade_level"));
    }
    if (parent && row?.family_id) {
      const cols = "id, kind, status, billing_interval, current_period_end, cancel_at_period_end";
      const s = await sb.from("billing_subscriptions").select(`${cols}, level, level_notice`).eq("family_id", row.family_id);
      // Before database update 65 there are no level columns yet.
      const rows = s.error ? (await sb.from("billing_subscriptions").select(cols).eq("family_id", row.family_id)).data : s.data;
      setSubs((rows as Sub[]) ?? []);
    }
    return row;
  }, [sb]);

  useEffect(() => {
    load();
    const done = new URLSearchParams(window.location.search).get("done");
    if (done && DONE_TEXT[done]) {
      setNotice(DONE_TEXT[done] + " It can take a few seconds to show up here.");
      window.history.replaceState(null, "", "/billing");
      // Stripe tells us about the payment a moment later; check back a few times.
      let tries = 0;
      const t = setInterval(async () => {
        tries++;
        await load();
        if (tries >= 6) clearInterval(t);
      }, 2500);
      return () => clearInterval(t);
    }
  }, [load]);

  async function go(path: "checkout" | "portal", item?: string) {
    if (!sb) return;
    setBusy(item ?? path);
    setError(null);
    try {
      const { data: s } = await sb.auth.getSession();
      const res = await fetch(`/api/billing/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.session?.access_token ?? ""}` },
        body: JSON.stringify(item ? { item } : {}),
      });
      const out = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !out.url) throw new Error(out.error ?? "Something went wrong. Please try again.");
      window.location.href = out.url;
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  }

  const title = "Plan and billing";
  // App store rules: no buying or plan changes inside the iPhone/Android app.
  if (inApp) return <Page title={title}><p className="note">Plans aren't managed in the phone app. Everything your family's plan includes works here as usual.</p></Page>;
  if (!sb) return <Page title={title}><NotConfigured /></Page>;
  if (signedIn === false) return <Page title={title}><p className="hint"><a href="/signin">Sign in</a> to see your family's plan.</p></Page>;

  const familySub = subs.find((s) => s.kind === "family" && ACTIVE.includes(s.status));
  const coachSub = subs.find((s) => s.kind === "study_coach" && ACTIVE.includes(s.status));
  const hasFamily = !!plan?.family_plan;
  const hasCoach = !!plan?.study_coach;
  const oldest = kids[0];
  const myLevel = familyPlanLevel(kids.map((k) => k.grade_level));
  const extras = extraStudents(kids.length);
  const myMonth = myLevel ? familyCents(myLevel, "month", kids.length) : 0;
  const myYear = myLevel ? familyCents(myLevel, "year", kids.length) : 0;
  const levelNotice = noticeShowing(familySub?.level_notice, todayIso()) ? familySub!.level_notice! : null;

  return (
    <Page title={title}>
      <p className="hint" style={{ marginTop: -8 }}>
        A parent manages the plan for the whole family. Payments are handled by Stripe; ScholarTasks never sees your card number.
      </p>
      {notice && <p className="note note-ok" role="status">{notice}</p>}
      {error && <p className="note note-err" role="alert">{error}</p>}
      {signedIn && plan && !plan.family_id && (
        <p className="note">Set up your family first on <a href="/family">Family and permissions</a>, then come back to choose a plan.</p>
      )}
      {signedIn && plan?.family_id && !isParent && (
        <p className="note">Your parent manages the family's plan. Ask them if you need more AI messages or the Homework Helper.</p>
      )}

      {!PAYWALL_ON && (
        <p className="note">ScholarTasks is free while we're in beta, with {FAMILY_DAILY_LIMIT} AI uses a day per person. Nobody is charged until the beta ends.</p>
      )}

      <div className="tiles" style={{ marginTop: 16 }}>
        <div className={`tile${!hasFamily ? " tile-ok" : ""}`}>
          <span className="tile-icon">🎒</span>
          <b>Free plan {!hasFamily && <span className="pill pill-ok">{PAYWALL_ON ? "Your plan" : "Free in beta"}</span>}</b>
          <span>Free for every family, always. No card needed.</span>
          <ul className="plan-list">
            {FREE_PLAN_INCLUDES.map((x) => <li key={x}>{x}</li>)}
            <li>{FREE_DAILY_LIMIT} AI uses a day per person (counselor, essay feedback, grade help)</li>
          </ul>
        </div>

        <div className={`tile${hasFamily ? " tile-ok" : ""}`} id="family-plan">
          <span className="tile-icon">👪</span>
          <b>Family plan {hasFamily && <span className="pill pill-ok">Active</span>}</b>
          <span>Everything in the free plan, plus the AI counselor and coaches for every student in your family: {FAMILY_DAILY_LIMIT} AI uses a day per person instead of {FREE_DAILY_LIMIT}.</span>
          <span><b>Priced by your oldest student&apos;s grade. 2 students included, {money(EXTRA_STUDENT.month)} a month for each additional student</b> ({money(EXTRA_STUDENT.year)} a year on yearly plans).</span>
          {myLevel && oldest ? (
            <p className="level-mine">
              <span>Your family&apos;s level: <b>{levelOf(myLevel).name}</b> (oldest student {oldest.first_name}, in grade {oldest.grade_level})</span>
              <br />
              <span>{kids.length === 1 ? "1 student" : extras ? `${kids.length} students, ${extras} additional` : `${kids.length} students`}: <b>{money(myMonth)} a month</b> or <b>{money(myYear)} a year</b></span>
              {myMonth * 12 > myYear ? <span>{` (save ${money(myMonth * 12 - myYear)})`}</span> : null}
            </p>
          ) : (
            <span className="hint">Add your students on <a href="/family">Family and permissions</a> to see your family&apos;s price.</span>
          )}
          <ul className="plan-list level-list">
            {FAMILY_LEVELS.map((l) => (
              <li key={l.key} className={l.key === myLevel ? "level-on" : undefined}>
                <b>{l.name}</b>, grades {l.grades}: {money(l.month)} a month or {money(l.year)} a year{l.key === myLevel ? " ✓" : ""}
              </li>
            ))}
          </ul>
          <span className="hint">The level follows the oldest student. When their grade moves your family to another level, they graduate or leave the account, or you add or remove an additional student, we tell you by email and on Home about 30 days ahead. The new price starts at your next bill (at renewal for yearly plans).</span>
          {levelNotice && (
            <p className="note" role="status">
              From {longDate(levelNotice.starts_on)}, your Family plan will be <b>{money(levelNotice.cents)} {levelNotice.interval === "year" ? "a year" : "a month"}</b> ({levelOf(levelNotice.to).name} level, because {levelNotice.student} is in grade {levelNotice.grade}).
            </p>
          )}
          {hasFamily ? (
            <span>{familySub?.level ? <span>{`${levelOf(familySub.level).name} level.`} </span> : null}{familySub?.billing_interval === "year" ? "Yearly." : familySub?.billing_interval === "month" ? "Monthly." : ""}{renewal(familySub)}</span>
          ) : isParent && plan?.family_id && myLevel ? (
            <div className="share-row">
              <button className="btn btn-inline" disabled={!!busy} onClick={() => go("checkout", "family_year")}>{busy === "family_year" ? "Opening…" : `${money(myYear)} a year`}</button>
              <button className="btn btn-ghost btn-inline" disabled={!!busy} onClick={() => go("checkout", "family_month")}>{busy === "family_month" ? "Opening…" : `${money(myMonth)} a month`}</button>
            </div>
          ) : null}
        </div>

        <div className={`tile${hasCoach ? " tile-ok" : ""}`}>
          <span className="tile-icon">🦉</span>
          <b>Homework Helper add-on {hasCoach && <span className="pill pill-ok">Active</span>}</b>
          <span>A safe AI tutor for every subject, from math to essays, that never gives answers or writes for your student. It gives one hint at a time, checks their work and asks them to explain their thinking. You see what they practiced and when it said no. Up to {HOMEWORK_DAILY_LIMIT} helper turns a day per student ({HOMEWORK_MONTHLY_LIMIT} a month per family), plus more practice-tutor help and full practice tests.</span>
          <span><b>{money(C.coach_month.cents)} a month</b> or <b>{money(C.coach_year.cents)} a year</b> for the whole family. Works with or without the Family plan.</span>
          {hasCoach ? (
            <span>{renewal(coachSub)}</span>
          ) : isParent && plan?.family_id ? (
            <div className="share-row">
              <button className="btn btn-inline" disabled={!!busy} onClick={() => go("checkout", "coach_year")}>{busy === "coach_year" ? "Opening…" : `${money(C.coach_year.cents)} a year`}</button>
              <button className="btn btn-ghost btn-inline" disabled={!!busy} onClick={() => go("checkout", "coach_month")}>{busy === "coach_month" ? "Opening…" : `${money(C.coach_month.cents)} a month`}</button>
            </div>
          ) : null}
          <a href="/homework">See the Homework Helper</a>
        </div>

        <div className="tile">
          <span className="tile-icon">💬</span>
          <b>Extra AI messages</b>
          <span>For busy weeks: when someone in your family uses up the day's free AI uses, the next ones come from your pack. Packs never expire.</span>
          <span><b>{C.pack_100.credits} messages for {money(C.pack_100.cents)}</b></span>
          <span>Your family has <b>{plan?.ai_credits ?? 0}</b> extra {plan?.ai_credits === 1 ? "message" : "messages"} left.</span>
          {isParent && plan?.family_id && (
            <div className="share-row">
              <button className="btn btn-inline" disabled={!!busy} onClick={() => go("checkout", "pack_100")}>{busy === "pack_100" ? "Opening…" : `Buy ${C.pack_100.credits} for ${money(C.pack_100.cents)}`}</button>
            </div>
          )}
        </div>
      </div>

      {isParent && subs.length > 0 && (
        <p style={{ marginTop: 20 }}>
          <button className="btn btn-ghost btn-inline" disabled={!!busy} onClick={() => go("portal")}>{busy === "portal" ? "Opening…" : "Manage billing"}</button>
          <span className="hint" style={{ display: "block", marginTop: 6 }}>Change your card, switch between monthly and yearly, see receipts, or cancel.</span>
        </p>
      )}
    </Page>
  );
}
