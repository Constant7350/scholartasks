"use client";

import { useEffect, useMemo, useState } from "react";
import { Page } from "../ui";
import { AREAS, searchTopics, type Topic } from "./content";
import { SUPPORT_EMAIL } from "../legal";
import { setHelpOn } from "./balloons";

const POPULAR = ["invite code", "HOPE", "reminders", "AI uses", "report card photo", "scholarship matches", "permissions"];

function TopicCard({ t, open, onToggle }: { t: Topic; open: boolean; onToggle: () => void }) {
  return (
    <article id={t.id} className={`panel help-topic ${open ? "help-open" : ""}`}>
      <button className="help-topic-head" aria-expanded={open} onClick={onToggle}>
        <span>
          <span className="help-area">{t.area}</span>
          <b>{t.title}</b>
          <span className="hint">{t.summary}</span>
        </span>
        <span className="help-chev" aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="help-topic-body">
          {t.steps && (
            <ol>
              {t.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          {t.body?.map((p, i) => <p key={i}>{p}</p>)}
          {t.faq && (
            <dl>
              {t.faq.map((f) => (
                <div key={f.q}>
                  <dt>{f.q}</dt>
                  <dd>{f.a}</dd>
                </div>
              ))}
            </dl>
          )}
          {t.id === "contact" && <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>}
          {t.href && t.href !== "/help" && (
            <p style={{ marginBottom: 0 }}>
              <a className="btn btn-ghost btn-inline btn-sm link-btn" href={t.href} onClick={() => setHelpOn(true)}>Open this page with help on →</a>
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export default function HelpPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Support /help?q=words and /help#topic-id links.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    if (initial) setQ(initial);
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (hash) {
      setOpen(new Set([hash]));
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }));
    }
  }, []);

  const results = useMemo(() => searchTopics(q), [q]);
  const searching = q.trim().length > 0;
  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  return (
    <Page title="Help">
      <p className="hint" style={{ marginTop: -8 }}>
        Search the manual, or tap the <b>?</b> button at the top of any page to see help balloons right where you are.
      </p>
      <div className="help-search-wrap">
        <input
          className="input help-search"
          type="search"
          placeholder="Search help, for example: invite code"
          aria-label="Search help"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      {!searching && (
        <div className="chips" style={{ margin: "10px 0 6px" }}>
          {POPULAR.map((p) => <button key={p} className="chip" onClick={() => setQ(p)}>{p}</button>)}
        </div>
      )}

      {searching ? (
        <>
          <p className="hint" role="status">
            {results.length ? `${results.length} ${results.length === 1 ? "topic" : "topics"} found` : "Nothing found. Try fewer or different words."}
          </p>
          {results.map((t) => <TopicCard key={t.id} t={t} open={open.has(t.id)} onToggle={() => toggle(t.id)} />)}
          {!results.length && (
            <p>Still stuck? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
          )}
        </>
      ) : (
        AREAS.map((a) => (
          <section key={a}>
            <h2 className="section-title">{a}</h2>
            {results.filter((t) => t.area === a).map((t) => <TopicCard key={t.id} t={t} open={open.has(t.id)} onToggle={() => toggle(t.id)} />)}
          </section>
        ))
      )}
    </Page>
  );
}
