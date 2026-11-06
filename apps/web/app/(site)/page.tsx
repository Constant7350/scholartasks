import { SignedInRedirect } from "../signed-in-redirect";
import { FaqList, FinalCta } from "./parts";
import tour from "../admin/presentation/slides.json";

export const metadata = {
  title: "ScholarTasks · College, scholarships and Georgia aid, all in one plan",
  description:
    "ScholarTasks helps families plan, fund and prepare for college or a trade, from 6th grade to graduation: an AI counselor, matched scholarships, HOPE and Zell tracking, grades, SAT/ACT prep and every deadline in one place.",
};

const FEATURES = [
  { icon: "💬", color: "", title: "AI counselor", text: "Answers about your student, not general advice. It knows their grades, college list, deadlines and your state's rules, in English or Spanish. It coaches, but never does homework or writes essays." },
  { icon: "🎓", color: "gold", title: "Scholarships and grants", text: "Hundreds of Georgia and national awards, sorted into You qualify, Maybe and Not a fit and checked on their official pages. Essay bundles let one draft serve awards with similar questions." },
  { icon: "📈", color: "green", title: "Grades and HOPE scorecard", text: "See the HOPE GPA next to the school GPA from 8th grade on. A four-year course plan checks graduation credits and HOPE rigor, and Grade Rescue builds a simple plan when a grade slips." },
  { icon: "🦉", color: "green", title: "Homework Helper", text: "A safe AI tutor for every subject, from math to essays. One hint at a time, checks their work, asks them to explain their thinking, and never gives answers or writes for them. Parents see what was practiced." },
  { icon: "📝", color: "purple", title: "SAT and ACT prep", text: "Over 600 original practice questions, timed practice tests, a score plan and a tutor that explains instead of giving answers." },
  { icon: "🏫", color: "", title: "Colleges and majors", text: "Search almost 2,000 colleges across the country by major, with reach, match and likely based on grades and scores, cost after state aid, aid offer compare and community college transfer savings." },
  { icon: "🔧", color: "coral", title: "Trades and careers", text: "50 skilled trades with earnings, training, licensing and schools in every state, plus apply checklists and ways to fund the training." },
  { icon: "🧾", color: "gold", title: "FAFSA and Georgia aid", text: "The FAFSA and Georgia's aid form, broken into small steps that explain who does each part. We never ask for FSA IDs or Social Security numbers." },
  { icon: "✅", color: "green", title: "One to-do list", text: "Every date in one list, sorted into late, this week and coming up. Reminders by email, text, calendar and phone." },
  { icon: "🌟", color: "purple", title: "Beyond grades", text: "Activities, service hours, leadership and recommendation letters, with milestones for each school year and a resume that builds itself." },
];

const FAQ = [
  { q: "How much does ScholarTasks cost?", a: "Families can start for free, with no credit card. A paid family plan will cover every child in the house and will cost less than most paid test prep or essay apps. We are setting final prices now." },
  { q: "Is it only for Georgia?", a: "ScholarTasks is built in Georgia and knows HOPE, Zell Miller and Georgia's aid rules in detail. Searches always include colleges, majors and trades across the whole country, so families can choose freely. It also covers state aid in 10 more Southeast states: Florida, Alabama, South Carolina, North Carolina, Tennessee, Mississippi, Louisiana, Kentucky, Virginia and Arkansas." },
  { q: "What grades is it for?", a: "6th grade through senior year. In grades 6 and 7 (under 13) the parent uses it with their student: study habits, the career quiz and the grades scorecard, with no student sign-in or AI until 13. From 8th grade, students focus on grades, study skills and course choices. Juniors and seniors add test prep, college lists, scholarships, applications and aid forms." },
  { q: "Will the AI do my student's homework or write their essays?", a: "No. The AI counselor and the Homework Helper explain, ask questions, give one hint at a time and check your student's own work. They never hand over answers or write essays, and a second AI checks every Homework Helper reply before your student sees it. Parents can see what was practiced and when the helper said no." },
  { q: "Is my family's information safe?", a: "We never sell data. We never ask for FSA IDs, Social Security numbers or tax returns. Each family's information is kept separate, students agree before using AI help, and you can delete everything from inside the app." },
  { q: "Is there a phone app?", a: "Yes. The iPhone and Android apps are in testing now. The website already works on any phone, tablet or computer, with Face ID or fingerprint sign-in." },
];

export default function Landing() {
  return (
    <>
      <SignedInRedirect />

      <section className="s-hero">
        <div className="site-wrap s-hero-grid">
          <div>
            <p className="s-kicker">Built in Georgia, for families</p>
            <h1>College and scholarships, <em>finally in one plan</em></h1>
            <p className="s-lede">
              ScholarTasks helps your family plan, fund and prepare for college or a trade, from 6th grade to graduation, in English or Spanish. An AI counselor that knows your student, matched scholarships, HOPE tracking, test prep and every deadline, on the phone and the web.
            </p>
            <div className="s-cta">
              <a className="btn" href="/signin">Start free</a>
              <a className="btn btn-ghost" href="#tour">Watch the {tour.minutes}-minute tour</a>
            </div>
            <p className="s-fine">Free to start. No credit card.</p>
            <ul className="s-trust-row">
              <li>Never sells student data</li>
              <li>Parent-controlled</li>
              <li>Grades 6 to 12</li>
            </ul>
          </div>
          <HeroPhone />
        </div>
      </section>

      <section className="s-section tint">
        <div className="site-wrap">
          <p className="s-kicker">Why families need it</p>
          <h2 className="s-title">Deadlines on a dozen websites. Rules nobody explains.</h2>
          <p className="s-lede">
            Georgia's HOPE GPA is counted differently from the one on the report card. Scholarships are scattered all over the internet. School counselors have hundreds of students. ScholarTasks pulls it all into one shared plan, in three parts.
          </p>
          <div className="s-grid s-grid-3">
            <div className="s-card s-pillar">
              <span className="s-word">Plan</span>
              <p>What to do, and when. A college or trade list, application checklists and one to-do list with reminders.</p>
            </div>
            <div className="s-card s-pillar fund">
              <span className="s-word">Fund</span>
              <p>How to find and keep the money, from HOPE and Zell Miller to private scholarships and the FAFSA.</p>
            </div>
            <div className="s-card s-pillar prep">
              <span className="s-word">Prepare</span>
              <p>Grades, study habits and test scores, starting as early as 6th grade, so senior year isn't a scramble.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="s-section">
        <div className="site-wrap">
          <p className="s-kicker">Everything in one place</p>
          <h2 className="s-title">One app instead of ten</h2>
          <p className="s-lede">Each part works with the others. Save a scholarship and its deadline lands on the to-do list. Enter a grade and the AI counselor knows about it.</p>
          <div className="s-grid">
            {FEATURES.map((f) => (
              <div className="s-card" key={f.title}>
                <span className={`s-icon ${f.color}`} aria-hidden="true">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 24 }}><a className="btn btn-ghost btn-inline link-btn" href="/features">See every feature</a></p>
        </div>
      </section>

      <section className="s-section tint" id="how">
        <div className="site-wrap">
          <p className="s-kicker">How it works</p>
          <h2 className="s-title">Set up in a few minutes</h2>
          <p className="s-lede">The parent owns the account and decides what each student can change. The student has their own app and does the day to day work.</p>
          <ol className="s-steps">
            <li><b>A parent signs up</b><span>Use a password, an email link or Google. Add each student in the house.</span></li>
            <li><b>Send the join code</b><span>Tap Text or Email to send your student a short code. They type it in on their own phone.</span></li>
            <li><b>Work from one plan</b><span>Everything the family adds lands in one shared plan, with reminders before every date.</span></li>
          </ol>

          <h3 className="s-title" style={{ fontSize: 26, marginTop: 56 }}>What each year looks like</h3>
          <div className="s-journey">
            <div>
              <span className="g">Grades 8 and 9</span>
              <h3>Build good habits</h3>
              <ul><li>Grades scorecard</li><li>Study skills lessons</li><li>Choosing courses</li><li>Goals set together</li></ul>
            </div>
            <div>
              <span className="g">Grade 10</span>
              <h3>Track HOPE</h3>
              <ul><li>HOPE GPA tracking</li><li>Harder classes at the right pace</li><li>Activities and service hours</li><li>Explore majors and trades</li></ul>
            </div>
            <div>
              <span className="g">Grade 11</span>
              <h3>Test and search</h3>
              <ul><li>SAT and ACT prep</li><li>College or trade list</li><li>Cost after aid</li><li>Who will write letters</li></ul>
            </div>
            <div>
              <span className="g">Grade 12</span>
              <h3>Apply and fund</h3>
              <ul><li>Applications and essays</li><li>Scholarships</li><li>FAFSA and Georgia aid</li><li>Every deadline, reminded</li></ul>
            </div>
          </div>
          <p className="s-fine">Week to week, it takes a few minutes.</p>
        </div>
      </section>

      <section className="s-section navy">
        <div className="site-wrap">
          <div className="s-stats">
            <div><strong>~2,000</strong><span>colleges across the country</span></div>
            <div><strong>11</strong><span>Southeast states' aid rules</span></div>
            <div><strong>600+</strong><span>original SAT and ACT questions</span></div>
            <div><strong>50</strong><span>skilled trades, every state</span></div>
          </div>
        </div>
      </section>

      <section className="s-section" id="tour">
        <div className="site-wrap">
          <div className="s-center">
            <p className="s-kicker">See it for yourself</p>
            <h2 className="s-title">Take the {tour.minutes}-minute tour</h2>
            <p className="s-lede">A narrated walk through every part of ScholarTasks, made for parents and schools.</p>
          </div>
          <div className="s-video" style={{ maxWidth: 900, margin: "0 auto" }}>
            <video controls preload="none" poster="/presentation/slide-cover.jpg" src="/presentation/scholartasks-presentation.mp4">
              Your browser can't play this video. <a href="/presentation/scholartasks-presentation.mp4">Download it here.</a>
            </video>
          </div>
        </div>
      </section>

      <section className="s-section tint">
        <div className="site-wrap">
          <p className="s-kicker">Privacy and trust</p>
          <h2 className="s-title">Your child's information stays yours</h2>
          <div className="s-grid">
            <div className="s-card"><span className="s-icon green" aria-hidden="true">🔒</span><h3>Never sold</h3><p>We never sell student data, and colleges can't buy access to your child.</p></div>
            <div className="s-card"><span className="s-icon gold" aria-hidden="true">🪪</span><h3>No sensitive numbers</h3><p>We never ask for or keep FSA IDs, Social Security numbers or tax returns.</p></div>
            <div className="s-card"><span className="s-icon" aria-hidden="true">👪</span><h3>Parents in control</h3><p>Parents choose what each student can change. At 18, students get a say in what parents see.</p></div>
            <div className="s-card"><span className="s-icon purple" aria-hidden="true">🗑️</span><h3>Delete any time</h3><p>Students agree before using AI help, and you can delete everything from inside the app.</p></div>
          </div>
          <p className="s-fine">For ages 13 and up. Read our <a href="/privacy">privacy policy</a>.</p>
        </div>
      </section>

      <section className="s-section">
        <div className="site-wrap">
          <p className="s-kicker">Questions</p>
          <h2 className="s-title">Common questions</h2>
          <FaqList items={FAQ} />
        </div>
      </section>

      <FinalCta />
    </>
  );
}

/** A simplified, made-up phone screen for the hero. Sample student "Emma". */
function HeroPhone() {
  return (
    <div className="s-phone" aria-label="Sample ScholarTasks home screen">
      <div className="s-screen">
        <div className="s-screen-top"><b>Emma's plan</b><span>Grade 12</span></div>
        <div className="m-card">
          <div className="m-gpa">
            <div><span>HOPE GPA</span><strong>3.42</strong></div>
            <div><span>School GPA</span><strong>3.61</strong></div>
          </div>
          <span className="m-tag">On track for HOPE</span>
        </div>
        <div className="m-card">
          <div className="m-row"><b>Georgia community award</b><span className="m-amt">$1,000</span></div>
          <span className="m-sub">You qualify · due mid-December</span>
        </div>
        <div className="m-card">
          <b>This week</b>
          <span className="m-sub">✓ Ask Ms. Carter for a letter</span>
          <span className="m-sub">○ Finish the FAFSA, step 3 of 6</span>
          <span className="m-tag warn">Application due in 9 days</span>
        </div>
        <div className="m-bubble">Your chemistry grade dipped. Want a quick plan to bring it back up before the semester ends?</div>
      </div>
    </div>
  );
}
