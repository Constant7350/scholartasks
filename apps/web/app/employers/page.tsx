import { PART_TIME_POST_FEE } from "@scholartasks/core";
import { Page } from "../ui";
import "../trades/trades.css";

export const metadata = {
  title: "Hire students for weekend and holiday jobs · ScholarTasks",
  description: "Local companies: make a free company account, post weekend, holiday and school-break jobs, and get applications from students with their parent's consent. Every company and job is checked by our review team.",
};

/** Public page for companies: how weekend and holiday jobs work on ScholarTasks. */
export default function EmployersPage() {
  return (
    <Page title="Hire students for weekend and holiday jobs">
      <p className="lead">
        Need help on Saturdays, over the holidays or during school breaks? Make a company account, post your job, and students
        near you apply right inside ScholarTasks. Every application comes with a parent&apos;s consent, so families stay in the loop from day one.
      </p>
      <p><a className="btn btn-inline" href="/signin?next=/employers/dashboard">Create a company account</a>{" "}
        <a className="btn btn-inline btn-ghost" href="/employers/dashboard">I already have one</a></p>

      <div className="trade-callouts">
        <div className="panel trade-callout"><b>1. Make your company account</b><span>Sign up with your work email and agree to the teen job rules. Our review team checks your company.</span></div>
        <div className="panel trade-callout"><b>2. Post a job</b><span>Weekend, holiday or school-break work, with pay, hours and the youngest age you can take. We check each post before students see it.</span></div>
        <div className="panel trade-callout"><b>3. Get applications with a parent&apos;s OK</b><span>A student applies in the app, a parent reads it and checks I agree, then it reaches you with the parent&apos;s email.</span></div>
      </div>

      <section className="panel">
        <h2>What you see from a student</h2>
        <p>Only what the application holds: first name, grade, age, their message, when they can work, the email or phone the family chose to share, and the parent&apos;s email.
          Never their grades, address, school records or anything else in their account.</p>
        <p>You move each application along (Seen, Let&apos;s meet, Hired or Not this time) and the family sees it right away.</p>
      </section>

      <section className="panel">
        <h2>The rules</h2>
        <p>Companies follow federal and state teen work laws: hours for 14 and 15 year olds, no hazardous jobs for anyone under 18, work permits where the state needs them,
          and at least minimum wage. Students meet you at your workplace, never alone in a car or a private home.</p>
        <p><a href="/employers/rules">Read the full rules and the official pages they come from</a></p>
      </section>

      <section className="panel">
        <h2>What it costs</h2>
        {PART_TIME_POST_FEE.freeWhileLaunching
          ? <p><b>Free while we launch.</b> Later, a weekend or holiday job post will be a small flat fee for {PART_TIME_POST_FEE.days} days. We&apos;ll tell you well before it starts,
              and nothing is charged without your OK. Students and families never pay to apply.</p>
          : <p>A flat ${PART_TIME_POST_FEE.amountUsd} for each job post, shown for {PART_TIME_POST_FEE.days} days. Students and families never pay to apply.</p>}
        <p className="hint">Apprenticeships and trade training can still be posted free at <a href="/trades/post">Post an apprenticeship</a>.</p>
      </section>
    </Page>
  );
}
