import { FinalCta, PageHead } from "../parts";

export const metadata = {
  title: "Features · ScholarTasks",
  description: "Everything ScholarTasks does: AI counselor, matched scholarships, HOPE and Zell tracking, grades coaching and a four-year course plan from 6th grade, homework help, SAT and ACT prep, college and major search, trades, FAFSA help, text reminders and Spanish.",
};

const NAV = [
  ["#counselor", "AI counselor"],
  ["#scholarships", "Scholarships"],
  ["#grades", "Grades and HOPE"],
  ["#study", "Study and test prep"],
  ["#colleges", "Colleges and majors"],
  ["#trades", "Trades"],
  ["#aid", "FAFSA and aid"],
  ["#todo", "To-do and reminders"],
  ["#beyond", "Beyond grades"],
  ["#family", "Family and phone"],
];

export default function Features() {
  return (
    <>
      <PageHead kicker="Features" title="Everything your family needs, from 6th grade to graduation">
        Every part of ScholarTasks shares one plan, so a grade, a saved scholarship or a college on the list shows up everywhere it matters.
      </PageHead>

      <div className="site-wrap">
        <nav className="s-feature-nav" aria-label="Jump to a feature">
          {NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>

        <article className="s-feature" id="counselor">
          <div>
            <p className="s-kicker">AI counselor</p>
            <h2>A college counselor on call, who knows your student</h2>
            <p>The AI counselor can see your student's grades, college list and deadlines, so its answers are about your child, not general advice.</p>
            <ul>
              <li>Knows your state's scholarship and aid rules: HOPE and Zell Miller in Georgia, plus 10 more Southeast states</li>
              <li>Answers in English or Spanish</li>
              <li>Always shows options across the country, not just nearby</li>
              <li>Explains and coaches, but never does homework or writes essays</li>
              <li>Advice only: your family makes the decisions</li>
            </ul>
          </div>
          <div className="s-visual">
            <div className="m-card"><b>Emma asked</b><span className="m-sub">Can I still get Zell Miller if I retake the ACT?</span></div>
            <div className="m-bubble">Yes, a retake can help. Here is the score Zell needs, how close your last test was, and the next test date. Want a 4-week practice plan to get there?</div>
            <span className="s-fine" style={{ margin: 0 }}>Sample conversation, simplified</span>
          </div>
        </article>

        <article className="s-feature flip" id="scholarships">
          <div>
            <p className="s-kicker">Scholarships and grants</p>
            <h2>Matched awards, sorted for you</h2>
            <p>Instead of searching a dozen websites, students answer a few questions. Then they see awards sorted into You qualify, Maybe and Not a fit.</p>
            <ul>
              <li>Hundreds of state and national awards, checked on their official pages, with an AI finder adding more each week</li>
              <li>Kept up to date twice a week from September to March</li>
              <li>"Maybe" tells you exactly what to check</li>
              <li>Application checklist and essay feedback, never written for you</li>
              <li>Essay bundles: one draft for awards that ask similar questions</li>
              <li>A copy-ready profile to paste into any application form</li>
              <li>One tap adds the deadline to your plan</li>
            </ul>
          </div>
          <div className="s-visual gold">
            <div className="s-chips"><span className="on">You qualify</span><span>Maybe</span><span>Coming up</span><span>Saved</span></div>
            <div className="m-card">
              <div className="m-row"><b>Georgia community award</b><span className="m-amt">$1,000</span></div>
              <span className="m-sub">Deadline: usually mid-December</span>
              <span style={{ color: "var(--ok)" }}>Yes: seniors</span>
              <span style={{ color: "var(--ok)" }}>Yes: 2.5 GPA needed, you have 3.4</span>
            </div>
            <span className="s-fine" style={{ margin: 0 }}>Sample card, simplified</span>
          </div>
        </article>

        <article className="s-feature" id="grades">
          <div>
            <p className="s-kicker">Grades and HOPE</p>
            <h2>No surprises about HOPE in senior year</h2>
            <p>HOPE is earned in high school, so starting early matters. From 8th grade on, the scorecard shows the HOPE GPA next to the school GPA. Parents can add younger students in grades 6 and 7 for study habits and early planning.</p>
            <ul>
              <li>Add grades by hand, or snap a photo of the report card</li>
              <li>Grade Rescue asks a few questions and builds a simple plan</li>
              <li>Course advice weighs subject choice and harder classes</li>
              <li>A four-year course plan checked against graduation credits and HOPE rigor, with an AI check</li>
              <li>Goals the family sets together, and a printable academic record</li>
              <li>Free <a href="/tools/hope">state scholarship checker</a> (HOPE, Bright Futures, TOPS and more), no account needed</li>
            </ul>
          </div>
          <div className="s-visual green">
            <div className="m-card">
              <div className="m-gpa"><div><span>HOPE GPA</span><strong>3.42</strong></div><div><span>Zell needs</span><strong>3.70</strong></div></div>
            </div>
            <div className="m-card"><b>Grade Rescue: Chemistry</b><span className="m-sub">1. Retake the unit 3 quiz by Friday</span><span className="m-sub">2. 20 minutes of practice, 3 nights a week</span><span className="m-sub">3. Check in again in two weeks</span></div>
          </div>
        </article>

        <article className="s-feature flip" id="study">
          <div>
            <p className="s-kicker">Study skills and test prep</p>
            <h2>A tutor that teaches, not an answer machine</h2>
            <p>Good grades come from good habits. ScholarTasks teaches students how to study, helps with homework without doing it for them, lets them test themselves and helps them get ready for the SAT and ACT.</p>
            <ul>
              <li>Homework Helper for every subject: hints one at a time, checks their work, never gives answers or writes for them, and a second AI checks every reply</li>
              <li>A thinking score for parents: problems finished with fewer hints each week</li>
              <li>Study skills library, checked by our education review team</li>
              <li>Over 600 original SAT and ACT practice questions</li>
              <li>Timed practice tests and a score plan</li>
              <li>Practice questions for school subjects, to self-test before a test</li>
            </ul>
            <p className="s-fine">Our questions are written by us, not copied from real tests.</p>
          </div>
          <div className="s-visual purple">
            <div className="m-card"><b>SAT Math · Question 12 of 20</b><span className="m-sub">A phone plan costs $25 a month plus $0.10 per text. Which expression gives the cost of t texts?</span></div>
            <div className="s-chips"><span>A) 25t + 0.10</span><span className="on">B) 25 + 0.10t</span><span>C) 25.10t</span></div>
            <div className="m-card"><span style={{ color: "var(--ok)" }}>Correct. The $25 stays the same; only the texts change.</span></div>
          </div>
        </article>

        <article className="s-feature" id="colleges">
          <div>
            <p className="s-kicker">Colleges and majors</p>
            <h2>Find the right school, at a cost you can see</h2>
            <p>Search almost 2,000 colleges across the country, take a quick match quiz and add a school with one tap. Home-state options come first, but every search covers the whole country.</p>
            <ul>
              <li>Search by major, with typical earnings and years for each degree</li>
              <li>Estimated cost after state aid and saved scholarships</li>
              <li>Reach, match and likely using grades, harder classes and test scores</li>
              <li>Compare aid offers side by side, and a deep career interest quiz with a new mix of questions every time</li>
              <li>See the savings from starting at a community college, then transferring</li>
              <li>Essay coach that gives feedback but never writes for the student</li>
            </ul>
          </div>
          <div className="s-visual">
            <div className="m-card"><b>Marine biology · 4-year degree</b><span className="m-sub">Schools in Georgia and nationwide</span></div>
            <div className="m-card"><div className="m-row"><b>Start at community college, then transfer</b></div><span className="m-sub">Could save about $14,000 over two years</span></div>
            <span className="s-fine" style={{ margin: 0 }}>Sample numbers, for illustration</span>
          </div>
        </article>

        <article className="s-feature flip" id="trades">
          <div>
            <p className="s-kicker">Trades and careers</p>
            <h2>College isn't the only path</h2>
            <p>For students who want to build, fix or care for things, ScholarTasks maps out 50 skilled trades just as carefully as colleges.</p>
            <ul>
              <li>Earnings, training time and licensing for each trade</li>
              <li>Training schools and apprenticeships in every state</li>
              <li>A quiz to find trades that fit, and apply checklists</li>
              <li>Ways to fund training, from federal and state aid to trade scholarships</li>
            </ul>
            <p><a href="/trades">Explore the trades</a></p>
          </div>
          <div className="s-visual coral">
            <div className="s-chips"><span className="on">Electrician</span><span>Welder</span><span>HVAC</span><span>Vet tech</span><span>Plumber</span></div>
            <div className="m-card"><b>Electrician</b><span className="m-sub">Training: 4 to 5 year apprenticeship, earn while you learn</span><span className="m-sub">License: required in most states</span></div>
          </div>
        </article>

        <article className="s-feature" id="aid">
          <div>
            <p className="s-kicker">FAFSA and state aid</p>
            <h2>Aid forms in small, clear steps</h2>
            <p>ScholarTasks breaks the FAFSA and your state's aid form into small steps, and explains who does each part. You still file on the official government websites.</p>
            <ul>
              <li>A checklist that shows what the parent does and what the student does</li>
              <li>Plain-language help for every step</li>
              <li>We never ask for or keep FSA IDs, Social Security numbers or tax returns</li>
            </ul>
          </div>
          <div className="s-visual gold">
            <div className="m-card"><span className="m-sub">✓ Step 1 · Student makes an FSA ID</span><span className="m-sub">✓ Step 2 · Parent makes an FSA ID</span><b>○ Step 3 · Student starts the FAFSA</b><span className="m-sub">○ Step 4 · Parent adds their part</span></div>
          </div>
        </article>

        <article className="s-feature flip" id="todo">
          <div>
            <p className="s-kicker">To-do and reminders</p>
            <h2>Every date, in one list</h2>
            <p>Everything with a date lands on one to-do list, already sorted into late, due this week and coming up.</p>
            <ul>
              <li>Email reminders a month before, then two weeks, one week, two days and one day before</li>
              <li>Add dates to your own Google or Apple calendar</li>
              <li>Text reminders, if you turn them on</li>
              <li>Phone reminders in the app</li>
            </ul>
          </div>
          <div className="s-visual green">
            <div className="m-card"><span className="m-tag warn">Due this week</span><b>Georgia Tech early action</b><span className="m-sub">Friday · Emma</span></div>
            <div className="m-card"><span className="m-tag">Coming up</span><b>CSS Profile</b><span className="m-sub">in 3 weeks · Parent</span></div>
          </div>
        </article>

        <article className="s-feature" id="beyond">
          <div>
            <p className="s-kicker">Beyond grades</p>
            <h2>Activities, service and letters, kept as you go</h2>
            <p>Colleges and scholarships also look at activities, leadership, service and recommendation letters. Each school year, ScholarTasks adds the right milestones to the to-do list.</p>
            <ul>
              <li>Log service hours and activities as they happen</li>
              <li>Keep track of who will write each letter, and build a brag sheet for teachers</li>
              <li>A quick check-up shows what's strong and what to work on next</li>
              <li>Activities turn into a resume</li>
            </ul>
          </div>
          <div className="s-visual purple">
            <div className="m-card"><div className="m-row"><b>Service hours this year</b><span className="m-amt">42</span></div><span className="m-sub">Animal shelter · Food bank · Church youth group</span></div>
            <div className="m-card"><b>Letters</b><span className="m-sub">✓ Ms. Carter, Biology · asked Oct 2</span><span className="m-sub">○ Coach Reyes · ask by Nov 15</span></div>
          </div>
        </article>

        <article className="s-feature flip" id="family">
          <div>
            <p className="s-kicker">Family and phone</p>
            <h2>Built for parents and students together</h2>
            <p>The parent owns the account and decides what each student can change. The student has their own app and does the day to day work. One family plan covers every child in the house.</p>
            <ul>
              <li>Invite a student with a short join code by text or email</li>
              <li>At 18, students get a say in what parents can still see</li>
              <li>Face ID or fingerprint sign-in, because teenagers forget passwords</li>
              <li>iPhone and Android apps in testing now; the website works on any device</li>
              <li>In English or <a href="/es">Spanish</a></li>
              <li>A <a href="/help">help guide</a> for every page</li>
            </ul>
          </div>
          <div className="s-visual">
            <div className="m-card"><b>Join code for Emma</b><span style={{ fontSize: 28, fontWeight: 800, letterSpacing: "0.18em", color: "var(--navy)", fontFamily: "ui-monospace, monospace" }}>K7P-4QX</span><span className="m-sub">Tap Text or Email to send it</span></div>
          </div>
        </article>
      </div>

      <FinalCta />
    </>
  );
}
