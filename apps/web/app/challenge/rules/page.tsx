"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { type Challenge, day, grades, rulesFor } from "../../../lib/challenge";
import { NotConfigured, Page } from "../../ui";

/** Official rules for each essay challenge. Public: no sign-in needed. */
export default function ChallengeRules() {
  const sb = supabase();
  const [list, setList] = useState<Challenge[] | null>(null);
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    setId(new URLSearchParams(window.location.search).get("id"));
    if (!sb) return;
    void sb.from("challenges").select("*").neq("status", "draft").order("closes_at", { ascending: false }).limit(50)
      .then(({ data }) => setList((data as Challenge[]) ?? []));
  }, [sb]);

  if (!sb) return <Page title="Essay challenge rules"><NotConfigured /></Page>;
  if (list === null) return <Page title="Essay challenge rules"><p className="hint">Loading…</p></Page>;
  const c = list.find((x) => x.id === id);

  if (!c) {
    return (
      <Page title="Essay challenge rules">
        <p className="hint">Pick a challenge to read its official rules.</p>
        {list.length === 0 ? <p className="hint">No challenges have been published yet.</p> : (
          <ul className="items">
            {list.map((x) => (
              <li key={x.id}>
                <div className="item-main"><b>{x.title}</b><span className="hint">{x.subject} · {grades(x)} · closes {day(x.closes_at)}</span></div>
                <div className="item-actions"><a className="btn btn-ghost btn-inline btn-sm" href={`/challenge/rules?id=${x.id}`}>Rules</a></div>
              </li>
            ))}
          </ul>
        )}
      </Page>
    );
  }

  return (
    <Page title="Official rules">
      <div className="panel challenge-rules">
        <h2 style={{ marginTop: 0 }}>🏆 {c.title}</h2>
        <p className="hint">ScholarTasks Essay Challenge · {c.subject} · {grades(c)}</p>
        {rulesFor(c).map((s) => (
          <section key={s.title}>
            <h3>{s.title}</h3>
            <ul>{s.lines.map((p) => <li key={p}>{p}</li>)}</ul>
          </section>
        ))}
        <p className="hint small">Rules version: 6 November 2026. This challenge is run by ScholarTasks.</p>
      </div>
      <p><a href="/challenge">Go to the essay challenge</a></p>
    </Page>
  );
}
