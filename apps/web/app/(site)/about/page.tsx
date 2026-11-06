import { FinalCta, PageHead } from "../parts";

export const metadata = {
  title: "About us · ScholarTasks",
  description: "ScholarTasks is a Georgia company building one easy app for college, scholarships and state aid, with every lesson and practice question checked by our review team.",
};

export default function About() {
  return (
    <>
      <PageHead kicker="About us" title="Built in Georgia, for families everywhere">
        ScholarTasks brings college plans, scholarships, state aid, grades and test prep into one place, and explains every step in plain language. Our goal is simple: no family should miss money or a deadline because the process was too confusing.
      </PageHead>

      <section className="s-section tint">
        <div className="site-wrap">
          <div className="s-grid s-grid-3">
            <div className="s-card"><span className="s-icon" aria-hidden="true">🛠️</span><h3>Our product team</h3><p>Designs and builds every page, so families stop tracking deadlines across a dozen websites and spreadsheets.</p></div>
            <div className="s-card"><span className="s-icon green" aria-hidden="true">🍎</span><h3>Our education review team</h3><p>Checks the study lessons, practice questions and answers before families see them.</p></div>
            <div className="s-card"><span className="s-icon gold" aria-hidden="true">🎓</span><h3>Tested with real students</h3><p>Students use ScholarTasks for real applications and tell us when something is confusing, so we can make it simpler.</p></div>
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="site-wrap">
          <h2 className="s-title">What we believe</h2>
          <div className="s-grid">
            <div className="s-card"><h3>Everything should be easy</h3><p>Fewer steps, fewer forms, fewer emails. If something takes more than a few taps, we work to make it shorter.</p></div>
            <div className="s-card"><h3>Start early</h3><p>The best time to help with HOPE and study habits is middle school, not senior year.</p></div>
            <div className="s-card"><h3>AI should teach, not do the work</h3><p>Our AI explains and coaches. It never does homework or writes essays, and it's advice only.</p></div>
            <div className="s-card"><h3>Every path is a good path</h3><p>Four-year college, community college or a skilled trade, close to home or across the country. Families choose.</p></div>
            <div className="s-card"><h3>Affordable for every family</h3><p>Free to start, and a family plan that costs less than most test prep or essay apps.</p></div>
            <div className="s-card"><h3>Your data is yours</h3><p>We never sell student data and never ask for the most sensitive numbers.</p></div>
          </div>
        </div>
      </section>

      <FinalCta title="We'd love to hear from you" text="Questions, ideas or feedback, we read every message." />
    </>
  );
}
