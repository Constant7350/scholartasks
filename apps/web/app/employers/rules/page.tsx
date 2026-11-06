import { OPENING_RULES, TEEN_JOB_LAW_LINKS, TEEN_JOB_RULES } from "@scholartasks/core";
import { Page } from "../../ui";
import "../../trades/trades.css";

export const metadata = {
  title: "Teen job rules for companies · ScholarTasks",
  description: "The rules every company agrees to before posting weekend and holiday jobs for students on ScholarTasks, with links to the official U.S. Department of Labor pages.",
};

/** The rules companies agree to for weekend and holiday jobs. Public, so families can read them too. */
export default function EmployerRulesPage() {
  return (
    <Page title="Teen job rules for companies">
      <p className="hint"><a href="/employers">← Hire students for weekend and holiday jobs</a></p>
      <p className="lead">Every company agrees to these rules before it can post. Our review team checks each company and each job, and three reports from families take a job down while we look.</p>
      <section className="panel">
        <h2>Weekend and holiday jobs</h2>
        <ol className="opening-rules">{TEEN_JOB_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
      </section>
      <section className="panel">
        <h2>Every listing</h2>
        <ul className="opening-rules">{OPENING_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
      <section className="panel">
        <h2>Official pages</h2>
        <ul>{TEEN_JOB_LAW_LINKS.map((l) => <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>)}</ul>
        <p className="hint small">These rules are a summary of the federal rules. Your state can be stricter, and the stricter rule always applies. This page isn&apos;t legal advice.</p>
      </section>
    </Page>
  );
}
