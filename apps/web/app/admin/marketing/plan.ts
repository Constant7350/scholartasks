/**
 * The ScholarTasks business plan and marketing strategy (team only, /admin/marketing).
 * One place for the words: change a step or a goal here and the page follows.
 * Progress (done / doing / notes) is saved in the marketing_steps table, keyed by step id,
 * so never change an existing step's id (add a new one instead).
 *
 * Research behind it (Nov 2026): Sallie Mae "How America Pays for College 2025",
 * Sallie "Inside Gen Z's scholarship search" (Apr 2026), EAB parent communication research,
 * GA counselor ratio 367:1 (2024-25), Meta education app install costs, and the
 * competitor comparison (12 apps x 29 features).
 */

export type Who = "Constant" | "Fiona" | "Student" | "Claude" | "Team";

export interface Step {
  id: string;
  title: string;
  how: string;
  who: Who;
  when: string;
  /** Claude can build or write this when asked. */
  claude?: boolean;
}

export interface Phase {
  id: string;
  name: string;
  dates: string;
  goal: string;
  steps: Step[];
}

export const SUMMARY = {
  oneLine: "The family plan for college and trades, and how to fund both: from 8th grade to the first day. Georgia first, then the Southeast, then every state.",
  why: [
    "Families spent about $34,000 on college in 2025-26, up 10% in a year. Parents covered the biggest share (39%).",
    "About 3 in 4 students who got no scholarship never applied. 48% of families think scholarships are only for top students.",
    "26% of college families never filed the FAFSA, often because they wrongly thought they earned too much.",
    "Georgia has one school counselor for every 367 students. Families are mostly on their own.",
    "68% of Gen Z students look for scholarships on TikTok, but 34% saw misleading posts and only 27% always check facts.",
  ],
  promise: "Every month, ScholarTasks tells your family exactly what to do next, finds money you'd miss, and checks it with real people.",
};

export const AUDIENCE = [
  {
    who: "Parents (they decide and they buy)",
    icon: "👪",
    detail:
      "Mostly moms and dads aged 38 to 55 with a child in grades 8 to 12, Georgia first. The heart of the market is the middle: families who earn too much for big need-based aid but can't write a $34,000 check, first-generation families, and parents worried about keeping HOPE or Zell.",
    where: "School and PTA Facebook groups, 'Class of 2027/2028 parents' groups, Nextdoor, school newsletters, church, Google searches like 'HOPE GPA calculator', and other parents.",
    want: "A clear plan, fewer surprises, less arguing at home, and less money spent. They trust other parents, teachers and counselors far more than ads.",
  },
  {
    who: "Students 13 to 18 (they use it every week)",
    icon: "🎒",
    detail:
      "Students in grades 8 to 12. Seniors need deadlines, essays and money now. Younger students need grades, study habits and a reason to care early.",
    where: "TikTok, Instagram, YouTube Shorts, friends, school counselors, and college students they look up to. College students are the most trusted voices (59%), well ahead of advisers (31%).",
    want: "Quick wins, no lectures, scholarships that are real, and help that doesn't do the work for them.",
  },
  {
    who: "School counselors and schools (they multiply us)",
    icon: "🏫",
    detail:
      "Georgia counselors carry about 367 students each. Our school portal is free, so one counselor can bring hundreds of families at once. Districts move slowly; individual counselors move fast.",
    where: "GSCA (Georgia School Counselor Association) conference and newsletter, district counseling directors, senior nights, FAFSA nights, counselor Facebook groups.",
    want: "Less paperwork, a view of who is behind, reminders that go out for them, and nothing that costs their school money or risks student privacy.",
  },
  {
    who: "Community partners (they bring families who need us most)",
    icon: "🤝",
    detail:
      "Churches, public libraries, Boys & Girls Clubs, 4-H and FFA, college access groups, Technical College System of Georgia campuses, and local scholarship funds.",
    where: "Youth ministers, librarians, program leaders and their family nights.",
    want: "A free, trustworthy tool they can hand to families, and a workshop they don't have to prepare.",
  },
];

export const MESSAGES = [
  { title: "Free to start, honest to the end", text: "Everything without AI is free forever. No ads, and we never sell student data." },
  { title: "Built for Georgia families", text: "HOPE and Zell GPA tracking, Georgia deadlines, Georgia scholarships and GAfutures steps built in, with options from every state too." },
  { title: "Start in 8th grade, not senior fall", text: "Grades, course choices, study habits and test prep years before the rush, so senior year is calm." },
  { title: "Real money, checked by people", text: "Scholarships are re-checked every week and reviewed by our team. No scams, no fees to apply." },
  { title: "An AI counselor that teaches, never cheats", text: "Answers any question at 11 pm, helps with essays by giving feedback, and never writes homework or essays." },
  { title: "Parents stay in charge", text: "The parent owns the account and decides what each student can see and do." },
  { title: "College or a trade, both are wins", text: "Majors, pay, cost and 65 trades side by side, with ways to fund each one." },
];

export const CHANNELS = [
  { rank: 1, name: "Free school portal and counselors", cost: "Low", why: "One counselor reaches hundreds of families. It's free for schools, so the yes is easy. Biggest lever we have." },
  { rank: 2, name: "Word of mouth and an invite reward", cost: "Low", why: "Parents trust parents. Give a free month (or extra AI uses) to both families when someone joins from an invite." },
  { rank: 3, name: "Free tools on the website", cost: "Low", why: "HOPE GPA checker, Zell checker, FAFSA checklist and 'scholarships due this month' pages bring families from Google and AI search with no sign-up wall." },
  { rank: 4, name: "Parent groups (Facebook, Nextdoor)", cost: "Free", why: "Helpful posts in the parent's own words, never spam. Answer questions and link the free tool that solves them." },
  { rank: 5, name: "Short videos for students", cost: "Free to low", why: "'Hidden gem scholarship of the week' and deadline alerts are the posts students engage with most. Use college-student ambassadors and our 'checked by people' promise against scams." },
  { rank: 6, name: "Workshops with community partners", cost: "Low", why: "A ready-made 30-minute 'Plan, Fund, Prepare' night using our presentation. Churches, libraries and clubs bring the families." },
  { rank: 7, name: "Monthly email: what to do this month", cost: "Low", why: "One short email per grade each month keeps families coming back and turns free families into paying ones." },
  { rank: 8, name: "Local news and podcasts", cost: "Free", why: "'A Georgia company builds the all-in-one college and aid app families wished they had' is a story local TV, newspapers and parenting podcasts like." },
  { rank: 9, name: "App Store and Google Play listing", cost: "Free", why: "Good screenshots, the words parents search for, and asking happy families for a review after a win." },
  { rank: 10, name: "Small paid ad tests, later", cost: "Medium", why: "Education app installs on Meta often cost $10 to $70 each, so wait until we know how many free families start paying. Then test $300 a month aimed at Georgia parents during the busy months." },
];

/** When families are paying attention, so effort lands at the right time. */
export const CALENDAR = [
  { months: "Aug to Sep", focus: "Back to school: grades 8 to 11 sign-ups, senior lists and essays, counselor kick-off." },
  { months: "Oct to Dec", focus: "Senior crunch: FAFSA opens Oct 1, early deadlines (Oct 15, Nov 1, Nov 15), counselor conference, senior and FAFSA nights." },
  { months: "Jan to Mar", focus: "Scholarship season: most local awards are due, mid-year grades, HOPE checks." },
  { months: "Apr to May", focus: "Decisions by May 1, aid offers, juniors start planning, summer plans." },
  { months: "Jun to Jul", focus: "Rising seniors: essays, activities resume, test dates; quiet time to build and plan." },
];

export const PHASES: Phase[] = [
  {
    id: "p0",
    name: "Get ready",
    dates: "Now to Dec 2026",
    goal: "50 Georgia families using it, 10 real stories, prices set, the app in both stores.",
    steps: [
      { id: "beta-families", title: "Invite 25 to 50 beta families", how: "Friends, church, neighbors and Fiona's school. Free during beta. Ask each for 10 minutes of feedback after two weeks.", who: "Team", when: "Nov 2026" },
      { id: "gsca-2026", title: "Go to the GSCA counselor conference (Nov 11 to 13, Augusta)", how: "Too late for a booth, but attend or reach out to speakers and the board. Bring the free portal one-pager and collect 20 counselor emails.", who: "Fiona", when: "Nov 11 to 13, 2026" },
      { id: "one-pagers", title: "Make one-page handouts: parents and counselors", how: "Two printable pages with a QR code to scholartasks.com, made from the presentation.", who: "Claude", when: "Nov 2026", claude: true },
      { id: "stories", title: "Collect 10 short family stories (quotes)", how: "Ask beta families what changed: money found, a deadline caught, calmer home. First names and city only, with permission.", who: "Constant", when: "Dec 2026" },
      { id: "set-prices", title: "Set real prices and turn on payments", how: "Use the running cost estimate (about $2 per family a month). Recommended: Family $9.99 a month or $79 a year. Connect Stripe.", who: "Constant", when: "Dec 2026" },
      { id: "legal-review", title: "Legal review of privacy and terms", how: "Have a lawyer read /privacy and /terms before taking money.", who: "Constant", when: "Dec 2026" },
      { id: "vercel-pro", title: "Move hosting to Vercel Pro", how: "Required before paying families. About $20 a month.", who: "Constant", when: "Before payments" },
      { id: "store-listings", title: "Publish the app in the App Store and Google Play", how: "Finish review accounts, screenshots and descriptions with the words parents search for.", who: "Constant", when: "Dec 2026" },
      { id: "social-accounts", title: "Open ScholarTasks accounts on Facebook, Instagram, TikTok and YouTube", how: "Same name and logo everywhere. Link to scholartasks.com.", who: "Student", when: "Nov 2026" },
      { id: "email-signup", title: "Add an email sign-up and invite reward", how: "Website 'get the monthly plan' sign-up, plus a free month for both families when an invite joins.", who: "Claude", when: "Dec 2026", claude: true },
      { id: "free-tools", title: "Open more free tools on the website", how: "Zell checker, FAFSA checklist preview and 'Georgia scholarships due this month', no sign-up needed, each linking to the app.", who: "Claude", when: "Dec 2026", claude: true },
    ],
  },
  {
    id: "p1",
    name: "Schools and scholarship season",
    dates: "Jan to Mar 2027",
    goal: "3 pilot schools, 300 families, first 30 paying families.",
    steps: [
      { id: "pilot-schools", title: "Sign up 3 pilot schools for the free portal", how: "Start with Fiona's school and two counselors from the conference. Offer a free parent night.", who: "Fiona", when: "Jan 2027" },
      { id: "counselor-emails", title: "Email 100 Georgia counselors", how: "Short personal email, the one-pager and a 3-minute video tour. Follow up once after a week.", who: "Fiona", when: "Jan to Feb 2027" },
      { id: "parent-nights", title: "Run 4 'Plan, Fund, Prepare' parent nights", how: "Use the narrated presentation. At schools, churches or libraries. Sign families up on the spot.", who: "Team", when: "Feb to Mar 2027" },
      { id: "fb-groups", title: "Join 20 Georgia parent groups and help weekly", how: "Answer real questions and share free tools. One helpful post a week, never a hard sell.", who: "Constant", when: "Jan 2027 onward" },
      { id: "video-weekly", title: "Post 3 short videos a week", how: "Hidden-gem scholarship, deadline alert, quick HOPE tip. Film on a phone.", who: "Student", when: "Jan 2027 onward" },
      { id: "monthly-email", title: "Start the monthly 'what to do this month' email", how: "One email per grade. Short, useful, one link back to the app.", who: "Claude", when: "Jan 2027", claude: true },
      { id: "launch-paid", title: "Turn on paid plans", how: "Free stays free. Upgrade prompts only after a family gets value (for example after their 3 free AI uses a day).", who: "Constant", when: "Jan 2027" },
      { id: "partners-5", title: "Partner with 5 community groups", how: "Churches, a library system, a Boys & Girls Club, 4-H or FFA. Give them a ready-made workshop and a code.", who: "Constant", when: "Feb to Mar 2027" },
    ],
  },
  {
    id: "p2",
    name: "Grow Georgia, open the Southeast",
    dates: "Apr to Aug 2027",
    goal: "15 schools, 1,500 families, 150 paying, every Southeast state switched on.",
    steps: [
      { id: "ambassadors", title: "Start a college-student ambassador program", how: "5 to 10 Georgia college students post and run one workshop each, paid per family that joins.", who: "Student", when: "Apr 2027" },
      { id: "press", title: "Pitch local news and parenting podcasts", how: "Story: a Georgia company built the all-in-one app families wished they'd had. Include a free-tool angle and real family results.", who: "Constant", when: "Apr to May 2027" },
      { id: "summer-essays", title: "Run a free summer essay week for rising seniors", how: "Five short lessons by email plus the essay coach. Big sign-up driver before senior year.", who: "Fiona", when: "Jun to Jul 2027" },
      { id: "gsca-2027", title: "Present or exhibit at GSCA 2027", how: "Send a session proposal when the call opens (usually spring) and book a booth.", who: "Fiona", when: "Spring 2027" },
      { id: "store-reviews", title: "Ask happy families for store reviews", how: "In-app prompt after a win (scholarship saved, deadline met). Aim for 50 reviews at 4.5 stars or more.", who: "Claude", when: "May 2027", claude: true },
      { id: "ad-test", title: "Test small paid ads", how: "$300 a month for two months: Meta aimed at Georgia parents and Google searches like 'HOPE scholarship GPA'. Keep only what brings paying families for less than 3 months of their plan.", who: "Constant", when: "Jul to Aug 2027" },
      { id: "se-state-packs", title: "Turn on the other Southeast states", how: "Build state packs one after another: Florida, South Carolina, North Carolina, Tennessee, Alabama, then Mississippi, Louisiana, Kentucky, Virginia, Arkansas. Each pack = state aid programs, deadlines, top state scholarships and a team fact check. About one state every two weeks.", who: "Claude", when: "Apr to Aug 2027", claude: true },
      { id: "se-pages", title: "A free page for each state's aid program", how: "For example 'Florida Bright Futures checker' and 'South Carolina LIFE checker', like our HOPE checker. These bring families from Google before we do any outreach there.", who: "Claude", when: "As each state goes live", claude: true },
      { id: "back-to-school", title: "Back-to-school push to grades 8 to 11", how: "Grade scorecard and study habits as the hook, through schools and parent groups.", who: "Team", when: "Aug 2027" },
    ],
  },
  {
    id: "p3",
    name: "Full launch, then all states",
    dates: "Sep 2027 to 2028",
    goal: "50 schools, 5,000 families, 600 paying, outreach in 4 states, all 50 states switched on.",
    steps: [
      { id: "ga-launch", title: "Full launch (Oct 1, 2027, when FAFSA opens)", how: "Georgia plus every Southeast state that is ready: news release, school email blast, parent groups and ambassadors in the same week.", who: "Team", when: "Oct 2027" },
      { id: "se-marketing", title: "Repeat the counselor playbook in each Southeast state", how: "One state a month: its counselor association, 100 counselor emails, parent groups and 2 pilot schools, using that state's aid program as the hook (Bright Futures, LIFE, TELS, Palmetto Fellows).", who: "Team", when: "Sep 2027 to 2028" },
      { id: "all-states", title: "Open the rest of the country", how: "Add state packs for the remaining states in batches of five, biggest first (Texas, California, New York, Ohio, Pennsylvania). Market online everywhere; do school outreach only where we have a pilot.", who: "Claude", when: "2028", claude: true },
      { id: "school-plus", title: "Offer School Plus (paid AI for schools)", how: "Once we know the AI cost with many students, sell an AI package per student per year to schools that want it.", who: "Constant", when: "2028" },
      { id: "district-deal", title: "First district agreement", how: "Signed data agreement, roster upload, and 45-day delete promise, so a whole district can join.", who: "Constant", when: "2028" },
    ],
  },
  {
    id: "always",
    name: "Every month",
    dates: "Ongoing",
    goal: "Keep the plan honest and the app the best one out there.",
    steps: [
      { id: "monthly-numbers", title: "Check the numbers on this page each month", how: "Families, paying families, schools. Write one line about what worked and what to stop.", who: "Constant", when: "1st of each month" },
      { id: "feedback-loop", title: "Read every family message and fix the top 3 problems", how: "Support email, store reviews and 'Report this answer'. Ship fixes fast and tell families what changed.", who: "Team", when: "Monthly" },
      { id: "presentation-current", title: "Keep the presentation and website current", how: "Every new feature updates the slides, narration and website (already automatic in every build).", who: "Claude", when: "Every feature", claude: true },
    ],
  },
];

export const BUSINESS = {
  model: [
    { name: "Free forever", text: "Everything without AI: plans, deadlines, grades and HOPE, scholarships, aid checklist, majors and trades, study library, practice questions. 3 AI uses a day per person." },
    { name: "Family plan", text: "More AI help for the whole family (10 uses a day per person). Recommended price: $9.99 a month or $79 a year. Sold on the website so app store fees don't apply." },
    { name: "Homework Helper add-on", text: "Safe all-subject homework help that never gives answers, plus the practice tutor and full practice tests. $9.99 a month or $79 a year (Constant, 2026-11-05)." },
    { name: "Message packs", text: "Extra AI uses when needed, for example 100 for $3.99." },
    { name: "Schools", text: "The portal is free. Paid School Plus (AI for every student) comes later, priced per student per year on the school's official enrollment for the grades it covers (Georgia DOE numbers), with a minimum of about $1,500 a year. Billed once a year by invoice after the school sends a purchase order: check or bank transfer, due in 30 days (Stripe Invoicing). The other option is charging only for students who connect." },
    { name: "Public (government) schools", text: "Included. They buy through their district: we register as a vendor (W-9), sign Georgia's student data privacy agreement (O.C.G.A. 20-2-666), then the district sends a purchase order and pays our invoice. Keep a school's yearly price under the district's small-purchase limit (often $10,000 to $25,000; check each district) so no formal bid is needed. Districts can use federal Title IV-A money, and Perkins career and technical money for the trades features. Private and charter schools simply sign and pay the invoice." },
  ],
  costs: [
    "About $2 per family a month to run (AI plus card fees) at 100 or more families.",
    "About $65 a month fixed (hosting, database, Apple, domain, scholarship checker).",
    "About 9 paying families on the Family plan cover the fixed costs. Every family after that is mostly profit.",
    "Marketing budget to start: $100 to $200 a month (printing, a conference, small tests). Raise it only when a channel shows it brings paying families.",
  ],
  goals: [
    { by: "Dec 2026", families: 50, paying: 0, schools: 1 },
    { by: "Mar 2027", families: 300, paying: 30, schools: 3 },
    { by: "Aug 2027", families: 1500, paying: 150, schools: 15 },
    { by: "Aug 2028", families: 5000, paying: 600, schools: 50 },
    { by: "Aug 2029", families: 20000, paying: 2500, schools: 200 },
  ],
  edges: [
    "The only app that covers grades 8 to 12, seniors, parents and schools together (78% of 29 features, next best 59%).",
    "Parent-owned family account with student permissions.",
    "Georgia HOPE and Zell built in, with nationwide options always shown.",
    "College majors and 65 trades side by side.",
    "Free school portal (competitors charge schools $3.50 to $8.50 per student).",
    "Scholarships checked by people, never sells data, honest AI that won't do homework.",
  ],
  gaps: [
    "Fewer scholarships than the big sites (279 checked vs thousands). Keep adding Georgia and local awards; quality over volume.",
    "Not in the public App Store and Google Play yet.",
    "No four-year course planner, no Spanish, no school roster sync yet.",
    "Big free tools (BigFuture, Naviance through schools) are well known. We win on Georgia detail, the parent view and plain-English help.",
  ],
  expansion: [
    "Software first, marketing second: switching a state on is mostly data (a state pack), so we can open states fast. College search, majors, trades, FAFSA and national scholarships already work in every state.",
    "Order: Georgia, then the other Southeast states one by one in 2027 (Florida, South Carolina, North Carolina, Tennessee, Alabama, then the rest), then the rest of the country in 2028.",
    "Online marketing (free tools, videos, store listing, search) goes everywhere a state is live. School and community outreach goes one state at a time, because counselor trust is local and our team is small.",
    "Every new state gets a team fact check before it goes live, and families always see options from every state, not just their own.",
  ],
  risks: [
    { risk: "Busy seasons are short", plan: "Have free tools and content ready before Aug and Oct; build in summer." },
    { risk: "An AI mistake hurts trust", plan: "Team review of answers, 'Report this answer', advice-only wording, facts linked to official sites." },
    { risk: "Student privacy worries", plan: "Never sell data, parent controls, delete anytime, data agreement before district rosters." },
    { risk: "Cheaper or free competitors", plan: "Stay free for the basics; charge only for AI help that clearly saves time and money." },
    { risk: "Small team, many jobs", plan: "Follow this page one phase at a time; Claude builds the tools and drafts the content." },
  ],
};

export const SOURCES = [
  { label: "Sallie Mae, How America Pays for College 2025", url: "https://www.salliemae.com/research/how-america-pays-for-college/" },
  { label: "Sallie, Inside Gen Z's scholarship search (2026)", url: "https://www.sallie.com/research/inside-gen-z-scholarship-search" },
  { label: "YPulse, Gen Z uses social media to search for scholarships", url: "https://www.ypulse.com/newsfeed/2026/04/15/gen-z-is-using-social-media-to-search-for-scholarships/" },
  { label: "EAB, Honoring parent communication preferences", url: "https://eab.com/wp-content/uploads/0001/01/Honoring-Parent-Communication-Preferences.pdf" },
  { label: "GSCA 2026 conference, Augusta (Nov 11 to 13)", url: "https://luminik.io/events/gsca-conference/" },
  { label: "Meta ad cost per install, education apps", url: "https://www.superads.ai/facebook-ads-costs/cost-per-app-install/education" },
  { label: "Competitor comparison (12 apps x 29 features)", url: "https://claude.ai/artifact/574Z5pmkKJdgmCQ6LZyEq9" },
  { label: "Running cost estimate", url: "https://claude.ai/artifact/PSSH43HTMhA21Wp7fDNWz8" },
];

export const ALL_STEPS: Step[] = PHASES.flatMap((p) => p.steps);
