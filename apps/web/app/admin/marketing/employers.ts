/**
 * Employer plan (team only, /admin/marketing, "Employers" tab): how companies post
 * apprenticeships and trade openings, how we keep it safe, whether and how we charge,
 * and the steps to bring companies in. Progress is saved in marketing_steps like the
 * main plan, keyed by step id (ids start with "emp-"; never change an existing id).
 *
 * Prices here are ideas, not final: the rule is build first, measure, then set prices.
 * Legal notes are a starting checklist for our lawyer, not legal advice.
 */
import type { Phase } from "./plan";

export const EMPLOYER_SUMMARY = {
  oneLine:
    "Local companies anywhere in the U.S. post apprenticeships, paid training, trade internships and entry-level jobs. Our team checks each one, students near them see it first, and students choose who to contact.",
  why: [
    "Small trade businesses struggle to find young people who want to learn the work, and they rarely have a recruiter or a budget for job boards.",
    "Many students can't afford, or don't want, a four-year degree. An apprenticeship pays them while they learn.",
    "Families already plan the next step in ScholarTasks, so a local opening reaches them at the moment they're deciding.",
  ],
};

/** How it works today (built in November 2026). */
export const HOW_IT_WORKS = [
  { title: "Where companies post", text: "scholartasks.com/trades/post. Free, about five minutes, no account. Any U.S. state. Linked from the Trades page, each trade page and the website footer (For employers)." },
  { title: "Where students find it", text: "Menu > Apprenticeships and local openings, and a Local openings box on every trade page. Openings in the student's home state come first, then the rest of the country. Search by trade, kind, city or company." },
  { title: "How students make contact", text: "They apply the way the company asks: the company's website, a work email or a business phone. The student decides. We never send a student's name or details to a company, and companies can't message students inside the app." },
  { title: "Who checks it", text: "Our review team approves every listing on Team: Review local openings before it shows, usually within two business days. The company gets an email when it's live or if we turn it down." },
  { title: "How long it stays", text: "Up to 180 days. Companies reply to their email to change or remove it." },
  { title: "Weekend and holiday jobs (company accounts)", text: "scholartasks.com/employers. A company makes an account, agrees to the teen job rules and posts weekend, holiday and school-break jobs. Our team approves the company and each job. Students apply inside ScholarTasks (Menu > Weekend and holiday jobs)." },
  { title: "Parent consent on every application", text: "Nothing reaches the company until a parent reads the consent and ticks I agree. The consent, its exact wording, who agreed and when are saved in the tamper-proof audit log. The company sees only the application (first name, grade, age, message, availability, the shared contact and the parent's email)." },
  { title: "Work experience and reference letters", text: "When a student is hired, the family adds the job to Activities and the resume (work or leadership) in one tap. The company can write a reference letter; a parent decides whether to keep it in the records or hide it, and the company isn't told." },
];

/** What keeps it safe and friendly, especially for students under 18. */
export const SAFETY = [
  "Every listing is checked by a person before students see it: real company (website, Google, state business search), real job, clear pay or 'pay discussed', and a work way to apply.",
  "Rules every company agrees to: no fees for students, ever; follow federal and state child labor laws for anyone under 18 (hours, work permits, no hazardous jobs barred for their age); equal opportunity for every qualified applicant; no asking for Social Security or bank numbers before a written offer.",
  "The review page flags what needs a closer look: listings open to under-18s, any mention of fees or deposits, requests for private details, no website, and Registered Apprenticeship claims (checked on apprenticeship.gov before the badge shows).",
  "No private messaging, no student profiles for companies to browse, and no student data shared or sold. Students reach out; companies can't reach in.",
  "Report a problem on every listing. Three reports hide it automatically until our team looks again. Every report is kept for the team.",
  "Safety tips next to every listing: never pay to apply, look the company up, bring a parent to a first visit if you're under 18.",
  "Companies that break the rules are removed and can't post again (we block their email and website).",
];

/** Can we charge companies? Yes, with these limits. A checklist for our lawyer, not legal advice. */
export const LEGAL = [
  { rule: "Charge companies, never students", text: "Charging employers to advertise jobs is normal (job boards and newspapers do it). Charging job seekers is what many states regulate as an 'employment agency' fee, so students and families never pay anything for openings." },
  { rule: "Label paid placement", text: "If a company pays to show first, the listing must say so. We use the label 'Featured' and explain on the page that Featured listings may be paid (FTC rules on deceptive advertising). Never use the word 'sponsor'." },
  { rule: "Child labor laws", text: "Ads open to under-18s must fit federal (FLSA) and state rules on hours and hazardous jobs. The company is responsible, but we review every under-18 listing and turn down ones that don't fit." },
  { rule: "Equal opportunity in job ads", text: "Job ads can't show a preference by race, color, religion, sex, national origin, disability, or age 40 and over (Title VII, ADA, ADEA). A legal minimum age is fine. We reject ads that break this." },
  { rule: "No targeting by student data", text: "Listings are shown by state, trade and kind only. We don't sell or share student data or target ads by a student's personal details, and nothing is collected from children under 13 (COPPA). Counts are numbers only." },
  { rule: "Terms for employers", text: "Before we charge, add Employer terms to our Terms page: what's included, refunds, our right to remove a listing, and that we don't guarantee hires. Have our lawyer read it." },
  { rule: "Taxes and app stores", text: "Ask our accountant whether listing fees need sales tax in Georgia and other states. Sell employer plans on the website only (like Plan and billing), not inside the phone app." },
];

/** Pricing ideas. Placeholders: not final until we see how many companies post and how many students apply. */
export const PRICING = {
  recommend:
    "Keep posting free while we build up listings (a board with no openings helps nobody). Once a state has steady listings and students using them, turn on paid Featured listings there. Never charge Registered Apprenticeship programs, nonprofits, schools or public programs.",
  tiers: [
    { name: "Basic listing", price: "Free, always", what: "Up to 3 live listings, reviewed by our team, shown by state and trade." },
    { name: "Featured listing", price: "Idea: $39 for 30 days", what: "Shows first in its state with a Featured label, plus a monthly count of how many students opened it and pressed Apply." },
    { name: "Local employer plan", price: "Idea: $29 a month or $290 a year", what: "Up to 10 live listings, one always Featured, a 'Checked employer' badge, and a monthly results email." },
    { name: "Multi-location plan", price: "Idea: $99 a month", what: "Unlimited listings in several states, three Featured at a time, and help writing listings that get applicants." },
    { name: "Weekend or holiday job post", price: "Idea: $25 flat for 60 days (free while we launch)", what: "One weekend, holiday or school-break job from a company account, with in-app applications that come with a parent's consent and the option to write reference letters." },
  ],
  launch: [
    "Founding employers: the first 100 companies get the Local employer plan free for 12 months and a Founding employer badge.",
    "Free forever: Registered Apprenticeship programs, union training programs, technical colleges, nonprofits and public workforce programs.",
    "Turn on paid Featured in a state once it has about 50 live listings and students open listings at least 1,000 times a month there.",
  ],
  example: "If 200 companies paid $29 a month, that would be about $5,800 a month. An illustration, not a forecast.",
};

/** Who to reach, best first. */
export const EMPLOYER_CHANNELS = [
  { name: "High school work-based learning and Youth Apprenticeship coordinators", why: "They already match students with local employers (in Georgia: CTAE and Work-Based Learning coordinators, Georgia Youth Apprenticeship). They know which shops hire teens and can send them our link." },
  { name: "Technical colleges", why: "Their career services and apprenticeship offices work with hundreds of employers. Ask them to share /trades/post with employer partners. In Georgia: the 22 TCSG colleges." },
  { name: "Trade associations and union training programs", why: "Electrical, HVAC, plumbing, builders, manufacturers and union apprenticeship committees want more young people in the trade. One newsletter mention reaches many shops." },
  { name: "Chambers of commerce and workforce boards", why: "Local chambers and workforce boards (WorkSource in Georgia) run employer meetings and newsletters, and they like free tools that keep young workers local." },
  { name: "Calling and visiting local shops", why: "Small businesses say yes to a friendly person. Start with 50 shops near our first schools: electricians, HVAC, auto repair, welding and fabrication, salons, home health." },
  { name: "Counselor portal schools", why: "Schools using our free portal can invite their local employers, so students at that school see openings near them." },
  { name: "Google Business, Facebook and Nextdoor", why: "Short posts in local business groups: 'Hiring an apprentice? Post it free for students near you, checked by our team.'" },
];

/** What we tell companies. */
export const EMPLOYER_MESSAGES = [
  "Find your next apprentice before they leave town.",
  "Free, five minutes, no account. Our team checks it and you'll hear back within two business days.",
  "Students and parents see your opening while they're deciding what to do after high school.",
  "Students contact you the way you choose. No spam, no recruiter fees.",
  "Grow your own team: train someone who wants to learn your trade.",
];

/** How we know it's working (check monthly). */
export const EMPLOYER_METRICS = [
  "Live listings, by state and trade (goal: 50 in Georgia by March 2027).",
  "Days to review a listing (goal: 2 business days or fewer).",
  "Students who open listing details and press Apply (shown on each live listing on the review page).",
  "Reports per 100 listings (goal: under 2) and listings removed for breaking rules.",
  "Companies who post a second time (the best sign it worked for them).",
];

/** Steps to follow. Ids are saved with progress: never change one, add a new one instead. */
export const EMPLOYER_PHASES: Phase[] = [
  {
    id: "emp-seed",
    name: "1. Fill the board",
    dates: "Nov 2026 to Feb 2027",
    goal: "50 real Georgia listings before we tell students about it widely",
    steps: [
      { id: "emp-db", title: "Run database updates 50 and 53", how: "Paste each file into Supabase > SQL Editor and press Run. Until then, the posting form can't save.", who: "Constant", when: "Now" },
      { id: "emp-db54", title: "Run database update 54 (weekend and holiday jobs)", how: "Paste the file into Supabase > SQL Editor and press Run. Until then, company accounts and in-app applications can't save.", who: "Constant", when: "Now" },
      { id: "emp-teen-test", title: "Test a weekend job from start to finish", how: "Make a test company account, post a weekend job, approve the company and job, apply as the sample student, agree as the parent, mark Hired, write a letter, then keep it.", who: "Team", when: "Nov 2026" },
      { id: "emp-retail", title: "Invite 30 local shops that hire teens on weekends", how: "Garden centers, grocery stores, restaurants, movie theaters, pet stores and summer camps near our first schools. Before Thanksgiving for holiday help, and in spring for summer jobs.", who: "Team", when: "Nov 2026 to Apr 2027" },
      { id: "emp-test", title: "Post a test listing and approve it", how: "Post one from /trades/post, approve it on Team: Review local openings, check the emails, then take it down.", who: "Team", when: "Nov 2026" },
      { id: "emp-flyer", title: "Make a one-page flyer and email for companies", how: "One page: what it is, free, five minutes, the rules, the link and a QR code. Plus a short email to send to shops and coordinators.", who: "Claude", when: "Nov 2026", claude: true },
      { id: "emp-wbl", title: "Contact 20 work-based learning and Youth Apprenticeship coordinators", how: "Start with our counselor portal schools. Ask them to share the link with the employers they already work with.", who: "Constant", when: "Dec 2026" },
      { id: "emp-calls", title: "Call or visit 50 local shops", how: "Electricians, HVAC, plumbing, auto repair, welding, salons, home health near our first schools. Offer to type the listing for them while on the phone.", who: "Team", when: "Dec 2026 to Feb 2027" },
      { id: "emp-tcsg", title: "Ask 3 technical colleges to share the link", how: "Career services and apprenticeship offices. Offer a free listing for their own programs.", who: "Constant", when: "Jan 2027" },
      { id: "emp-assoc", title: "Get into 2 trade association newsletters", how: "Electrical, HVAC, plumbing or builders associations, and union apprenticeship committees. A short paragraph and the link.", who: "Constant", when: "Feb 2027" },
    ],
  },
  {
    id: "emp-grow",
    name: "2. Tell students and grow",
    dates: "Mar to Aug 2027",
    goal: "Students in Georgia open listings 1,000 times a month; companies post again",
    steps: [
      { id: "emp-students", title: "Tell students and parents", how: "A home page tile, the monthly email ('apprenticeships near you'), counselor portal schools and a short video. Seniors in spring and rising seniors in summer.", who: "Team", when: "Mar 2027" },
      { id: "emp-results-email", title: "Send companies a monthly results email", how: "How many students opened their listing and pressed Apply, plus a tip to get more applicants.", who: "Claude", when: "Apr 2027", claude: true },
      { id: "emp-chambers", title: "Present at 3 chamber of commerce or workforce board meetings", how: "Five minutes and the flyer: 'free apprentice listings, checked by our team'.", who: "Constant", when: "Apr to Jun 2027" },
      { id: "emp-southeast", title: "Open the next Southeast states", how: "Repeat steps 1 to 5 with coordinators and colleges in the states where we have the most families.", who: "Team", when: "Jun to Aug 2027" },
    ],
  },
  {
    id: "emp-paid",
    name: "3. Start charging, carefully",
    dates: "From Sep 2027",
    goal: "Paid Featured listings in states with a full board, without losing free listings",
    steps: [
      { id: "emp-lawyer", title: "Lawyer reads the employer terms and the paid label", how: "Employer terms on the Terms page, refunds, removal rights, the Featured label wording, and sales tax with our accountant.", who: "Constant", when: "Jul 2027" },
      { id: "emp-prices", title: "Set employer prices from real numbers", how: "Use how many companies posted, how many students applied, and what local job ads cost. Then put the prices in one place, like the family prices.", who: "Constant", when: "Aug 2027" },
      { id: "emp-flatfee", title: "Turn on the flat fee for weekend and holiday job posts", how: "Decide the price from real numbers (idea: $25 for 60 days), add Stripe checkout on the website, set fee_status to unpaid until paid, and keep the first post free for founding employers.", who: "Claude", when: "Aug 2027", claude: true },
      { id: "emp-checkout", title: "Build paid Featured and the Local employer plan", how: "Stripe checkout on the website only, Featured turns on by itself after payment, receipts by email. Founding employers get 12 months free.", who: "Claude", when: "Aug 2027", claude: true },
      { id: "emp-launch", title: "Turn on paid Featured state by state", how: "Only in states with about 50 live listings and steady student use. Keep Basic free forever.", who: "Team", when: "Sep 2027" },
    ],
  },
];

/**
 * Weekend and holiday jobs: how we bring in companies in many states at once (researched 2026-11-06).
 * The idea: reach the groups that already talk to thousands of employers (one-to-many), time it to the
 * two hiring seasons, and let families invite the places they already know.
 */
export const PART_TIME_SCALE = {
  oneLine: "Win employers through the groups that already reach thousands of them (franchise owners, restaurant and retail associations, workforce boards, chambers, camps), time every push to the two hiring seasons, and let families invite the businesses they know. Free while we grow.",
  why: [
    "About 6.2 million teens ages 16 to 19 worked in summer 2026 (35.5%), and more than half work in food service (32%) or retail (21%). Those are the companies to reach first (Pew Research, Aug 2026).",
    "Holiday hiring is shrinking: retailers expected 265,000 to 365,000 seasonal hires in 2025, down from 442,000 in 2024. Companies want reliable help without paying a staffing agency, and teens need places that still hire them (NRF via CNN, Dec 2025).",
    "City and county summer youth job programs recruit employers every spring and already pitch 'train your future workers'. The research says what works: peer employer champions, short low-effort roles, and showing hosting is easy (MDRC).",
    "Our edge for companies: free, students near them first, every application already has a parent's OK and the parent's email, and teen hour rules are built into the form.",
  ],
  seasons: [
    { when: "January to April", what: "Summer jobs: pools, camps, parks, ice cream, restaurants, amusement and family entertainment. Most summer hiring is decided by April." },
    { when: "September to early November", what: "Holiday and winter-break jobs: retail, gift wrapping, movie theaters, restaurants, shipping help, tree lots." },
    { when: "All year", what: "Weekend jobs: grocery baggers, restaurants, garden centers, pet stores, youth sports referees, tutoring centers." },
  ],
  channels: [
    { name: "Franchise and multi-location owners", why: "One owner of 10 to 50 restaurants, grocery stores, theaters or trampoline parks can post in several states at once. Start with franchisees in our first states, then regional chains. Needs the multi-location account." },
    { name: "State restaurant and retail associations", why: "Every state has a restaurant (and lodging) association and a retail association with a newsletter and member events. Restaurant associations already link restaurants to high schools through ProStart (48 states). Ask for a member benefit mention and a 20-minute webinar each season." },
    { name: "Workforce boards and summer youth job programs", why: "Local workforce boards and city summer youth employment programs recruit employers every spring. Offer ScholarTasks free as their application and parent-consent tool, with a partner code so they see their numbers." },
    { name: "Chambers of commerce", why: "State and local chambers reach small businesses. A free 'teen hiring, parent-approved' tool is an easy member benefit and newsletter item." },
    { name: "Camps, YMCAs, Boys & Girls Clubs, parks and recreation", why: "They hire 15 to 17 year olds as junior counselors and lifeguards every summer, often across many sites. The American Camp Association, state park and recreation associations and Y regional offices reach thousands of them." },
    { name: "Families invite the businesses they know", why: "Every family knows a manager: a parent's own workplace, the pizza place, the church daycare. An 'Invite a company' button and share kit turns our families in every state into recruiters at no cost." },
    { name: "Schools on our counselor portal", why: "Work-based learning and career coordinators already call local employers. Give them the link and a printable flyer for their employer lists." },
    { name: "Google search (free)", why: "Mark each approved job with Google's JobPosting format so it can show in Google's job search for free. Indeed now charges for free XML feeds (March 2026), so we skip Indeed for now." },
    { name: "Local news every May and October", why: "Teen job stories run every spring ('worst teen summer job market in decades'). Pitch: 'A free job board where parents approve every teen application.' Each story reaches families and local owners." },
    { name: "Paid ads, last and small", why: "Short Meta and Google ad tests aimed at local business owners in the six weeks before each season, one state at a time. Keep only what brings posted jobs for under about $25 each." },
  ],
  messages: [
    "Hire reliable local teens, with a parent already on board.",
    "Free to post. Every applicant comes with a parent's OK and the parent's email.",
    "Hours rules for 14 and 15 year olds are built in, so scheduling stays legal.",
    "Students near you see your job first. You choose who to call.",
    "Write a reference letter in two minutes and build a loyal summer crew year after year.",
  ],
  metrics: [
    "Live weekend and holiday jobs by state (goal: 100 in Georgia by April 2027, 25 in each Southeast state by summer 2027).",
    "Companies posting, and how many post again next season.",
    "Applications per job, parent consent rate, and Hired rate.",
    "Partners sending companies (associations, workforce boards, chambers, schools) and jobs from each partner code.",
    "Cost per posted job for any paid push.",
  ],
};

/** Steps for the weekend and holiday jobs push. Same rules: never change an id. */
export const PART_TIME_PHASES: Phase[] = [
  {
    id: "emp-pt-prove",
    name: "Weekend jobs A. Prove it in Georgia",
    dates: "Nov 2026 to Feb 2027",
    goal: "30 companies and 50 live weekend or holiday jobs in Georgia, and the first students hired",
    steps: [
      { id: "emp-pt-schema", title: "Show approved jobs in Google's job search", how: "Add Google's JobPosting format to each job page and list them in the sitemap. Free traffic, and companies see students found them.", who: "Claude", when: "Nov 2026", claude: true },
      { id: "emp-pt-invite", title: "Add an Invite a company button for families", how: "On Weekend and holiday jobs: a short message and link families can send to a manager they know, with a referral count.", who: "Claude", when: "Dec 2026", claude: true },
      { id: "emp-pt-kit", title: "Make the employer share kit", how: "One-page flyer with QR code, a short email, a social post and a 20-minute webinar slide set for associations and chambers.", who: "Claude", when: "Dec 2026", claude: true },
      { id: "emp-pt-franchise-ga", title: "Talk to 5 franchise owners in Georgia", how: "Restaurants, grocery, theaters and family entertainment owners with several locations. Offer to set up their first posts with them.", who: "Constant", when: "Jan 2027" },
      { id: "emp-pt-chamber-ga", title: "Present at 3 Georgia chambers of commerce", how: "Macon, Warner Robins and one Atlanta-area chamber. Five minutes, the flyer and the free offer before summer hiring.", who: "Constant", when: "Jan to Feb 2027" },
      { id: "emp-pt-wb-ga", title: "Offer the tool to 2 Georgia workforce boards' summer youth programs", how: "Free application and parent consent for their employers, with a partner code and their own counts.", who: "Constant", when: "Feb 2027" },
    ],
  },
  {
    id: "emp-pt-southeast",
    name: "Weekend jobs B. Partners across the Southeast",
    dates: "Mar to Aug 2027",
    goal: "25 live jobs in each Southeast state and 10 partner organizations sending companies",
    steps: [
      { id: "emp-pt-partner-codes", title: "Build partner codes and partner counts", how: "Associations, workforce boards, chambers and schools get a link; companies who join through it are counted on a simple partner page.", who: "Claude", when: "Mar 2027", claude: true },
      { id: "emp-pt-state-rules", title: "Add each state's teen work rules", how: "Hours, permits and night limits from each state's labor office, shown on the post form for that state (the stricter rule wins).", who: "Claude", when: "Mar 2027", claude: true },
      { id: "emp-pt-assoc", title: "Pitch 6 state restaurant and retail associations", how: "Georgia, Florida, South Carolina, North Carolina, Tennessee, Alabama: a member benefit note and one spring webinar each.", who: "Constant", when: "Mar to Apr 2027" },
      { id: "emp-pt-camps", title: "Reach camps, YMCAs and parks and recreation", how: "The state camp and park and recreation associations and Y regional offices: junior counselor and lifeguard jobs for summer.", who: "Team", when: "Mar 2027" },
      { id: "emp-pt-press-may", title: "Pitch local news before summer", how: "A short story idea and a parent and student to interview, in each state where we have families.", who: "Team", when: "May 2027" },
      { id: "emp-pt-ads-test", title: "Test small ads to business owners in one state", how: "Six weeks before summer hiring, a small budget, measured by posted jobs. Stop if a posted job costs more than about $25.", who: "Team", when: "Apr 2027" },
    ],
  },
  {
    id: "emp-pt-national",
    name: "Weekend jobs C. Many states at once",
    dates: "Sep 2027 to 2028",
    goal: "Jobs in every state where we have families; regional chains posting in several states",
    steps: [
      { id: "emp-pt-multi", title: "Build multi-location company accounts", how: "One company, many locations and managers, posting the same job to several places at once.", who: "Claude", when: "Aug 2027", claude: true },
      { id: "emp-pt-chains", title: "Talk to 10 regional chains and franchise groups", how: "Use Georgia and Southeast results (applications, hires, parent consent) as proof. Start before holiday hiring.", who: "Constant", when: "Sep to Oct 2027" },
      { id: "emp-pt-national-assoc", title: "Approach national groups", how: "Camp, park and recreation and youth sports associations, and the national restaurant group's school program, for a newsletter mention or a partner listing.", who: "Constant", when: "2028" },
      { id: "emp-pt-fee-on", title: "Decide on the flat fee state by state", how: "Turn it on only where jobs get steady applications. Keep it free for camps, nonprofits, parks and schools.", who: "Constant", when: "2028" },
    ],
  },
];

export const PART_TIME_SOURCES = [
  { label: "Teen summer employment 2026 (Pew Research Center)", url: "https://www.pewresearch.org/short-reads/2026/08/19/after-a-long-fade-is-teen-summer-employment-in-the-us-rebounding/" },
  { label: "Holiday hiring 2025, NRF and Challenger (CNN, Dec 2025)", url: "https://kvia.com/news/business-technology/cnn-business-consumer/2025/12/02/economic-warning-sign-holiday-jobs-are-tougher-to-find/" },
  { label: "Recruiting employer partners for summer youth programs (MDRC)", url: "https://www.mdrc.org/work/publications/recruiting-employer-partners-summer-youth-employment-programs" },
  { label: "NYC Summer Youth Employment Program: employer partnerships 2026", url: "https://www.nyc.gov/assets/dycd/downloads/pdf/SYEP_Employer_Partnerships_2026.pdf" },
  { label: "Indeed ends free visibility for some XML feeds (March 2026)", url: "https://www.pulse.bot/hrtech/news/visibility-ends-for-certain-free-single-source-xml-feeds-on-indeed-d0fd11a8-3b21-468c-8d83-d9a7a61c3d69" },
  { label: "ProStart in 48 states (FSR Magazine)", url: "https://www.fsrmagazine.com/industry-news/nraef-school-program-grows-48-states/" },
];

export const ALL_EMPLOYER_STEPS = [...EMPLOYER_PHASES, ...PART_TIME_PHASES].flatMap((p) => p.steps);

export const EMPLOYER_SOURCES = [
  { label: "Child labor rules for teens (U.S. Department of Labor, YouthRules)", url: "https://www.dol.gov/agencies/whd/youthrules" },
  { label: "Hazardous jobs teens can't do (U.S. Department of Labor)", url: "https://www.dol.gov/agencies/whd/child-labor/hazardous-occupations" },
  { label: "Prohibited practices in job ads (U.S. EEOC)", url: "https://www.eeoc.gov/prohibited-employment-policiespractices" },
  { label: "Advertising and marketing basics (FTC)", url: "https://www.ftc.gov/business-guidance/advertising-marketing" },
  { label: "Children's Online Privacy Protection Rule (FTC)", url: "https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa" },
  { label: "Registered Apprenticeship Partner Finder (apprenticeship.gov)", url: "https://www.apprenticeship.gov/partner-finder" },
];
