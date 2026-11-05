import { FaqList, FinalCta, PageHead } from "../parts";

export const metadata = {
  title: "For schools and counselors · ScholarTasks",
  description: "ScholarTasks supports school counselors: families arrive better prepared, and Georgia aid rules are explained the same way to everyone. School licenses and a counselor dashboard are coming.",
};

const FAQ = [
  { q: "Does ScholarTasks replace our counselors?", a: "No. It's meant to support them. Families get the routine answers and reminders at home, so counselor time can go to the conversations that need a person." },
  { q: "Is student data shared with colleges or advertisers?", a: "No. We never sell student data. We never ask for FSA IDs, Social Security numbers or tax returns, and each family's information is kept separate." },
  { q: "Is there a counselor dashboard?", a: "It's planned, but not built yet. We'd love a few Georgia schools to help shape it, so it shows what counselors actually need." },
  { q: "How would school licenses work?", a: "We're working that out now with interested schools. Get in touch and we'll set up a time to talk." },
];

export default function Schools() {
  return (
    <>
      <PageHead kicker="For schools and counselors" title="Support your counselors, not replace them">
        Families come in better prepared, and Georgia aid rules are explained the same way to everyone. ScholarTasks handles the reminders and routine questions, so counselors can focus on students.
      </PageHead>

      <section className="s-section tint">
        <div className="site-wrap">
          <div className="s-grid">
            <div className="s-card"><span className="s-icon" aria-hidden="true">📚</span><h3>Better prepared families</h3><p>Parents and students arrive knowing their HOPE GPA, their deadlines and the next step on the FAFSA.</p></div>
            <div className="s-card"><span className="s-icon gold" aria-hidden="true">🍑</span><h3>Georgia rules, explained the same way</h3><p>HOPE, Zell Miller and Georgia aid forms, in plain language for every family.</p></div>
            <div className="s-card"><span className="s-icon green" aria-hidden="true">🌱</span><h3>Starts in middle school</h3><p>Grades coaching, study skills and course advice from 8th grade, long before senior-year deadlines.</p></div>
            <div className="s-card"><span className="s-icon coral" aria-hidden="true">🔧</span><h3>Every path counts</h3><p>College, community college transfer and 50 skilled trades, with training options across the country.</p></div>
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="site-wrap">
          <p className="s-kicker">Coming next</p>
          <h2 className="s-title">Help us shape the counselor dashboard</h2>
          <p className="s-lede">A counselor dashboard and school licenses are next on our list. We're looking for a few Georgia schools to try it early and tell us what would help most.</p>
          <div className="s-cta">
            <a className="btn" href="/contact?topic=school">Talk with us</a>
            <a className="btn btn-ghost" href="/#tour">Watch the tour</a>
          </div>
        </div>
      </section>

      <section className="s-section tint">
        <div className="site-wrap">
          <h2 className="s-title">Questions from schools</h2>
          <FaqList items={FAQ} />
        </div>
      </section>

      <FinalCta title="Bring ScholarTasks to your families" text="Tell us about your school and we'll get back to you." />
    </>
  );
}
