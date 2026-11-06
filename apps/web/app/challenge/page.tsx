"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { pickStudent, useCurrentStudent } from "../../lib/current-student";
import { NotConfigured, Page } from "../ui";
import { SignConsent } from "../sign-consent";
import { ReportAi } from "../report-ai";
import { VoiceButton } from "../voice";
import {
  type Challenge, type Entry, POLISH, RULES_VERSION, countWords, day, grades, level, money, permissionWording, prizeText, steps,
} from "../../lib/challenge";

interface Student { id: string; first_name: string; grade_level: number; birth_date: string }
interface Permission { challenge_id: string; student_id: string; public_name_ok: boolean }
interface Coach { strengths: string[]; improve: string[]; answers_topic: string; next_step: string }
interface MyPrize { kind: string; amount: number; status: string; paid_on: string | null; brand: string | null; ready: boolean; picked_up_at: string | null }
interface Gift { brand: string | null; amount: number; code: string | null; link: string | null }

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42P01" || e.code === "PGRST205" || /could not find the table|does not exist/i.test(e.message ?? ""));
const isAdult = (birth: string) => { const b = new Date(birth); const t = new Date(); return t.getFullYear() - b.getFullYear() - (t < new Date(t.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0) >= 18; };
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

const RESULT: Record<string, string> = { finisher: "Finisher", finalist: "Finalist", winner: "Winner" };

/** Points, level and badges at the top of an entry. */
function Scoreboard({ list }: { list: ReturnType<typeof steps> }) {
  const points = list.filter((s) => s.done).reduce((a, s) => a + s.points, 0);
  const total = list.reduce((a, s) => a + s.points, 0);
  const lv = level(points);
  return (
    <div className="challenge-score">
      <div className="challenge-level">
        <b>Level: {lv.name}</b>
        <span className="hint">{points} of {total} points{lv.next ? ` · ${lv.next.min - points} more to reach ${lv.next.name}` : " · top level!"}</span>
        <div className="challenge-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={points}><span style={{ width: `${Math.round((points / total) * 100)}%` }} /></div>
      </div>
      <ul className="challenge-badges" aria-label="Badges">
        {list.map((s) => (
          <li key={s.key} className={s.done ? "is-earned" : ""} title={s.done ? `${s.badge} badge earned` : `${s.badge}: ${s.label}`}>
            <span aria-hidden>{s.icon}</span><small>{s.badge}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A winner's gift card: the parent picks it up here after Face ID or an email code and a signed receipt. */
function PrizePickup({ entry, student, prize, mayPick, onPicked }: { entry: Entry; student: Student; prize: MyPrize; mayPick: boolean; onPicked: (p: MyPrize) => void }) {
  const sb = supabase()!;
  const [signing, setSigning] = useState(false);
  const [gift, setGift] = useState<Gift | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const store = prize.brand ? `${prize.brand} ` : "";
  const open = async () => {
    setMsg(null);
    const { data, error } = await sb.rpc("challenge_pickup_prize", { p_entry: entry.id });
    if (error) throw new Error(friendly(error));
    setGift(data as Gift);
    setSigning(false);
    onPicked({ ...prize, status: "paid", picked_up_at: prize.picked_up_at ?? new Date().toISOString() });
  };
  return (
    <div className="note note-info" style={{ display: "grid", gap: 8 }}>
      <b>🎁 Prize: {money(prize.amount)} {store}digital gift card</b>
      {!prize.ready ? <span>Your prize is being prepared. It will be ready here within 30 days of the results.</span>
        : !mayPick ? <span>{prize.picked_up_at ? "Your parent picked up the prize. 🎉" : "Ready! Ask a parent to open this page in their own ScholarTasks login to pick it up."}</span>
        : gift ? (
          <span>
            {gift.code && <>Gift card code: <b className="gift-code">{gift.code}</b><br /></>}
            {gift.link && <><a href={gift.link} target="_blank" rel="noopener noreferrer">Open the gift card</a><br /></>}
            <span className="hint small">Keep this code private. Anyone with it can spend it.</span>
          </span>
        ) : prize.picked_up_at ? (
          <button className="btn btn-inline btn-sm" onClick={() => void open().catch((e) => setMsg((e as Error).message))}>Show the gift card again</button>
        ) : signing ? (
          <SignConsent kind="prize" student={student.id} target={entry.id} title="Prize receipt" button="Sign and show my prize"
            wording={`I am ${student.first_name}'s parent or legal guardian (or the winner, 18 or older). I received the ${money(prize.amount)} ${store}digital gift card prize for ${student.first_name} from the ScholarTasks essay challenge. I understand prizes may count as taxable income.`}
            onSigned={open} onDecline={() => setSigning(false)} declineLabel="Not now" />
        ) : (
          <>
            <span>Ready to pick up! For safety, prizes are never emailed or mailed. Confirm it&apos;s you and sign a receipt to see the gift card.</span>
            <button className="btn btn-inline btn-sm" style={{ justifySelf: "start" }} onClick={() => setSigning(true)}>Pick up the prize</button>
          </>
        )}
      {msg && <span className="note note-err" style={{ margin: 0 }}>{msg}</span>}
    </div>
  );
}

/** One challenge, open: the steps, the editor, permission and sending it in. */
function Workspace({ c, entry, student, writer, isParent, permission, onChanged }: {
  c: Challenge; entry: Entry | null; student: Student; writer: boolean; isParent: boolean;
  permission: Permission | null; onChanged: () => Promise<void> | void;
}) {
  const sb = supabase()!;
  const [e, setE] = useState<Entry | null>(entry);
  const [body, setBody] = useState(entry?.body ?? "");
  const [ideas, setIdeas] = useState(entry?.ideas ?? "");
  const [outline, setOutline] = useState(entry?.outline ?? "");
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [coach, setCoach] = useState<Coach | null>(null);
  const [signing, setSigning] = useState(false);
  const [publicOk, setPublicOk] = useState(true);
  const [prize, setPrize] = useState<MyPrize | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(0);
  const lastKey = useRef(0);

  useEffect(() => { setE(entry); setBody(entry?.body ?? ""); setIdeas(entry?.ideas ?? ""); setOutline(entry?.outline ?? ""); }, [entry]);
  // Count writing time: seconds with a key pressed in the last minute.
  useEffect(() => {
    const t = setInterval(() => { if (Date.now() - lastKey.current < 60000) active.current += 5; }, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (c.status !== "done" || !e || e.status !== "submitted") return;
    void sb.rpc("challenge_my_prize", { p_entry: e.id }).then(({ data }) => setPrize((data as MyPrize | null) ?? null));
  }, [sb, c.status, e]);

  const open = c.status === "open" && new Date(c.closes_at).getTime() > Date.now();
  const canWrite = writer && open && (!e || e.status === "draft");
  const list = steps(c, e ? { ...e, body, words: countWords(body) } : null, !!permission);
  const words = countWords(body);

  const start = async () => {
    setBusy(true); setMsg(null);
    const { data, error } = await sb.from("challenge_entries").insert({ challenge_id: c.id, student_id: student.id }).select("*").single();
    setBusy(false);
    if (error) return setMsg(friendly(error));
    setE(data as Entry);
    await onChanged();
  };

  const save = useCallback(async (patch: Partial<Entry>) => {
    if (!e) return;
    setSaved("saving");
    const { data, error } = await sb.from("challenge_entries")
      .update({ ...patch, active_seconds: e.active_seconds + active.current }).eq("id", e.id).select("*").single();
    if (error) { setSaved("error"); setMsg(friendly(error)); return; }
    active.current = 0;
    setSaved("saved");
    setE(data as Entry);
  }, [sb, e]);

  const later = (patch: Partial<Entry>) => {
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(patch), 1500);
  };
  const onIdeas = (v: string) => { setIdeas(v); later({ ideas: v }); };
  const onOutline = (v: string) => { setOutline(v); later({ outline: v }); };
  const onBody = (v: string) => { lastKey.current = Date.now(); setBody(v); later({ body: v }); };
  const blockPaste = (ev: React.ClipboardEvent | React.DragEvent) => {
    ev.preventDefault();
    setMsg("Pasting is turned off in the challenge. Type your essay here, in your own words.");
    if (e) void save({ paste_blocked: e.paste_blocked + 1, body });
  };
  const tick = (key: string, v: boolean) => { if (e) void save({ checklist: { ...e.checklist, [key]: v } }); };

  const askCoach = async () => {
    if (!e) return;
    setBusy(true); setMsg(null); setCoach(null);
    if (timer.current) { clearTimeout(timer.current); await save({ body }); }
    try {
      const { data } = await sb.auth.getSession();
      const r = await fetch("/api/challenge/coach", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ entryId: e.id }) });
      const out = await r.json();
      if (!r.ok) throw new Error(out.error ?? "Something went wrong.");
      setCoach(out);
      const { data: fresh } = await sb.from("challenge_entries").select("*").eq("id", e.id).single();
      if (fresh) setE(fresh as Entry);
    } catch (err) { setMsg((err as Error).message); }
    setBusy(false);
  };

  const submit = async () => {
    if (!e) return;
    if (!window.confirm("Send your essay in? After this it can't be changed.")) return;
    setBusy(true); setMsg(null);
    if (timer.current) { clearTimeout(timer.current); await save({ body }); }
    const { error } = await sb.rpc("challenge_submit", { p_entry: e.id });
    setBusy(false);
    if (error) return setMsg(friendly(error));
    await onChanged();
  };

  const claim = async () => {
    if (!e) return;
    const { data, error } = await sb.rpc("challenge_claim", { p_entry: e.id });
    if (error) return setMsg(friendly(error));
    window.location.href = `/challenge/certificate?code=${encodeURIComponent(data as string)}`;
  };

  const adult = isAdult(student.birth_date);
  const mayGivePermission = isParent || (writer && adult);

  return (
    <div className="panel challenge-work">
      <div className="todo-top">
        <h2 style={{ margin: 0 }}>🏆 {c.title}</h2>
        <span className="pill pill-soon">{c.subject}</span>
      </div>
      <p className="hint" style={{ marginTop: 4 }}>
        {grades(c)} · {c.min_words} to {c.max_words} words · {open ? `Closes ${day(c.closes_at)} (${daysLeft(c.closes_at)} days left)` : c.status === "done" ? "Results are out" : "Closed for judging"} · <a href={`/challenge/rules?id=${c.id}`}>Official rules</a>
      </p>
      {c.prizes.length > 0 && <p style={{ margin: "6px 0" }}>{c.prizes.map(prizeText).join(" · ")}</p>}

      <Scoreboard list={list} />
      {msg && <p className="note note-err" role="alert">{msg}</p>}

      {!e ? (
        writer ? (
          open ? <button className="btn btn-inline" disabled={busy} onClick={() => void start()}>Start my essay</button> : <p className="hint">This challenge isn&apos;t open for entries right now.</p>
        ) : <p className="hint">{student.first_name} hasn&apos;t started this one yet. Students write the essay in their own ScholarTasks login.</p>
      ) : (
        <>
          {e.team_family && <p className="note">Our team&apos;s own families can write for practice and get a certificate, but can&apos;t win a prize.</p>}

          <section className="challenge-step">
            <h3>📖 1. The topic</h3>
            <p className="challenge-prompt">{c.prompt}</p>
            {c.tips && <p className="hint" style={{ whiteSpace: "pre-wrap" }}>{c.tips}</p>}
            <label className="item-check">
              <input type="checkbox" checked={!!e.checklist.read} disabled={!canWrite} onChange={(x) => tick("read", x.target.checked)} />
              <span>I read the topic and the <a href={`/challenge/rules?id=${c.id}`}>rules</a>.</span>
            </label>
          </section>

          <section className="challenge-step">
            <h3>💡 2. Ideas (one on each line)</h3>
            <textarea className="input" rows={4} maxLength={4000} readOnly={!canWrite} value={ideas}
              placeholder="A time I…&#10;Something I'd change…&#10;Someone who taught me…" onChange={(x) => onIdeas(x.target.value)} />
            {canWrite && <div className="share-row" style={{ marginTop: 6 }}><VoiceButton value={ideas} onText={onIdeas} max={4000} small /><span className="hint">Thinking out loud is a great way to find ideas.</span></div>}
          </section>

          <section className="challenge-step">
            <h3>🗺️ 3. Plan: beginning, middle, end</h3>
            <textarea className="input" rows={4} maxLength={4000} readOnly={!canWrite} value={outline}
              placeholder="Beginning: …&#10;Middle: …&#10;End: …" onChange={(x) => onOutline(x.target.value)} />
            {canWrite && <div className="share-row" style={{ marginTop: 6 }}><VoiceButton value={outline} onText={onOutline} max={4000} small /></div>}
          </section>

          <section className="challenge-step">
            <h3>✍️ 4. My essay</h3>
            <div className="field" style={{ margin: "0 0 6px" }}>
              <label htmlFor="ch-title">Title (optional)</label>
              <input id="ch-title" className="input" maxLength={150} readOnly={!canWrite} defaultValue={e.title ?? ""} onChange={(x) => later({ title: x.target.value })} />
            </div>
            <textarea className="input essay-box" rows={16} maxLength={40000} readOnly={!canWrite} value={body} aria-label="My essay"
              onChange={(x) => onBody(x.target.value)} onPaste={blockPaste} onDrop={blockPaste} spellCheck />
            <p className="hint" style={{ margin: "4px 0 0" }}>
              <b className={words < c.min_words || words > c.max_words ? "" : "ok-text"}>{words} words</b> (needs {c.min_words} to {c.max_words})
              {canWrite && <> · {saved === "saving" ? "Saving…" : saved === "error" ? "Not saved. Check your connection." : "Saved"}</>}
              {" "}· Written on {e.writing_days} day{e.writing_days === 1 ? "" : "s"}
            </p>
            {canWrite && <p className="hint small">Pasting is turned off. Type it yourself: the judges can see how your essay grew. (Speak works for your ideas and plan; the essay itself is typed.)</p>}
          </section>

          {canWrite && (
            <section className="challenge-step">
              <h3>🧑‍🏫 5. Ask the coach</h3>
              <p className="hint">The coach points out what works and what to improve. It never writes for you. Uses one AI help.</p>
              <button className="btn btn-ghost btn-inline btn-sm" disabled={busy || words < 15} onClick={() => void askCoach()}>{busy ? "One moment…" : "Get tips on my draft"}</button>
              {coach && (
                <div className="panel" style={{ marginTop: 10 }}>
                  <p style={{ margin: "0 0 4px" }}><b>What works</b></p>
                  <ul>{coach.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
                  <p style={{ margin: "0 0 4px" }}><b>What to improve</b></p>
                  <ul>{coach.improve.map((x) => <li key={x}>{x}</li>)}</ul>
                  <p style={{ margin: 0 }}><b>Next step:</b> {coach.next_step}</p>
                  <ReportAi feature="essay challenge coach" text={[...coach.strengths, ...coach.improve, coach.next_step].join("\n")} />
                </div>
              )}
            </section>
          )}

          <section className="challenge-step">
            <h3>✨ 6. Polish</h3>
            {POLISH.map((p) => (
              <label key={p.key} className="item-check" style={{ display: "flex" }}>
                <input type="checkbox" checked={!!e.checklist[p.key]} disabled={!canWrite} onChange={(x) => tick(p.key, x.target.checked)} />
                <span>{p.label}</span>
              </label>
            ))}
          </section>

          <section className="challenge-step">
            <h3>✍️ 7. Family OK</h3>
            {permission ? <p className="note note-ok">Permission signed ✓</p> : mayGivePermission && open ? (
              signing ? (
                <SignConsent kind="challenge" student={student.id} target={c.id} version={RULES_VERSION}
                  title={adult && writer ? "Your agreement" : "Parent permission"}
                  wording={permissionWording(student.first_name, c, publicOk)}
                  onSigned={async () => {
                    const { error } = await sb.rpc("challenge_give_permission", { p_challenge: c.id, p_student: student.id, p_public: publicOk });
                    if (error) throw new Error(friendly(error));
                    setSigning(false);
                    await onChanged();
                  }}
                  onDecline={() => setSigning(false)} declineLabel="Not now" />
              ) : (
                <>
                  <label className="item-check" style={{ display: "flex" }}>
                    <input type="checkbox" checked={publicOk} onChange={(x) => setPublicOk(x.target.checked)} />
                    <span>If {student.first_name} wins, ScholarTasks may share their first name, grade and state.</span>
                  </label>
                  <button className="btn btn-inline btn-sm" onClick={() => setSigning(true)}>Read and sign permission</button>
                </>
              )
            ) : <p className="hint">Ask a parent to open <b>Essay challenge</b> in their own ScholarTasks login and sign. It takes one minute.</p>}
          </section>

          <section className="challenge-step">
            <h3>🏁 8. Send it in</h3>
            {e.status === "submitted" ? (
              <>
                <p className="note note-ok">Sent in on {day(e.submitted_at!)}. Well done! 🎉</p>
                {c.status === "done" && e.result && e.result !== "finisher" && (
                  <p className="note note-info"><b>{e.result === "winner" ? `🥇 ${e.place ? `Place ${e.place}! ` : ""}You won!` : "🎖️ You're a finalist!"}</b> Your certificate shows it.</p>
                )}
                {prize && <PrizePickup entry={e} student={student} prize={prize} mayPick={isParent || (writer && adult)} onPicked={(p) => setPrize(p)} />}
                <button className="btn btn-inline" onClick={() => void claim()}>{e.claimed_at ? "Open my certificate" : "🎓 Claim my certificate"}</button>
              </>
            ) : canWrite ? (
              <>
                <p className="hint">Check the steps above. Once you send it in, it can&apos;t be changed.</p>
                <button className="btn btn-inline" disabled={busy || words < c.min_words || words > c.max_words || !permission} onClick={() => void submit()}>Send my essay in</button>
                {!permission && <p className="hint small">Waiting for a parent to sign permission.</p>}
              </>
            ) : <p className="hint">{open ? `${student.first_name} sends it in from their own login.` : "This challenge has closed."}</p>}
          </section>
        </>
      )}
    </div>
  );
}

/** The Essay Challenge: write in the app, earn badges, send it in, claim a certificate. */
export default function ChallengePage() {
  const sb = supabase();
  const [isParent, setIsParent] = useState(false);
  const [own, setOwn] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [current, setCurrent] = useCurrentStudent();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!sb) return;
    const { data: s } = await sb.auth.getSession();
    if (!s.session) return window.location.replace("/signin?next=/challenge");
    const [mem, st, ch, en, pm] = await Promise.all([
      sb.from("family_members").select("role, student_id").eq("user_id", s.session.user.id),
      sb.from("students").select("id, first_name, grade_level, birth_date").order("first_name"),
      sb.from("challenges").select("*").neq("status", "draft").order("closes_at", { ascending: false }),
      sb.from("challenge_entries").select("*"),
      sb.from("challenge_permissions").select("challenge_id, student_id, public_name_ok"),
    ]);
    if (missing(ch.error)) { setOffline(true); setReady(true); return; }
    if (ch.error) setError(friendly(ch.error));
    const m = (mem.data as { role: string; student_id: string | null }[]) ?? [];
    const mine = m.find((r) => r.role === "student")?.student_id ?? null;
    setOwn(mine);
    setIsParent(m.some((r) => r.role === "parent"));
    const list = (st.data as Student[]) ?? [];
    setStudents(list);
    setCurrent((c) => c ?? (mine ?? pickStudent(list, list[0]?.id)));
    setChallenges((ch.data as Challenge[]) ?? []);
    setEntries((en.data as Entry[]) ?? []);
    setPerms((pm.data as Permission[]) ?? []);
    setReady(true);
  }, [sb, setCurrent]);
  useEffect(() => { void load(); }, [load]);

  if (!sb) return <Page title="Essay challenge"><NotConfigured /></Page>;
  if (!ready) return <Page title="Essay challenge"><p className="hint">Loading…</p></Page>;
  if (offline) return <Page title="Essay challenge"><div className="panel"><h2>Almost ready</h2><p className="hint" style={{ margin: 0 }}>The essay challenge is switching on. Check back shortly.</p></div></Page>;
  const student = students.find((s) => s.id === current);
  if (!student) return <Page title="Essay challenge"><p className="hint">Add a student on the <a href="/family">Family</a> page first.</p></Page>;

  const forGrade = challenges.filter((c) => student.grade_level >= c.grade_min && student.grade_level <= c.grade_max);
  const entryOf = (c: Challenge) => entries.find((e) => e.challenge_id === c.id && e.student_id === student.id) ?? null;
  const live = forGrade.filter((c) => c.status === "open" && new Date(c.closes_at).getTime() > Date.now());
  const past = forGrade.filter((c) => !live.includes(c) && (entryOf(c) || c.status === "done"));
  const opened = forGrade.find((c) => c.id === openId) ?? null;
  const writer = own === student.id;

  return (
    <Page title="Essay challenge">
      {isParent && students.length > 1 && (
        <div className="tabs" role="tablist" style={{ maxWidth: 420 }}>
          {students.map((s) => <button key={s.id} role="tab" aria-selected={s.id === current} onClick={() => { setCurrent(s.id); setOpenId(null); }}>{s.first_name}</button>)}
        </div>
      )}
      <p className="hint">
        Write a short essay right here in ScholarTasks, step by step. Earn badges as you go, send it in, and claim a certificate. Winners in each grade group win gift card prizes. Free and paid accounts have the same chance.
      </p>
      {error && <p className="note note-err" role="alert">{error}</p>}

      {opened ? (
        <>
          <button className="btn-link" onClick={() => setOpenId(null)}>← All challenges</button>
          <Workspace key={`${opened.id}-${student.id}`} c={opened} entry={entryOf(opened)} student={student} writer={writer} isParent={isParent}
            permission={perms.find((p) => p.challenge_id === opened.id && p.student_id === student.id) ?? null} onChanged={load} />
        </>
      ) : (
        <>
          <section className="panel">
            <h2>Open now for {grades({ grade_min: student.grade_level, grade_max: student.grade_level }).toLowerCase()}</h2>
            {live.length === 0 ? <p className="hint">No challenge is open for this grade right now. New topics come out from time to time, so check back soon.</p> : (
              <ul className="items">
                {live.map((c) => {
                  const e = entryOf(c);
                  const top = c.prizes.find((p) => p.place === 1);
                  return (
                    <li key={c.id}>
                      <div className="item-main">
                        <b>🏆 {c.title}</b>
                        <span className="hint">{c.subject} · {grades(c)} · closes {day(c.closes_at)}{top && top.amount ? ` · top prize ${money(top.amount)}` : ""}</span>
                      </div>
                      <div className="item-actions">
                        {e?.status === "submitted" ? <span className="pill pill-ok">Sent in ✓</span> : e ? <span className="pill">{e.words} words</span> : null}
                        <button className="btn btn-inline btn-sm" onClick={() => setOpenId(c.id)}>{e ? "Open" : writer ? "Take the challenge" : "Look"}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          {past.length > 0 && (
            <section className="panel">
              <h2>Past challenges</h2>
              <ul className="items">
                {past.map((c) => {
                  const e = entryOf(c);
                  return (
                    <li key={c.id}>
                      <div className="item-main">
                        <b>{c.title}</b>
                        <span className="hint">{c.subject} · {c.status === "done" ? "results are out" : "being judged"}</span>
                      </div>
                      <div className="item-actions">
                        {e?.status === "submitted" && <span className="pill pill-ok">{c.status === "done" && e.result ? RESULT[e.result] : "Finisher"}</span>}
                        <button className="btn btn-ghost btn-inline btn-sm" onClick={() => setOpenId(c.id)}>Open</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          <p className="hint small">How it works: read the topic, jot ideas, plan, write, come back another day to improve it, ask the coach for tips, polish, and send it in. A parent signs permission once. Every finished essay earns a certificate. <a href="/help#essay-challenge">More help</a></p>
        </>
      )}
    </Page>
  );
}
