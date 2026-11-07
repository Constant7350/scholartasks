import { SignedInRedirect } from "../signed-in-redirect";
import { FaqList, FinalCta } from "./parts";
import tour from "../admin/presentation/slides.json";

export const metadata = {
  title: "ScholarTasks · College, scholarships and Georgia aid, all in one plan",
  description:
    "ScholarTasks helps families plan, fund and prepare for college or a trade, from 6th grade to graduation: an AI counselor, matched scholarships, HOPE and Zell tracking, grades, SAT/ACT prep and every deadline in one place.",
};


const PILLARS = [
  { word: "Plan", cls: "", text: "What to do, and when.", items: ["One to-do list with reminders", "College or trade list and deadlines", "AI counselor that knows your student"] },
  { word: "Fund", cls: "fund", text: "Find the money and keep it.", items: ["Matched scholarships and grants", "State aid like HOPE, tracked", "FAFSA in small steps"] },
  { word: "Prepare", cls: "prep", text: "Grades, habits and test scores.", items: ["Grades scorecard from 6th grade", "Homework Helper that never gives answers", "SAT and ACT prep with 600+ questions"] },
];

const FAQ = [
  { q: "How much does ScholarTasks cost?", a: "Families can start for free, with no credit card. A paid family plan will cover every child in the house and will cost less than most paid test prep or essay apps. We are setting final prices now." },
  { q: "Is it only for Georgia?", a: "ScholarTasks is built in Georgia and knows HOPE, Zell Miller and Georgia's aid rules in detail. Searches always include colleges, majors and trades across the whole country, so families can choose freely. It also covers state aid in 10 more Southeast states: Florida, Alabama, South Carolina, North Carolina, Tennessee, Mississippi, Louisiana, Kentucky, Virginia and Arkansas." },
  { q: "What grades is it for?", a: "6th grade through senior year, in three stages. Explore (grades 6 to 8): the career quiz, a dream board, grades, study skills and the Homework Helper; under 13, the parent uses it with their student, with no student sign-in or AI until 13. Build (grades 9 and 10) adds the course plan, activities, the PSAT and a first look at colleges. Apply (grades 11 and 12) is test prep, college lists, scholarships, applications and aid forms. Each student sees only their stage's pages; parents can show every page any time." },
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
          <p className="s-kicker">Everything in one place</p>
          <h2 className="s-title">One app instead of ten</h2>
          <p className="s-lede">Deadlines live on a dozen websites and school counselors have hundreds of students. ScholarTasks puts it all in one plan, and each part works with the others.</p>
          <div className="s-grid s-grid-3">
            {PILLARS.map((p) => (
              <div className={`s-card s-pillar ${p.cls}`} key={p.word}>
                <span className="s-word">{p.word}</span>
                <p>{p.text}</p>
                <ul className="s-pillar-list">{p.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 24 }}><a className="btn btn-ghost btn-inline link-btn" href="/features">See every feature</a></p>
        </div>
      </section>
      <section className="s-section" id="how">
        <div className="site-wrap">
          <p className="s-kicker">How it works</p>
          <h2 className="s-title">Set up in a few minutes</h2>
          <p className="s-lede">The parent owns the account and decides what each student can change. The student has their own app and does the day to day work.</p>
          <ol className="s-steps">
            <li><b>A parent signs up</b><span>Use a password, an email link or Google. Add each student in the house.</span></li>
            <li><b>Send the join code</b><span>Tap Text or Email to send your student a short code. They type it in on their own phone.</span></li>
            <li><b>Work from one plan</b><span>Everything the family adds lands in one shared plan, with reminders before every date.</span></li>
          </ol>

          <p className="s-fine">Week to week, it takes a few minutes.</p>
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

      <section className="s-section tint s-privacy-line">
        <div className="site-wrap s-center">
          <h2 className="s-title">Your child's information stays yours</h2>
          <p className="s-lede">We never sell it, never ask for Social Security numbers, FSA IDs or tax returns, and parents decide what each student can change. You can delete everything from inside the app. <a href="/privacy">Read our privacy policy</a>.</p>
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
