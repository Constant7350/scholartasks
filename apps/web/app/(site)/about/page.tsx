import { FinalCta, PageHead } from "../parts";

export const metadata = {
  title: "About us · ScholarTasks",
  description: "ScholarTasks was made by a Georgia family: a parent, a teacher who reviews the lessons, and a high school senior who tests every page.",
};

export default function About() {
  return (
    <>
      <PageHead kicker="About us" title="Made by a Georgia family, for families like yours">
        We built ScholarTasks while going through college applications ourselves. We wanted one place that kept track of everything and explained it in plain language.
      </PageHead>

      <section className="s-section tint">
        <div className="site-wrap">
          <div className="s-grid s-grid-3">
            <div className="s-card"><span className="s-icon" aria-hidden="true">🛠️</span><h3>A parent who builds it</h3><p>Who got tired of tracking deadlines on a dozen websites and spreadsheets.</p></div>
            <div className="s-card"><span className="s-icon green" aria-hidden="true">🍎</span><h3>A teacher who checks it</h3><p>Who reviews the study lessons, practice questions and answers before families see them.</p></div>
            <div className="s-card"><span className="s-icon gold" aria-hidden="true">🎓</span><h3>A senior who tests it</h3><p>Who uses every page for real applications and tells us when something is confusing.</p></div>
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
