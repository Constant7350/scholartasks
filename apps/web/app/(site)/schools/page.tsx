import { FaqList, FinalCta, PageHead } from "../parts";

export const metadata = {
  title: "For schools and counselors · ScholarTasks",
  description: "ScholarTasks supports school counselors with a free school portal: see which connected students need help, send reminders and post local scholarships.",
};

const FAQ = [
  { q: "Does ScholarTasks replace our counselors?", a: "No. It's meant to support them. Families get the routine answers and reminders at home, so counselor time can go to the conversations that need a person." },
  { q: "Is student data shared with colleges or advertisers?", a: "No. We never sell student data. We never ask for FSA IDs, Social Security numbers or tax returns, and each family's information is kept separate." },
  { q: "What does the school portal cost?", a: "Nothing. The school portal is free for every school. Families use ScholarTasks free and can upgrade for the AI counselor and tutor. AI packages for whole schools will come later." },
  { q: "What can counselors see?", a: "Only students whose families connected to your school, and only what each family chose to share: progress, or progress and grades. Never essays, AI chats, income or aid answers. Every look is recorded." },
  { q: "Can we upload our roster?", a: "Yes, if you want to. You can start with just your school code, no data agreement needed. To upload a class list, your school admin signs our student data agreement in the portal, then uploads a CSV with names, grade, school ID and an optional email. You see who has joined and can email your code to families who haven't. No grades are uploaded, and the roster is deleted within 45 days if the agreement ends. We will also sign your district's own agreement." },
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
            <div className="s-card"><span className="s-icon green" aria-hidden="true">🌱</span><h3>Starts in middle school</h3><p>Study habits from 6th grade, then grades coaching, a four-year course plan and course advice from 8th grade, long before senior-year deadlines.</p></div>
            <div className="s-card"><span className="s-icon coral" aria-hidden="true">🔧</span><h3>Every path counts</h3><p>College, community college transfer and 67 skilled trades, with training options across the country.</p></div>
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="site-wrap">
          <p className="s-kicker">Free for every school</p>
          <h2 className="s-title">The school counselor portal</h2>
          <p className="s-lede">See which connected students haven't filed the FAFSA, have no college list or have overdue deadlines. Send a reminder to a whole grade in one step, and post local scholarships only your families see. Students apply for them right in the app, and you mark each one awarded or not.</p>
          <div className="s-cta">
            <a className="btn" href="/school">Set up your school</a>
            <a className="btn btn-ghost" href="/contact?topic=school">Talk with us</a>
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
