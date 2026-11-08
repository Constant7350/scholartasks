"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { friendly, supabase } from "../../lib/supabase";
import { SignConsent } from "../sign-consent";
import { type Challenge, type Entry, RULES_VERSION, day, grades, money, permissionWording, prizeText } from "../../lib/challenge";
import { levelName } from "../practice/levels";
import { PrizePickup, type MyPrize } from "./prize-pickup";

interface Student { id: string; first_name: string; grade_level: number; birth_date: string }
interface Q { n: number; topic: string; level: number; question: string; options: string[]; picked: number | null }
interface Reviewed extends Q { answer_index: number; explanation: string | null }

const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
const clock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const isAdult = (birth: string) => { const b = new Date(birth); const t = new Date(); return t.getFullYear() - b.getFullYear() - (t < new Date(t.getFullYear(), b.getMonth(), b.getDate()) ? 1 : 0) >= 18; };

/**
 * A practice competition: one class, the same fresh questions for everyone, a timer, and
 * automatic scoring (harder questions count more, faster wins ties). Right and wrong stay
 * hidden until it closes; winners are never named in public.
 */
export function Competition({ c, entry, student, writer, isParent, permission, onChanged }: {
  c: Challenge; entry: Entry | null; student: Student; writer: boolean; isParent: boolean;
  permission: unknown; onChanged: () => Promise<void> | void;
}) {
  const sb = supabase()!;
  const [e, setE] = useState<Entry | null>(entry);
  const [qs, setQs] = useState<Q[] | null>(null);
  const [orders, setOrders] = useState<Record<number, number[]>>({});
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [at, setAt] = useState(0);
  const [ready, setReady] = useState(false);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [review, setReview] = useState<Reviewed[] | null>(null);
  const [prize, setPrize] = useState<MyPrize | null>(null);
  const adult = isAdult(student.birth_date);
  const open = c.status === "open" && new Date(c.closes_at).getTime() > Date.now();
  const running = !!qs && e?.status === "draft";
  const minutes = c.time_minutes ?? 30;

  useEffect(() => setE(entry), [entry]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  useEffect(() => {
    if (!e || e.status !== "submitted") return;
    if (c.status === "done") void sb.rpc("challenge_my_prize", { p_entry: e.id }).then(({ data }) => setPrize((data as MyPrize | null) ?? null));
    if (c.status !== "open" || new Date(c.closes_at).getTime() < Date.now()) {
      void sb.rpc("challenge_practice_review", { p_entry: e.id }).then(({ data }) => setReview((data as Reviewed[] | null) ?? null));
    }
  }, [sb, c.status, c.closes_at, e]);

  const finish = useCallback(async (id: string) => {
    setBusy(true);
    const { error } = await sb.rpc("challenge_practice_finish", { p_entry: id });
    setBusy(false);
    if (error) setMsg(friendly(error));
    setQs(null);
    await onChanged();
  }, [sb, onChanged]);

  // Time's up: send it in.
  useEffect(() => { if (running && endsAt && now >= endsAt && e && !busy) void finish(e.id); }, [running, endsAt, now, e, busy, finish]);

  const load = async (id: string) => {
    const { data, error } = await sb.rpc("challenge_practice_start", { p_entry: id });
    if (error) { setMsg(friendly(error)); await onChanged(); return; }
    const out = data as { ends_at: string; questions: Q[] };
    setQs(out.questions);
    setOrders(Object.fromEntries(out.questions.map((q) => [q.n, shuffle([0, 1, 2, 3])])));
    setEndsAt(new Date(out.ends_at).getTime());
    setAt(Math.max(0, out.questions.findIndex((q) => q.picked == null)));
  };
  const start = async () => {
    setBusy(true); setMsg(null);
    let id = e?.id;
    if (!id) {
      const { data, error } = await sb.from("challenge_entries").insert({ challenge_id: c.id, student_id: student.id }).select("*").single();
      if (error) { setBusy(false); return setMsg(friendly(error)); }
      setE(data as Entry); id = (data as Entry).id;
    }
    await load(id);
    setBusy(false);
  };
  const join = async () => {
    setBusy(true); setMsg(null);
    const { data, error } = await sb.from("challenge_entries").insert({ challenge_id: c.id, student_id: student.id }).select("*").single();
    setBusy(false);
    if (error) return setMsg(friendly(error));
    setE(data as Entry);
    await onChanged();
  };
  const answer = async (q: Q, choice: number) => {
    if (!e || q.picked != null) return;
    setQs((list) => list?.map((x) => (x.n === q.n ? { ...x, picked: choice } : x)) ?? null);
    const { error } = await sb.rpc("challenge_practice_answer", { p_entry: e.id, p_n: q.n, p_choice: choice });
    if (error) setMsg(friendly(error));
  };
  const claim = async () => {
    if (!e) return;
    const { data, error } = await sb.rpc("challenge_claim", { p_entry: e.id });
    if (error) return setMsg(friendly(error));
    window.location.href = `/challenge/certificate?code=${data as string}`;
  };

  const done = qs?.filter((q) => q.picked != null).length ?? 0;
  const q = qs?.[at];
  const reviewRight = useMemo(() => review?.filter((r) => r.picked === r.answer_index).length ?? 0, [review]);

  return (
    <div className="panel">
      <p className="eyebrow" style={{ margin: 0 }}>🏁 Practice competition · {c.subject} · {grades(c)}</p>
      <h2 style={{ marginTop: 4 }}>{c.title}</h2>
      {!running && (
        <>
          <p>{c.prompt}</p>
          <ul className="gaps">
            <li>{`Same new questions for everyone. You have ${minutes} minutes once you start, and one try.`}</li>
            <li>Harder questions are worth more: Strong 3 points, Advanced 4, Expert 5. Ties go to the faster finish.</li>
            <li>{`Open until ${day(c.closes_at)}. Right and wrong answers show after it closes.`}</li>
            {c.prizes.length > 0 && <li>Prizes: {c.prizes.map(prizeText).join("; ")}. Winners are never named in public.</li>}
          </ul>
          <p className="hint small"><a href={`/challenge/rules?id=${c.id}`}>Official rules</a></p>
        </>
      )}
      {msg && <p className="note note-err" role="alert">{msg}</p>}

      {/* Parent permission */}
      {!running && e?.status !== "submitted" && open && (
        <section className="challenge-step">
          <h3>✍️ Parent permission</h3>
          {permission ? <p className="note note-ok">Signed. {student.first_name} can take part.</p>
            : isParent || (writer && adult) ? (
              signing ? (
                <SignConsent kind="challenge" student={student.id} target={c.id} version={RULES_VERSION} title="Competition permission" button="Sign permission"
                  wording={permissionWording(student.first_name, c, false)}
                  onSigned={async () => {
                    const { error } = await sb.rpc("challenge_give_permission", { p_challenge: c.id, p_student: student.id, p_public: false });
                    if (error) throw new Error(friendly(error));
                    setSigning(false);
                    await onChanged();
                  }}
                  onDecline={() => setSigning(false)} declineLabel="Not now" />
              ) : <button className="btn btn-inline btn-sm" onClick={() => setSigning(true)}>Read and sign permission</button>
            ) : (
              <>
                <p className="hint">Ask a parent to open <b>Challenges</b> in their own ScholarTasks login and sign. It takes one minute.</p>
                {writer && !e && <button className="btn btn-inline btn-sm" disabled={busy} onClick={() => void join()}>Ask my parent to sign</button>}
                {writer && e && <p className="hint small">Your parent sees this on their Home page.</p>}
              </>
            )}
        </section>
      )}

      {/* Start */}
      {!running && e?.status !== "submitted" && open && writer && !!permission && (
        ready || e?.started_at ? (
          <button className="btn btn-inline" disabled={busy} onClick={() => void start()}>{e?.started_at ? "Go back to my questions" : `Start now (${minutes} minutes)`}</button>
        ) : (
          <button className="btn btn-inline" onClick={() => setReady(true)}>I&apos;m ready to start</button>
        )
      )}
      {!running && ready && !e?.started_at && <p className="hint">The clock starts when you press Start and doesn&apos;t stop, so find a quiet spot first.</p>}
      {!running && !writer && e?.status !== "submitted" && open && <p className="hint">{student.first_name} takes the competition from their own login.</p>}

      {/* Running */}
      {running && q && (
        <section className="competition-run">
          <div className="score-head">
            <b className={endsAt && endsAt - now < 60000 ? "time-low" : ""}>⏱ {clock((endsAt ?? now) - now)}</b>
            <span className="hint" style={{ margin: 0 }}>{`Question ${at + 1} of ${qs!.length} · ${done} answered`}</span>
          </div>
          <p className="eyebrow">{q.topic} · {levelName(q.level)}</p>
          <p style={{ fontSize: 18 }} translate="no"><b>{q.question}</b></p>
          <div className="chips" style={{ justifyContent: "flex-start" }}>
            {(orders[q.n] ?? [0, 1, 2, 3]).map((j) => (
              <button key={j} type="button" translate="no" disabled={q.picked != null} className={`chip ${q.picked === j ? "chip-on" : ""}`} onClick={() => void answer(q, j)}>{q.options[j]}</button>
            ))}
          </div>
          {q.picked != null && <p className="hint">Saved. You&apos;ll see if it was right after the competition closes.</p>}
          <div className="competition-dots" aria-label="Questions">
            {qs!.map((x, i) => <button key={x.n} type="button" className={`${x.picked != null ? "on" : ""} ${i === at ? "here" : ""}`} aria-label={`Question ${i + 1}`} onClick={() => setAt(i)} />)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {at > 0 && <button className="btn btn-ghost btn-inline" onClick={() => setAt(at - 1)}>← Back</button>}
            {at + 1 < qs!.length && <button className="btn btn-inline" onClick={() => setAt(at + 1)}>Next →</button>}
            <button className={`btn btn-inline ${at + 1 < qs!.length ? "btn-ghost" : ""}`} disabled={busy} onClick={() => { if (done === qs!.length || at + 1 === qs!.length) void finish(e!.id); else setAt(qs!.findIndex((x) => x.picked == null)); }}>
              {done === qs!.length || at + 1 === qs!.length ? "Finish and send in" : "Go to an unanswered question"}
            </button>
          </div>
        </section>
      )}

      {/* Finished */}
      {e?.status === "submitted" && (
        <section className="challenge-step">
          <p className="note note-ok">{`Sent in. Your score: ${e.points ?? 0} points (${e.correct ?? 0} right of ${e.answered ?? 0} answered).`}</p>
          {c.status === "done" && e.result === "winner" && <p className="note note-info"><b>{`🥇 Place ${e.place ?? ""}! You won!`}</b> Your certificate shows it.</p>}
          {c.status !== "done" && <p className="hint">Results come out after the competition closes.</p>}
          {prize && <PrizePickup entry={e} student={student} prize={prize} mayPick={isParent || (writer && adult)} onPicked={setPrize} kindName="practice competition" />}
          <button className="btn btn-inline" onClick={() => void claim()}>{e.claimed_at ? "Open my certificate" : "🎓 Claim my certificate"}</button>
          {review && review.length > 0 && (
            <details className="rescue-more" style={{ marginTop: 12 }}>
              <summary>{`See the answers (${reviewRight} of ${review.length} right)`}</summary>
              <ol className="competition-review">
                {review.map((r) => (
                  <li key={r.n}>
                    <b translate="no">{r.question}</b>
                    <span className={r.picked === r.answer_index ? "ok" : "miss"}>
                      {r.picked === r.answer_index ? <span>✓</span> : r.picked == null ? <span>Skipped.</span> : <span>{`✗ You picked ${r.options[r.picked]}.`}</span>}{" "}
                      <span>{`Answer: ${r.options[r.answer_index]}`}</span>
                    </span>
                    {r.explanation && <span className="hint">{r.explanation}</span>}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </section>
      )}
      {!open && !e && <p className="hint">This competition has closed.</p>}
      {c.prizes.some((p) => p.kind !== "certificate" && p.amount > 0) && !running && <p className="hint small">{`Top prize: ${money(Math.max(...c.prizes.map((p) => p.amount)))} digital gift card, picked up by a parent inside the app.`}</p>}
    </div>
  );
}
