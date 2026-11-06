import { FinalCta, PageHead } from "../parts";

export const metadata = {
  title: "Compare college apps · ScholarTasks",
  description: "How ScholarTasks compares with other college planning, scholarship and test prep apps on parent controls, AI counseling, HOPE tracking, FAFSA help, grades coaching and privacy.",
};

const APPS = ["Common App", "Scoir / Naviance", "BigFuture", "CollegeVine", "Going Merry", "Khan Academy + Bluebook"];

const PART1: [string, string, string[]][] = [
  ["Parent and student linked", "Yes, parent controls", ["No", "Yes", "No", "No", "No", "No"]],
  ["AI counselor", "Yes, knows your state, English or Spanish", ["No", "No", "No", "Yes", "No", "No"]],
  ["HOPE and Zell tracking", "Yes", ["No", "No", "No", "No", "No", "No"]],
  ["FAFSA and state aid help", "Yes, 11 Southeast states", ["No", "Some", "Some", "No", "Some", "No"]],
  ["Scholarship matching", "Yes, team-checked", ["No", "Some", "Yes", "Some", "Yes", "No"]],
  ["College search and quiz", "Yes", ["Yes", "Yes", "Yes", "Yes", "No", "No"]],
  ["Majors, careers and trades", "Yes, all three", ["No", "Some", "Some", "Some", "No", "No"]],
  ["Cost per college", "Yes, after state aid", ["No", "Yes", "Some", "No", "Some", "No"]],
];

const PART2: [string, string, string[]][] = [
  ["Grade coaching, grades 8 to 12", "Yes", ["No", "No", "No", "No", "No", "No"]],
  ["SAT and ACT practice", "Yes, 600+ questions", ["No", "No", "Links", "Some", "No", "Yes"]],
  ["Essay feedback that never writes", "Yes", ["No", "No", "No", "Some", "No", "No"]],
  ["Activities and resume", "Yes", ["Yes", "Yes", "No", "No", "No", "No"]],
  ["Reminders", "Email, text, calendar, phone", ["Email, phone", "Yes", "Yes", "No", "Email, phone", "Phone"]],
  ["School counselor dashboard", "Yes (free)", ["Yes", "Yes", "Yes", "No", "Some", "Yes"]],
  ["Never sells student data", "Yes", ["Yes", "Yes", "Opt-in to colleges", "Colleges buy access", "Yes", "Yes"]],
];

const PART3: [string, string, string[]][] = [
  ["Four-year course plan", "Yes, checks HOPE rigor", ["No", "Yes", "No", "No", "No", "No"]],
  ["Reach, match and likely from grades and scores", "Yes, GPA, rigor and tests", ["No", "Yes", "Some", "Yes", "No", "No"]],
  ["Homework help that never gives answers", "Yes, a second AI checks", ["No", "No", "No", "No", "No", "Yes"]],
  ["Compare aid offers", "Yes", ["No", "Some", "Some", "No", "Some", "No"]],
  ["Common App ready check, essay bundles, copy-ready profile", "Yes", ["No", "No", "No", "No", "Yes", "No"]],
  ["Spanish", "Menu and AI answers", ["Some", "Some", "Some", "No", "No", "Yes"]],
  ["Starts in grade 6", "Yes, parent-managed", ["No", "Yes", "No", "No", "No", "Yes"]],
  ["School roster upload", "Yes, with data agreement", ["No", "Yes", "Some", "No", "No", "Yes"]],
  ["Apply to scholarships inside the app", "Yes, step by step; school awards sent here", ["No", "No", "No", "No", "Yes", "No"]],
];

function Table({ caption, rows }: { caption: string; rows: [string, string, string[]][] }) {
  return (
    <div className="s-table-wrap" style={{ marginBottom: 28 }} role="region" aria-label={caption} tabIndex={0}>
      <table className="s-table">
        <caption className="s-kicker" style={{ textAlign: "left", padding: "14px 14px 10px", margin: 0 }}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" style={{ textAlign: "left" }}>Feature</th>
            <th scope="col" className="us">ScholarTasks</th>
            {APPS.map((a) => <th scope="col" key={a}>{a}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([feature, us, others]) => (
            <tr key={feature}>
              <th scope="row">{feature}</th>
              <td className="us">{us}</td>
              {others.map((v, i) => <td key={i} className={v === "No" ? "no" : ""}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Compare() {
  return (
    <>
      <PageHead kicker="How we compare" title="Other apps do one or two things. ScholarTasks does them together.">
        We looked at the apps families use most for college planning, scholarships and test prep. Here is an honest side by side.
      </PageHead>

      <div className="site-wrap">
        <Table caption="Planning and funding college" rows={PART1} />
        <Table caption="Grades, test prep, reminders and trust" rows={PART2} />
        <Table caption="New this fall: planning, homework, Spanish and schools" rows={PART3} />
        <p className="s-table-note">"Some" means a lighter version. Based on each app's own website and reviews, fall 2026. Details can change. App names belong to their owners; we are not connected with them.</p>
        <p className="s-table-note">On a phone, swipe the table sideways to see every app.</p>
      </div>

      <section className="s-section">
        <div className="site-wrap">
          <h2 className="s-title">What makes ScholarTasks different</h2>
          <div className="s-grid">
            <div className="s-card"><span className="s-icon gold" aria-hidden="true">🍑</span><h3>Built in Georgia</h3><p>HOPE, Zell Miller and Georgia's aid rules, plus 10 more Southeast states, explained the same way to every family. Searches still cover the whole country.</p></div>
            <div className="s-card"><span className="s-icon" aria-hidden="true">👪</span><h3>Built for families</h3><p>Parent and student work from one plan, with parent-controlled permissions.</p></div>
            <div className="s-card"><span className="s-icon green" aria-hidden="true">🌱</span><h3>Starts early</h3><p>Study habits from 6th grade, then grades, a four-year course plan and course choices, when they make the biggest difference.</p></div>
            <div className="s-card"><span className="s-icon purple" aria-hidden="true">🤝</span><h3>Honest AI</h3><p>It coaches and explains, never does the work, and never sells your child's data.</p></div>
          </div>
        </div>
      </section>

      <FinalCta />
    </>
  );
}
