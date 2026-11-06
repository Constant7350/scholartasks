/**
 * The ScholarTasks help manual and the help balloons.
 *
 * Plain language for parents and students. When a page changes, update its
 * topic here and the balloons that point at it (TIPS below), so help stays true.
 */

export interface Topic {
  id: string;
  /** Which part of the app, shown as a label and used to group the manual. */
  area: string;
  title: string;
  /** Page this topic is about, for the "Open this page" link. */
  href?: string;
  /** Extra words people might search for that aren't in the text. */
  keywords: string[];
  summary: string;
  steps?: string[];
  body?: string[];
  faq?: { q: string; a: string }[];
}

export const AREAS = [
  "Getting started",
  "Family",
  "College plan",
  "Grades and scholarships",
  "AI counselor",
  "Activities and resume",
  "Scholarships",
  "Financial aid forms",
  "Study and practice",
  "Account and privacy",
] as const;

export const TOPICS: Topic[] = [
  // ---------- Getting started ----------
  {
    id: "welcome",
    area: "Getting started",
    title: "What ScholarTasks does",
    href: "/home",
    keywords: ["start", "begin", "overview", "new", "first time", "intro"],
    summary: "ScholarTasks helps families plan for college or a trade from grade 6 to graduation: colleges, deadlines, grades and a four-year course plan, state scholarships like HOPE and Bright Futures, scholarships, aid forms, homework help and SAT and ACT prep in one place, in English or Spanish.",
    body: [
      "A parent owns the family account and adds each student. Students can connect their own phone or computer with a code, and the parent chooses what they are allowed to do.",
      "Reminders come by email, text (if you turn it on), calendar and phone. Choose English or Español in the Menu.",
      "Everything is advice only. The final decisions are always your family's, and official details should be checked on the college's or award's own official site.",
    ],
    steps: [
      "Sign in as a parent.",
      "Look around the Home page and try the tools. Nothing is forced.",
      "When you're ready, add your student on the Family page.",
      "Add grades, a college list and scholarship answers so the advice fits your student.",
    ],
  },
  {
    id: "using-help",
    area: "Getting started",
    title: "Using help: balloons and this manual",
    href: "/help",
    keywords: ["help", "balloon", "tooltip", "question mark", "?", "manual", "guide", "how to", "search"],
    summary: "Tap the ? button at the top of any page to turn on help balloons. Tap ? again to turn them off.",
    steps: [
      "Tap the round ? button in the top bar. Small ? marks appear next to parts of the page.",
      "Tap any ? mark to open a short explanation. Tap \"Read more\" in the balloon to jump to the full topic in this manual.",
      "Tap the ? button again, or \"Turn off help\" at the bottom of the screen, to hide the balloons.",
      "To look something up, open Help from the Menu and type a few words in the search box.",
    ],
    body: ["Your choice is remembered on this device, so help stays on or off until you change it."],
  },
  {
    id: "home",
    area: "Getting started",
    title: "The Home page and Menu",
    href: "/home",
    keywords: ["dashboard", "menu", "navigation", "tiles", "main page", "where is", "back", "switch student", "tab bar", "colors", "theme", "color theme", "dark", "look"],
    summary: "Home shows your students, each student's GPA scorecard, the main tools and key dates for your home state.",
    body: [
      "Tap a tile to open that tool. The Menu button at the top right lists every page. Students see only their own pages; parents also see Family and permissions. Help and Sign out are at the bottom of the menu.",
      "On a computer, the main pages sit in a row under the top bar, and the page you are on is underlined. On a phone, they sit along the bottom of the screen, and More opens the full menu.",
      "Parents: the Viewing box shows which student you are looking at. Pick another name and every page switches to that student, and stays on them as you move around.",
      "Home is always one tap away, in the page row on a computer or the bottom bar on a phone.",
      "Pick the app's colors near the bottom of the Menu, under App colors: Campus (navy and bright colors), Sunrise (cream and peach) or Garden (sage and teal). The choice is saved on that phone or computer, so each person in the family can pick their own.",
    ],
  },

  // ---------- Family ----------
  {
    id: "family-setup",
    area: "Family",
    title: "Set up your family and add a student",
    href: "/family",
    keywords: ["add child", "add student", "family account", "parent", "kid", "son", "daughter", "create family"],
    summary: "The parent names the family account, then adds each student with their first name and grade.",
    steps: [
      "Open Menu, then Family and permissions.",
      "Type a family name (for example \"The Smith family\") and save.",
      "Add your student's first name and grade. Students must be 13 or older. Pick the state your student lives in: full state aid details are ready for Georgia, Florida, Alabama, South Carolina, North Carolina, Tennessee, Mississippi, Louisiana, Kentucky, Virginia and Arkansas. Families in any other state get everything else, plus a link to their state aid office. You can change the state later on the Family page.",
      "Repeat for each student.",
    ],
  },
  {
    id: "remove-student",
    area: "Family",
    title: "Remove a student",
    href: "/family",
    keywords: ["remove student", "delete student", "delete child", "remove child", "wrong student", "test student"],
    summary: "A parent can remove a student from the family. This deletes everything saved for that student and their student app sign-in.",
    steps: [
      "Open Menu, then Family and permissions.",
      "Under the student's name, tap Remove (name).",
      "Read the warning, then tap Yes, remove (name). It can't be undone.",
    ],
  },
  {
    id: "invite-student",
    area: "Family",
    title: "Connect your student's phone with a code",
    href: "/family",
    keywords: ["invite", "code", "join", "student app", "connect", "link", "text", "email", "share"],
    summary: "Give your student an 8-character code so they can use ScholarTasks with their own sign-in.",
    steps: [
      "On the Family page, tap \"Invite (name) to the student app\".",
      "Send the code with the Text it or Email it buttons. Your phone or email app opens with the message ready.",
      "Your student opens the link, signs in with their own email (not yours), and taps Join my family.",
    ],
    faq: [
      { q: "How long does a code work?", a: "7 days. Making a new code cancels the old one." },
      { q: "My student already has an account.", a: "They can open Menu, then \"I'm a student: join with a code\", and type the code." },
    ],
  },
  {
    id: "permissions",
    area: "Family",
    title: "Choose what your student can do",
    href: "/family",
    keywords: ["permissions", "control", "allow", "block", "turn off", "approval", "privacy", "income", "parental controls"],
    summary: "Each student has switches the parent controls, under \"What (name) can do in the student app\" on the Family page.",
    body: [
      "Enter grades and test scores. When off, the Grades page is view-only for the student.",
      "Chat with the AI counselor and the Homework Helper. When off, the student can't use any AI features.",
      "See family income band and cost estimates. Off by default for students under 18.",
      "Mark forms and scholarships done without my approval. When off, the student's checkmark waits for your OK.",
      "Change the college list or plan without my approval. When off, colleges the student adds wait for you to tap Approve.",
    ],
  },

  {
    id: "my-school",
    area: "Family",
    title: "Connect to your school counselor",
    href: "/my-school",
    keywords: ["school", "counselor", "code", "share", "high school", "guidance"],
    summary: "If your school uses ScholarTasks, connect with the school code so your counselor can see how things are going and send reminders. It's free, and you choose what to share.",
    steps: [
      "Get the 8-character school code from your counselor (or open the link they sent).",
      "Open Menu > My school and type the code. Check the school name is right.",
      "Pick what the school can see: progress only, or progress and grades.",
      "Tap Connect. If a student under 18 connects, a parent taps Approve on their own My school page first.",
    ],
    body: [
      "Progress only: college list counts, applications sent, whether the FAFSA is filed, saved scholarships, overdue deadlines, SAT/ACT scores and when the student last used the app.",
      "Progress and grades adds course grades and the state scholarship GPA (like the HOPE GPA). Only a parent, or a student who is 18 or older, can turn this on.",
      "The school never sees essays, notes, AI counselor chats, family income, aid answers or anything about parents.",
      "Tap Stop sharing at any time. Connections end on their own after the student's senior year.",
    ],
  },
  {
    id: "school-portal",
    area: "Family",
    title: "For counselors: the free school portal",
    href: "/school",
    keywords: ["counselor", "school", "portal", "dashboard", "caseload", "staff code", "fafsa completion"],
    summary: "School counselors see the students whose families connected to their school, send reminders and post local scholarships. It's free for every school.",
    steps: [
      "Sign in with your school email, then open /school and fill in Set up your school.",
      "The ScholarTasks team checks your school, usually within a school day.",
      "Share your school code or link with families (newsletter, email, FAFSA night).",
      "Use the filters to find seniors without a FAFSA, students with no college list, or overdue deadlines. Download a CSV any time.",
      "Add other counselors: send them the staff link from Add counselors.",
    ],
    faq: [
      { q: "Is it really free?", a: "Yes. The school portal is free for every school. Families use ScholarTasks free and can upgrade for the AI counselor and tutor." },
      { q: "Can we upload our student list?", a: "Yes. Your school admin signs the student data agreement in Class roster, then uploads a CSV (Student ID, First name, Last name, Grade, optional Email). You see who has connected and can email the school code to families who haven't. No grades are uploaded. Delete the roster any time; if the agreement ends it is deleted within 45 days." },
      { q: "Who sees that I looked at a student?", a: "Every look at the student list is written to a tamper-evident log." },
    ],
  },

  // ---------- College plan ----------
  {
    id: "plan-colleges",
    area: "College plan",
    title: "Build your college list",
    href: "/plan",
    keywords: ["colleges", "universities", "school list", "application", "early action", "early decision", "regular decision", "add college"],
    summary: "Add each college your student is thinking about, how they plan to apply, and the application deadline.",
    steps: [
      "Open Menu, then College list and deadlines.",
      "Under Colleges, type the college name, pick the plan (for example Early action) and add the deadline if you know it.",
      "Tap Add college. Remove a college any time with Remove.",
    ],
    body: ["If a student adds a college and isn't allowed to change the plan alone, it shows as waiting until a parent taps Approve."],
  },
  {
    id: "plan-deadlines",
    area: "College plan",
    title: "Deadlines and email reminders",
    href: "/plan",
    keywords: ["deadline", "due date", "reminder", "email", "notification", "task", "to do", "checklist", "fafsa", "forms", "coming up", "approve"],
    summary: "Keep every scholarship, form and application date in one list and get email reminders before each one.",
    body: [
      "Coming up at the top shows anything due in the next 60 days.",
      "Add scholarships and other deadlines with a title and due date. Check the box when it's done.",
      "Reminder emails go out 30, 14, 7, 2 and 1 days before, and on the day. Turn them off with the switch under Coming up.",
      "Prefer texts? Turn on Text reminders on this page (see Get deadline reminders by text).",
      "If a student checks something off and needs a parent's OK, it shows \"waiting for parent's OK\" until the parent taps Approve.",
    ],
  },
  {
    id: "todo",
    area: "College plan",
    title: "To-do list: what's left and what's done",
    href: "/todo",
    keywords: ["to do", "todo", "to-do", "done", "finished", "checklist", "late", "overdue", "due this week", "warning", "red", "yellow", "colors", "what do I need to do"],
    summary: "One list of everything your student still has to do, sorted by due date, with a Done tab for what's finished.",
    steps: [
      "Open Menu, then To-do list, or tap the To-do list tile on Home.",
      "To do shows open items in groups: Late (red), Due this week (yellow), Due this month, Later, and No due date.",
      "Tick the box when something is finished. It moves to the Done tab. Untick it there to move it back.",
    ],
    body: [
      "The list fills itself from the College plan (colleges you're applying to and every deadline you add) and from scholarships you saved.",
      "For a saved scholarship with a checklist, tap the steps line to tick off each step right from the to-do list.",
      "Ticking a college as done marks the application Submitted. Change it to Accepted and so on from the College plan.",
      "If a student needs a parent's OK to mark things done, the item shows \"Waiting for parent's OK\" in Done until the parent taps Approve.",
      "\"Beyond grades\" steps for the student's grade (join activities, log service, take a leadership role, line up recommenders, draft the essay) are added once each school year. Tap Not for me to hide one that doesn't fit.",
    ],
  },
  {
    id: "ga-dates",
    area: "College plan",
    title: "State dates for your student's grade",
    href: "/plan",
    keywords: ["georgia", "gsfc", "gafutures", "florida", "ffaa", "tennessee promise", "maapp", "sams", "tops", "dates", "calendar", "add to plan", "state deadlines"],
    summary: "Key state aid and college dates for your student's grade, from your home state (for example the FAFSA, Florida's FFAA, Tennessee Promise or Mississippi's MAAPP). Tap Add to plan to track one with reminders.",
    body: ["These are draft dates still being checked with each state's aid office. Confirm on the official state site before relying on them.", "The dates follow the state set for your student on the Family page."],
  },

  {
    id: "find-colleges",
    area: "College plan",
    title: "Find colleges that fit",
    href: "/colleges",
    keywords: ["college search", "match", "quiz", "reach", "match", "likely", "safety", "size", "public", "private", "major", "where to apply"],
    summary: "Answer five quick questions (where, how big, public or private, what to study, price) and see colleges that fit, each with a yearly price and a Reach, Match or Likely label.",
    steps: [
      "Open Menu, then Find colleges.",
      "Tap an answer for each question. Subjects your student picked on the Scholarships page are already ticked.",
      "Tap Show my matches.",
      "Tap + Add on any college to put it on the college list, where its price and deadlines live.",
    ],
    body: [
      "Colleges come from the U.S. Department of Education's College Scorecard: every four-year college, plus Georgia's two-year and technical colleges. To search by major, including two-year and trade schools in every state, use Search colleges by major.",
      "Reach, Match and Likely weigh the student's unweighted GPA, how many AP, IB and dual enrollment classes they have taken, their SAT or ACT, and the college's admit rate. With no test scores (test-optional), grades and rigor decide. They are a rough guide, never a promise. Very selective colleges (under 15% admitted) are always a Reach.",
      "For-profit colleges are left out of matches. You can still add any college by name on the College plan.",
    ],
  },
  {
    id: "search-by-major",
    area: "College plan",
    title: "Search colleges by major",
    href: "/majors",
    keywords: ["major", "field of study", "career", "marine biology", "vet", "veterinarian", "nurse", "nursing", "trade", "pay", "salary", "earnings", "how many years", "transfer", "community college", "two-year college", "save money", "best schools", "ranking", "cost chart"],
    summary: "Type what you want to study (marine biology, vet, nurse, welding...) and see what that career pays, how many years of school it takes, and the strongest programs in your state first, then across the U.S., each with a yearly price for your family.",
    steps: [
      "Open Menu, then Search colleges by major.",
      "Type a major or career, or tap one of the buttons.",
      "Careers and pay: tap Earn the most or Get a job fastest.",
      "Some careers have more than one list (for example vet schools and pre-vet majors). Tap the list you want.",
      "Tap Costs on any college to see what families at each income pay, in-state vs out-of-state tuition, and our estimate for your family. Tap + Add to put it on the college list.",
    ],
    body: [
      "Your home state's colleges come first, but the nationwide list always shows too, so you can choose a school anywhere in the U.S. The list includes four-year colleges and every two-year, technical and trade school in the federal data.",
      "Each program gets a score out of 100 from federal data: how many students finish that major there, the college's graduation rate, what that major's graduates earn, their loans compared with pay, and admitted students' SAT. We don't copy magazine rankings.",
      "Pay for careers comes from the U.S. Bureau of Labor Statistics (May 2025). Pay for graduates of each major comes from the U.S. Department of Education.",
      "Save money: for four-year majors the page compares four years at a university with two years at a low-cost public two-year college and two at the university, and explains how transfer works (in Georgia: UGA's transfer GPA rules, USG core classes that transfer in full, technical college classes that transfer, and Georgia Tech's engineering pathway).",
      "Check things the data can't show, like accreditation and licensing exam pass rates (for example NCLEX for nurses). The page links to where to check.",
      "This is advice to help you compare. The final choice is your family's.",
    ],
  },
  {
    id: "compare-colleges",
    area: "College plan",
    title: "Compare colleges side by side",
    href: "/colleges/compare",
    keywords: ["compare", "compare colleges", "side by side", "rank", "ranking", "which college", "best college for me", "strength in major", "cost", "graduation rate", "1st 2nd 3rd"],
    summary: "Put up to 6 colleges side by side and see each one's place (1st, 2nd, 3rd...) on strength in the major, cost for your family, graduation, pay after, debt and chance of getting in, plus an overall place that uses what matters most to you.",
    steps: [
      "Open Menu, then Compare colleges. Colleges on your college list show up on their own.",
      "Type a college name to add more, or tap × to take one off.",
      "Pick the major (for example Biology). Strength in the major shows the college's place in your state, like \"25th of 48 in Georgia\".",
      "Open What matters most to you? and set each one to Skip, A little, Some or A lot. The overall place changes right away and is remembered on this device.",
      "Tap Copy a link to this comparison to send it to someone in your family.",
    ],
    body: [
      "Every score is out of 100, higher is better. The cheapest college scores 100 on cost and the others less the more they cost; the same for debt. Highest pay scores 100.",
      "Chance of getting in uses the admission rate, adjusted by how your SAT compares with the college's average when both are known.",
      "Places are only among the colleges you are comparing, and ties share a place. Missing data gets no place and doesn't count against a college.",
      "Data: U.S. Department of Education College Scorecard. This is advice to help you compare; the final choice is your family's.",
    ],
  },
  {
    id: "career-quiz",
    area: "College plan",
    title: "Career quiz: which career fits me?",
    href: "/majors/quiz",
    keywords: ["career quiz", "what should i be", "interest quiz", "career test", "job ideas", "undecided", "what major"],
    summary: "Pick what you enjoy and see careers that need college and skilled trades side by side, with typical pay and how many years of school each takes.",
    steps: [
      "Open Menu, then Career quiz. You don't need to sign in.",
      "Tap everything that sounds like you.",
      "Tap Colleges for this or How to start to see where each path leads.",
    ],
    body: ["It's a starting point, not a test. Pay is the U.S. median and varies by state."],
  },
  {
    id: "trades",
    area: "College plan",
    title: "Trades and trade schools",
    href: "/trades",
    keywords: ["trade", "trade school", "technical college", "vocational", "apprenticeship", "union", "electrician", "welder", "welding", "plumber", "HVAC", "lineworker", "CDL", "truck", "cosmetology", "LPN", "mechanic", "HOPE Career Grant", "free tuition", "dual enrollment", "farrier", "Workforce Pell", "WIOA", "TN Promise", "youth apprenticeship", "SkillsUSA"],
    summary: "Explore skilled trades you can train for in weeks to a few years: what each pays, ways to train, licensing, schools in Georgia and every other state, and checklists to apply.",
    steps: [
      "Open Menu, then Trades and trade schools.",
      "Search or tap a group (Building, Health care, Mechanics...). Tick Tuition-free in Georgia to see trades on the HOPE Career Grant list.",
      "Not sure? Tap the quiz and pick what you enjoy.",
      "Open a trade to see pay, ways to train, licensing and Where to train. Pick any state in the finder to see its schools.",
      "Under Steps to apply, tap Add steps to put a checklist on the student's To-do list and calendar.",
      "Scroll down on the Trades page for Planning a trade in grades 8 to 12: pick the student's grade and tap Add steps.",
      "Paying for trade school (on the Trades page, each trade page and the Financial aid page) lists the Pell Grant, Workforce Pell, HOPE, apprenticeships and free training in other states.",
    ],
    body: [
      "Anyone can look at the trade pages without signing in. Adding a checklist needs a ScholarTasks account.",
      "Georgia comes first, but schools and apprenticeships in every state are always shown. HOPE money only works at Georgia schools; Pell Grants and most trade scholarships work anywhere.",
      "Pay is from the U.S. Bureau of Labor Statistics (May 2025). Schools come from the U.S. Department of Education's College Scorecard (schools that take federal aid). Apprenticeships come from the U.S. Department of Labor's finder.",
      "This is advice to help you compare. Check details with the school or program, and the final choice is your family's.",
    ],
  },
  {
    id: "college-costs",
    area: "College plan",
    title: "What each college will cost us",
    href: "/plan",
    keywords: ["cost", "price", "net price", "afford", "tuition", "award letter", "financial aid offer", "compare offers", "how much", "four years"],
    summary: "The College plan shows a yearly and four-year price for every college on the list, cheapest first, with the math behind it.",
    steps: [
      "Add colleges on the College plan. Pick each name from the list as you type, so the price data comes along.",
      "Look at What it will cost us at the top. Tap a college to see how the estimate was worked out.",
      "When an award letter arrives, open that college and type the grants and scholarships it offers (not loans or work-study). The estimate switches to the real offer.",
      "Type outside scholarships the student has won, per year, and they come off every college.",
    ],
    body: [
      "Full price is the college's cost of attendance: tuition, fees, housing, food and books.",
      "Without an award letter, we use what families at your income typically paid at that college (federal data), or your state award (like HOPE, Zell Miller or Bright Futures) if that comes out lower.",
      "Add your income range on the Scholarships page for estimates that fit your family. Students see income-based prices only if their parent allows costs in Family permissions.",
      "Prices are estimates. Every college has its own net price calculator for a closer number.",
    ],
  },
  {
    id: "compare-offers",
    area: "College plan",
    title: "Compare aid offers side by side",
    href: "/plan/offers",
    keywords: ["award letter", "aid offer", "financial aid offer", "compare offers", "net price", "loans", "parent plus", "work-study", "which college is cheapest", "appeal"],
    summary: "Type each college's award letter in once and see free money, loans, work-study and what you really pay, side by side.",
    steps: [
      "Open Menu, then Compare aid offers (or the link under What it will cost us on the College plan).",
      "Tap Add offer next to a college and type each number from the letter, per year.",
      "Look at You pay (net price): cost minus free money. That is the number to compare.",
    ],
    body: [
      "Grants and scholarships are free money. Loans and work-study are not: loans are paid back, and work-study is a paycheck during the year.",
      "Parent PLUS and private loans are debt for the family. Many letters list them as aid anyway, so we show them separately.",
      "The grants you type also update the price on the College plan.",
      "If a college you love offers less, you can ask its aid office for a review and send the better offer.",
    ],
  },
  {
    id: "college-essays",
    area: "College plan",
    title: "Write college essays with the coach",
    href: "/essays",
    keywords: ["essay", "personal statement", "common app essay", "supplement", "why this college", "why us", "writing", "feedback", "brainstorm", "topic", "word count"],
    summary: "Draft the Common App personal essay and each college's extra essays in one place. It saves as you type, counts words, and the AI coach gives feedback without writing for you.",
    steps: [
      "Open Menu, then College essays.",
      "Tap Start my Common App essay, then pick one of the seven prompts (650 words, at least 250).",
      "For a college's own essays, tap Add a college's essay, pick the college from your list, paste its prompt and word limit.",
      "Stuck? Tap Help me find a topic. The coach asks questions drawn from your activities.",
      "When you have a draft, tap Get feedback. Tick Finished when it's done.",
    ],
    body: [
      "The coach never writes sentences, openings or rewrites for you. Colleges want the student's own words, and an essay someone else wrote can get an application thrown out.",
      "Each feedback or topic request uses 1 of the day's AI uses.",
      "Parents can read the drafts too, so they can help.",
      "Copy the finished essay into the Common App or the college's portal yourself.",
    ],
  },
  {
    id: "essay-bundles",
    area: "College plan",
    title: "Essay bundles: one draft for similar questions",
    href: "/essays",
    keywords: ["bundle", "reuse essay", "same essay", "similar prompts", "scholarship essays", "career goals essay", "community service essay", "copy draft"],
    summary: "Saved scholarships and college essays that ask the same kind of question (career goals, a challenge, service, leadership, need) are grouped, so one strong draft can start the others.",
    steps: [
      "Save scholarships and open Get ready to apply on each, so its essay question loads.",
      "Open College essays and scroll to Essay bundles.",
      "Write one essay in a bundle (25 words or more), then tap Use it to start the empty drafts.",
      "Open each one and change it so it answers its own question and fits its word limit.",
    ],
    body: [
      "Only empty drafts are filled, so nothing you already wrote is replaced.",
      "A draft is cut to each award's word limit at the end of a sentence, as a starting point.",
      "Sending the exact same essay everywhere rarely wins. Mention each award's own goals and the people who give it.",
    ],
  },
  {
    id: "younger-students",
    area: "Getting started",
    title: "Students in grades 6 and 7 (under 13)",
    href: "/family",
    keywords: ["6th grade", "7th grade", "sixth", "seventh", "middle school", "under 13", "younger", "child"],
    summary: "A parent can add a student aged 10 to 12 in grades 6 to 8 and use ScholarTasks with them from the parent account.",
    body: [
      "Until 13 there is no student sign-in and no AI help, so nothing about your child is sent to an AI service. Study lessons, practice questions, the career quiz, the grades scorecard and the to-do list all work.",
      "When your student turns 13, open Family and tap Invite to give them their own sign-in.",
    ],
  },
  {
    id: "spanish",
    area: "Getting started",
    title: "Use ScholarTasks in Spanish (en español)",
    href: "/es",
    keywords: ["spanish", "español", "espanol", "language", "idioma", "translate", "traducir"],
    summary: "Open the Menu and pick Español under Language. The menu and every AI answer (counselor, Homework Helper, essay and course advice) switch to Spanish.",
    body: ["Each person picks their own language on each device. Other pages are being translated step by step. The Spanish home page is at scholartasks.com/es. En el menú, elija Español en Language · Idioma."],
  },
  {
    id: "text-reminders",
    area: "College plan",
    title: "Get deadline reminders by text",
    href: "/plan",
    keywords: ["text", "sms", "text message", "cell phone", "phone number", "reminder", "stop texts"],
    summary: "Get a text 7 days before, the day before and the day of each deadline. It's optional and capped at 20 texts a month.",
    steps: [
      "Open the College plan and find Text reminders under Coming up.",
      "Type your U.S. cell number and tap Text me a code.",
      "Type the 6-digit code from the text and tap Turn on texts.",
    ],
    body: ["Each parent and student turns on their own. Tap Turn off, or reply STOP to any text, to stop. Message and data rates may apply. Your number is used only for these reminders and is never shared."],
  },
  {
    id: "calendar-reminders",
    area: "College plan",
    title: "Put deadlines in your calendar and get phone reminders",
    href: "/todo",
    keywords: ["calendar", "google calendar", "apple calendar", "outlook", "ical", "webcal", "subscribe", "reminder", "notification", "phone", "alert", "push"],
    summary: "Add every college deadline and to-do date to your own calendar once, and it keeps itself up to date. The phone app also reminds you before things are due.",
    steps: [
      "Open the To-do list and find the card Put these dates in my calendar. Tap Add to my calendar.",
      "Tap iPhone or Mac Calendar, Google Calendar or Outlook. Your calendar asks you to subscribe. Say yes.",
      "On the phone app, allow notifications when asked. Reminders come 7 days, 2 days, 1 day and the morning of each due date, at 9am.",
    ],
    body: [
      "Each parent and student adds their own. The calendar adds a reminder the evening before each date.",
      "The calendar link is private. Anyone with it can see the dates, so don't post it. Tap Make a new link to turn the old one off.",
      "New deadlines show up in your calendar on their own. Google Calendar can take up to a day to refresh.",
      "Phone reminders update each time you open the app. Signing out clears them.",
    ],
  },
  {
    id: "streaks-badges",
    area: "College plan",
    title: "Weekly streaks and badges",
    href: "/home",
    keywords: ["streak", "badge", "badges", "award", "progress", "weeks in a row", "motivation", "fire"],
    summary: "Home shows how many weeks in a row your student has made progress, plus badges for milestones like 5 colleges on the list or a finished essay.",
    steps: [
      "Get anything done in a week: tick off a to-do, add a grade or activity, save a college or scholarship, answer practice questions, finish a lesson or a FAFSA step.",
      "Do it again next week to grow the streak. A week only breaks the streak once it's over, so there's always time.",
      "Tap See all badges on Home to see what's left and how close you are.",
    ],
    body: [
      "Streaks count weeks, not days, so a busy week of school doesn't wipe out progress.",
      "Things a parent does for the student count too.",
    ],
  },
  // ---------- Activities and resume ----------
  {
    id: "activities",
    area: "Activities and resume",
    title: "Add activities, jobs and awards",
    href: "/activities",
    keywords: ["activities", "extracurricular", "clubs", "sports", "job", "work", "volunteer", "service hours", "awards", "honors", "common app", "brag sheet"],
    summary: "Enter each club, sport, job, volunteer role, family duty and award once, in the same format the Common App uses, and copy it in when you apply.",
    steps: [
      "Open Menu, then Activities and resume.",
      "On the Activities tab, tap Add an activity. Pick the type, then type your role, the club or employer, and what you did (150 characters, like the Common App).",
      "Tick the grades you did it in and add hours per week and weeks per year.",
      "On the Honors and awards tab, add each award and how far it reaches (school, state, national).",
      "Use the arrows to put the most important one first. Colleges read them in that order.",
    ],
    body: [
      "Students can add and change their own list without a parent's OK. Parents can see it and help.",
      "The Common App has room for 10 activities and 5 honors. You can add more here; extras still go on your resume.",
      "Tips appear under the description as you type, like adding a number or starting with an action word. The words are always yours.",
      "The AI counselor and essay help can see this list, so their advice fits what you actually do.",
    ],
  },
  {
    id: "beyond-grades",
    area: "Activities and resume",
    title: "Beyond grades: check-up, service hours, recommenders and brag sheet",
    href: "/activities#checkup",
    keywords: ["beyond grades", "leadership", "community service", "volunteer hours", "service log", "recommendation", "letter of recommendation", "recommender", "teacher letter", "brag sheet", "character", "what colleges look for", "holistic", "check-up"],
    summary: "Colleges look at more than grades: activities, leadership, service, jobs, recommendation letters and character. The Activities page helps you build and track all of them.",
    steps: [
      "Open Menu, then Activities and resume.",
      "Read the Beyond grades check-up at the top. Each line shows what looks good and the next step for your grade.",
      "In Service hours log, add the date, hours and place for each volunteer shift. Totals for this school year and all years show at the top.",
      "In Recommendation letters, add each teacher, counselor, coach or boss you might ask, and change the status as you go: Asked, Said yes, Letter sent, Thanked.",
      "Fill in the Brag sheet in your own words. It saves when you leave a box. Tap Copy for my recommenders and paste it into an email to each one.",
    ],
    body: [
      "Grades and hard classes always come first. After that, colleges like UGA and Georgia Tech read activities, leadership, service, jobs and recommendation letters, and judge character through all of them.",
      "Staying with a few things for years beats a long list. Jobs and family duties count.",
      "The check-up has no scores. It just points to the next step, and it changes with the student's grade.",
      "Essay ideas in the brag sheet stay out of the copy you send to recommenders.",
      "The AI counselor sees these too, so it can suggest the right next step. It won't write your answers for you.",
    ],
    faq: [
      { q: "Who should write my letters?", a: "Two teachers from core or challenging classes who know you well, usually from 11th grade. UGA prefers a teacher who saw you in a hard class. Ask in person in spring of junior year, and give them a month before your deadline." },
      { q: "Do campus visits count at UGA?", a: "No. UGA says it does not consider demonstrated interest. Some private colleges do, so check each college." },
    ],
  },
  {
    id: "resume",
    area: "Activities and resume",
    title: "Make a one-page resume",
    href: "/activities/resume",
    keywords: ["resume", "cv", "print", "pdf", "brag sheet", "scholarship resume", "job"],
    summary: "Turn your activities, awards, GPA and test scores into a clean one-page resume you can print or save as a PDF.",
    steps: [
      "Open Activities and resume, then tap Make my resume.",
      "Type your full name and an email or city for the top. These stay on this device only.",
      "Untick Show GPA if you'd rather leave it off.",
      "Tap Print or save as PDF.",
    ],
    body: ["The resume updates itself whenever you add an activity or a grade."],
  },
  {
    id: "application-profile",
    area: "Activities and resume",
    title: "Application profile: copy and paste into forms",
    href: "/activities/profile",
    keywords: ["profile", "copy", "paste", "application form", "scholarship form", "fill in", "short answer", "bio", "gpa", "activities list"],
    summary: "Everything scholarship and college forms ask for in one place (school, GPA, scores, activities, honors, short answers), each with a Copy button.",
    steps: [
      "Open Activities and resume, then tap Copy for applications.",
      "Tap Copy next to anything, then paste it into the form.",
      "Add the short answers most forms ask for (bio, career goals, a challenge, service, leadership, need). Write them once in College essays.",
    ],
    body: [
      "It all comes from Grades, Activities and Essays, so it updates when they do.",
      "We never fill in or send a form for you. You paste, check and submit it yourself.",
    ],
  },
  {
    id: "common-app-ready",
    area: "Activities and resume",
    title: "Common App ready: check every section before you submit",
    href: "/activities/common-app",
    keywords: ["common app", "common application", "apply", "activities list", "150 characters", "honors", "personal essay", "650 words", "supplement", "self-reported", "srar", "ready"],
    summary: "Every Common App section, filled from what you already entered, checked against Common App's limits, with a readiness score and Copy buttons.",
    steps: [
      "Open Menu, then Common App ready.",
      "Look at the readiness score and fix anything marked ○: a description that is too long, a missing organization or hours, an essay under 250 or over 650 words.",
      "Put your 10 most important activities first on the Activities page. Common App only takes 10 activities and 5 honors.",
      "Tap Copy next to each part and paste it into Common App. Check the counter on the real form, then submit there.",
    ],
    body: [
      "Limits checked: role 50, organization 100, description 150 characters; honor titles 100 characters; personal essay 250 to 650 words.",
      "It only counts and checks. It never rewrites your words, and we never send the application for you.",
    ],
  },

  // ---------- Grades and scholarships ----------
  {
    id: "grades-enter",
    area: "Grades and scholarships",
    title: "Add courses and grades",
    href: "/grades",
    keywords: ["grades", "courses", "classes", "report card", "letter grade", "honors", "AP", "IB", "dual enrollment", "core", "enter"],
    summary: "Add each final grade with the course name, level (standard, honors, AP, IB or dual enrollment), grade year and term.",
    steps: [
      "Open Menu, then Grades and scholarships.",
      "Under Courses and grades, start typing the course name and pick it from the list (or keep what you typed).",
      "Choose the level, grade and term, and tick Core if it's English, math, science, social studies or a world language.",
      "Tap Add course.",
    ],
    body: ["Core courses are the ones that count toward most state scholarships (like HOPE and Bright Futures). A student can only add grades if the parent allows it."],
  },
  {
    id: "grades-import",
    area: "Grades and scholarships",
    title: "Add grades from a report card photo",
    href: "/grades",
    keywords: ["photo", "picture", "scan", "pdf", "upload", "import", "camera", "transcript"],
    summary: "Take a photo of a report card or choose a PDF. The AI reads the courses and grades, and you check them before anything is saved.",
    body: ["This uses 1 of today's 10 AI uses. Always look over the list before saving, because the AI can misread a photo."],
  },
  {
    id: "scorecard",
    area: "Grades and scholarships",
    title: "The GPA scorecard",
    href: "/grades",
    keywords: ["gpa", "scorecard", "on track", "attention", "trend", "weighted", "unweighted", "school gpa"],
    summary: "Always shows your student's state scholarship GPA (HOPE GPA in Georgia, Bright Futures GPA in Florida, TOPS core GPA in Louisiana...) against their goal, whether they're on track, and which classes need attention.",
    body: [
      "The arrow shows how the GPA moved this year. Classes below the lowest OK grade are listed so you know where to focus.",
      "Schools add different extra points for harder classes. Use the school weights setting on the scorecard to match your report card (many schools add 1 for AP, IB and dual enrollment, and 0.5 for honors).",
      "It's an estimate. The state aid office (GAfutures in Georgia) calculates the official number. States without a grade-based state scholarship show the unweighted GPA.",
    ],
  },
  {
    id: "goals",
    area: "Grades and scholarships",
    title: "Set a GPA goal",
    href: "/grades",
    keywords: ["goal", "target", "lowest grade", "minimum", "below standard", "expectations"],
    summary: "Choose a goal GPA and the lowest grade you're OK with. The scorecard and AI counselor use them to decide what needs attention.",
    body: ["With no goal saved, the scorecard uses your state scholarship's GPA line (3.0 for HOPE) and B. Goals are suggestions only; the choice is your family's."],
  },
  {
    id: "hope",
    area: "Grades and scholarships",
    title: "HOPE, Bright Futures, TOPS and other state scholarships",
    href: "/grades",
    keywords: ["hope", "zell", "zell miller", "georgia scholarship", "3.0", "3.7", "rigor", "eligibility", "lottery", "bright futures", "florida", "life scholarship", "palmetto fellows", "south carolina", "tennessee hope", "tops", "louisiana", "kees", "kentucky", "academic challenge", "arkansas", "mtag", "help grant", "mississippi", "state scholarship"],
    summary: "Each state's grade-based scholarships, checked from your student's grades and scores. In Georgia: HOPE and Zell Miller.",
    body: [
      "HOPE needs a 3.0 HOPE GPA. Zell Miller needs a 3.7 HOPE GPA plus a qualifying SAT or ACT score. Both also need enough rigor courses (harder classes such as AP, IB, dual enrollment and some advanced courses).",
      "The tiles on the Grades page show the GPA for each program and what's still missing.",
      "Other states in ScholarTasks: Florida Bright Futures, South Carolina LIFE, Palmetto Fellows and SC HOPE, Tennessee HOPE (a 3.0 GPA or a 21 ACT), Louisiana TOPS, Kentucky KEES, Mississippi HELP, MTAG and MESG, and the Arkansas Academic Challenge. Alabama, North Carolina and Virginia have need-based state grants instead; they're on the Financial aid page.",
      "Some rules can't be checked in the app, such as class rank, service hours or a state form. They show as Also needed.",
      "No student yet? Try the quick state scholarship checker at /tools/hope. Pick your state; nothing there is saved.",
      "State rules come from draft data packs being checked with each state's aid office. Confirm on the official site.",
    ],
  },
  {
    id: "test-scores",
    area: "Grades and scholarships",
    title: "Save SAT and ACT scores",
    href: "/grades",
    keywords: ["sat", "act", "psat", "test", "score", "exam"],
    summary: "Enter your student's best SAT and ACT scores under Test scores so Zell Miller and scholarship matches can use them.",
  },
  {
    id: "grade-rescue",
    area: "Grades and scholarships",
    title: "Bring a grade back up",
    href: "/grades",
    keywords: ["rescue", "failing", "low grade", "struggling", "improve", "plan", "bad grade", "teacher"],
    summary: "Pick a class that's lower than you want. A few quick questions find out what's getting in the way, then the AI makes a step-by-step plan.",
    body: [
      "The plan includes what to say to the teacher, study tips and how a parent can help. It uses 1 of today's 10 AI uses.",
      "AI advice can be wrong. The teacher and your family know best.",
    ],
  },
  {
    id: "next-year",
    area: "Grades and scholarships",
    title: "Plan next year's classes",
    href: "/grades",
    keywords: ["next year", "schedule", "course selection", "registration", "which classes", "rigor", "workload"],
    summary: "List the classes your student is considering and their level. The AI weighs the goal, grades so far and your state scholarship's rules, then suggests where to stretch.",
    body: ["It also lists questions to ask the school counselor. Uses 1 of today's 10 AI uses. The final choice is yours and the school's."],
  },
  {
    id: "course-plan",
    area: "Grades and scholarships",
    title: "Plan all four years of classes",
    href: "/grades/plan",
    keywords: ["four year plan", "4 year plan", "course plan", "graduation requirements", "credits", "rigor courses", "HOPE rigor", "world language"],
    summary: "Lay out grade 9 to 12 class by class. The checklist adds up graduation credits, the rigor courses your state scholarship needs and years of the same world language.",
    body: ["Classes with a saved grade show as taken. Press Check my plan with AI for advice on each year (1 AI use). Every school offers different classes, so go over the plan with the school counselor."],
  },
  {
    id: "transcripts",
    area: "Grades and scholarships",
    title: "Keep school transcripts",
    href: "/grades",
    keywords: ["transcript", "file", "upload", "store", "documents", "report cards"],
    summary: "Upload copies of report cards and transcripts so they're handy for applications. Files are private to your family.",
    body: ["Colleges still need the official transcript sent by the school. You can ask the AI to read a saved file into your grades (1 AI use)."],
  },
  {
    id: "record",
    area: "Grades and scholarships",
    title: "Print a self-reported academic record",
    href: "/grades",
    keywords: ["srar", "self reported", "academic record", "print", "pdf", "summary", "application"],
    summary: "A printable summary of courses, grades, GPAs and test scores, for colleges that let students report their own grades.",
    steps: [
      "On the Grades page, tap Open the record.",
      "Check everything matches the report cards.",
      "Tap Print or save as PDF.",
    ],
    body: ["It's marked unofficial. Colleges ask for the official transcript later."],
  },

  // ---------- AI counselor ----------
  {
    id: "counselor",
    area: "AI counselor",
    title: "Ask the AI counselor",
    href: "/counselor",
    keywords: ["ai", "chat", "counselor", "ask", "question", "advice", "bot", "assistant"],
    summary: "Ask anything about colleges, scholarships, aid forms and deadlines. Answers use your student's saved grades, college list and deadlines.",
    steps: [
      "Open Menu, then AI counselor.",
      "Tap a starter question or type your own, then tap Send.",
      "Tap Start over to begin a fresh conversation.",
    ],
    body: [
      "Answers marked \"From the ScholarTasks answer library\" were reviewed by our team.",
      "AI can make mistakes. Check dates and amounts on official sites. Never share passwords, FSA IDs or Social Security numbers.",
    ],
  },
  {
    id: "ai-uses",
    area: "AI counselor",
    title: "Your 10 AI uses a day",
    href: "/counselor",
    keywords: ["limit", "daily", "10", "ai uses", "ran out", "quota", "messages", "cost"],
    summary: "Each person gets 10 AI uses a day, shared across the counselor, tutor and grade tools. They reset every day.",
    body: [
      "Things that use 1: a counselor message, reading a report card or transcript, a grade rescue plan, next year's class advice, and the tutor checking or explaining a question.",
      "Free things that never use any: the scorecard, goals, the study library, multiple-choice practice, and answers from the reviewed answer library.",
      "Ran out? A parent can buy a pack of extra AI messages on Plan and billing. Extra messages are shared by the family, never expire, and are only used after the day's free 10 are gone.",
      "With the Homework Helper add-on, a student gets up to 30 Homework Helper and practice-tutor turns a day.",
    ],
  },

  // ---------- Scholarships ----------
  {
    id: "scholarship-questions",
    area: "Scholarships",
    title: "Answer the match questions",
    href: "/scholarships",
    keywords: ["questions", "profile", "interests", "major", "citizen", "income", "matching", "improve matches"],
    summary: "About a minute of questions (interests, college plans, citizenship and more) makes the scholarship matches much better.",
    body: [
      "Answers are only used to match scholarships and are never shared.",
      "Need-based awards show as Maybe for students. A parent can add the family income band for those.",
      "Tap the questions box any time to change answers. Matches update when you save.",
    ],
  },
  {
    id: "scholarship-matches",
    area: "Scholarships",
    title: "Read your scholarship matches",
    href: "/scholarships",
    keywords: ["scholarships", "grants", "money", "awards", "match", "maybe", "eligible", "qualify", "coming up", "not a fit", "saved", "hidden"],
    summary: "Awards are sorted into tabs: Good matches, Maybe, Coming up, Not a fit now and Saved.",
    body: [
      "Good matches look like they fit your student's grades, scores and answers.",
      "Maybe means something needs checking. The card says what, and the closest ones are listed first.",
      "Coming up opens in a later grade, with what to work on now.",
      "Not a fit now means something doesn't fit today. If an answer changes, they may move up.",
      "Our list is checked for changes twice a week during scholarship season, but always confirm details on the award's official site.",
    ],
  },
  {
    id: "scholarship-save",
    area: "Scholarships",
    title: "Save a scholarship to your deadlines",
    href: "/scholarships",
    keywords: ["save", "add to deadlines", "track", "hide", "not for us", "show again", "apply"],
    summary: "Tap Add to my deadlines on a scholarship to put it on your plan with email reminders.",
    body: [
      "Tap Not for us to hide one. Hidden awards are listed at the bottom with Show again.",
      "Official site opens the page of the organization that gives the award, where you apply.",
    ],
  },

  // ---------- Financial aid forms ----------
  {
    id: "aid-checklist",
    area: "Financial aid forms",
    title: "The FAFSA and state aid checklist",
    href: "/aid",
    keywords: ["fafsa", "fsa id", "studentaid", "gafutures", "gsfapp", "hope", "zell", "css profile", "financial aid", "pell", "forms", "sai"],
    summary: "Step by step through the FAFSA and your state's own aid steps (in Georgia: GAfutures, HOPE and Zell; in Florida: the FFAA; in Mississippi: the MAAPP...), from making accounts to accepting aid. It also lists every state grant and scholarship for your home state. You file on the official sites; ScholarTasks keeps you on track.",
    steps: [
      "Open Menu, then FAFSA and aid forms.",
      "Tap a step to read what to do, who does it and about how long it takes.",
      "Use the button in each step to open the official site, then come back and tap Mark done.",
      "Optional steps, like the CSS Profile, have a Doesn't apply to us button.",
      "The Next button at the top always jumps to the next step left.",
    ],
    body: [
      "The checklist follows your student's graduation year. A senior in fall 2026 files the 2027-28 FAFSA, which uses 2025 taxes.",
      "Parents and the connected student share the same checklist, so either can tick steps off.",
    ],
    faq: [
      { q: "Will ScholarTasks fill in or submit the FAFSA for us?", a: "No. Only the student and their parents may sign in to StudentAid.gov and submit. We explain each screen, list what to have ready and remind you of dates." },
      { q: "Do we need both the FAFSA and the GSFAPP?", a: "No. Georgia accepts either one for HOPE and Zell Miller. The FAFSA also gives federal aid like Pell Grants, so most families file the FAFSA and skip the GSFAPP." },
    ],
  },
  {
    id: "aid-household",
    area: "Financial aid forms",
    title: "Who fills in the FAFSA, and the household questions",
    href: "/aid",
    keywords: ["contributor", "parent", "divorced", "separated", "stepparent", "remarried", "married", "joint return"],
    summary: "Six quick questions tell you which parents must take part in the FAFSA and build your document list. Only a parent can answer them.",
    body: [
      "The answers are situations only, like \"parents are divorced\". There are no money amounts or ID numbers.",
      "Divorced or separated parents: the parent who gave more financial support in the last 12 months fills in the FAFSA.",
      "Always double-check with StudentAid.gov's own help on who counts as a parent.",
    ],
  },
  {
    id: "aid-documents",
    area: "Financial aid forms",
    title: "Your document list",
    href: "/aid",
    keywords: ["documents", "tax return", "1040", "w-2", "bank", "investments", "what do i need"],
    summary: "A list of what to have ready, built from your household answers. Tick each one off when it's in hand.",
    body: [
      "Keep the papers at home. Don't upload tax returns or bank statements to ScholarTasks.",
      "Most tax numbers move over from the IRS once each contributor gives consent on the FAFSA.",
    ],
  },
  {
    id: "aid-dates",
    area: "Financial aid forms",
    title: "Aid dates and reminders",
    href: "/aid",
    keywords: ["priority date", "deadline", "june 30", "reminder", "when"],
    summary: "Add the federal deadline and each college's own aid priority date to get email reminders before each one.",
    steps: [
      "On the checklist page, find Aid dates and reminders.",
      "Tap Remind me on the FAFSA dates.",
      "For each college, look up its financial aid priority date on its website, pick the date and tap Add.",
    ],
    body: ["Colleges' own dates are usually months before the federal deadline. Filing early helps, because some money runs out."],
  },
  {
    id: "aid-safety",
    area: "Financial aid forms",
    title: "Keeping FSA IDs and SSNs safe",
    href: "/aid",
    keywords: ["password", "ssn", "social security", "fsa id", "safe", "security", "scam"],
    summary: "ScholarTasks never asks for FSA ID logins, GAfutures passwords, Social Security numbers, tax returns or bank details.",
    body: [
      "Each person makes and uses their own StudentAid.gov account. A parent must not make or use the student's.",
      "If anyone asks for these by email, text or phone claiming to be ScholarTasks, it isn't us.",
      "The FAFSA is free. Never pay a website to file it.",
    ],
  },
  // ---------- Study and practice ----------
  {
    id: "homework-helper",
    area: "Study and practice",
    title: "Homework Helper: help with any homework, without cheating",
    href: "/homework",
    keywords: ["homework", "homework help", "tutor", "math", "essay", "science", "history", "spanish", "coding", "photo", "hint", "cheating", "answers", "safe ai", "chatgpt", "add-on", "study coach", "thinking score"],
    summary: "An AI tutor for every subject that keeps your student doing the thinking. It gives hints, checks work and explains ideas, but never gives the answer or writes for them.",
    steps: [
      "Open Menu, then Homework Helper.",
      "Pick the subject, then type the problem or tap Add a photo.",
      "Write what you've tried so far (it gets you better help).",
      "Tap Give me a hint, Check my work, or Explain the idea.",
      "Answer the helper's question with your next step. When you finish, explain it back and try the twin problem on paper.",
    ],
    body: [
      "The helper gives one hint at a time, up to three, then keeps asking smaller questions. It never states the final answer to your problem, never does the next step for you, and never writes sentences, essays, translations or code you could hand in.",
      "Every reply is checked by a second AI before you see it. If a reply gives too much away, it is rewritten or replaced with a guiding question.",
      "No help on tests or quizzes. The helper offers to help you study the topic afterward instead.",
      "Parents see a summary on the same page: subjects and topics, a thinking score (problems finished with 0, 1, 2 or 3+ hints, week by week), each time the helper said no to an answer, and any time it suggested talking to a trusted adult. Your full chat is not saved.",
      "A parent can turn the helper off for a student on the Homework Helper page. Turning off AI chat in Family and permissions turns it off too.",
      "Each reply uses 1 of the day's AI uses. With the Homework Helper add-on, a student gets up to 30 helper turns a day (400 a month for the family). The helper can make mistakes, so if something looks wrong, ask your teacher, and always follow your teacher's rules about AI.",
    ],
    faq: [
      { q: "Will it just give my student the answers?", a: "No. That is the whole point. It is built to ask before it tells, give hints instead of answers, and check that your student can explain their reasoning." },
      { q: "Can it help with essays?", a: "Yes, without writing any of it. It asks questions to help your student find their ideas, explains rules, and gives feedback on their own draft." },
      { q: "Which grades and subjects?", a: "Grades 8 to 12: math, science, English and writing, reading, history and social studies, world languages, computer science, career and technical classes, and study skills." },
    ],
  },
  {
    id: "study",
    area: "Study and practice",
    title: "The study skills library",
    href: "/study",
    keywords: ["study", "lessons", "skills", "how to study", "focus", "timer", "planner", "spacing", "free"],
    summary: "Short lessons on how to study, each with a quick check and a small project to try this week. Free, and no AI used.",
    body: [
      "Some lessons include tools: a review planner that spreads study out before a test, a focus timer, and a weekly plan saved on this device.",
      "Tap \"I finished this lesson\" when done (parents see \"Mark finished\"). Parents can see how many lessons their student has finished.",
      "Lessons marked Draft are still being checked by our teacher reviewer.",
    ],
  },
  {
    id: "practice",
    area: "Study and practice",
    title: "Practice questions and the tutor",
    href: "/practice",
    keywords: ["practice", "quiz", "test yourself", "questions", "tutor", "algebra", "biology", "history", "homework", "hint", "written answer"],
    summary: "Pick a subject and answer a round of questions. Multiple choice is checked instantly and free.",
    body: [
      "For written questions, write your own answer first. The tutor can check it, or you can show a model answer after you try.",
      "Stuck? \"Explain it\" asks the tutor to walk you through the idea (1 AI use).",
      "The tutor teaches; it won't do homework or project answers.",
      "At the end you see your score and the topics to review. Missing a question shows you what to study, so that's useful too.",
    ],
  },

  {
    id: "test-prep",
    area: "Study and practice",
    title: "SAT and ACT prep",
    href: "/test-prep",
    keywords: ["sat", "act", "psat", "test prep", "practice test", "score", "college board", "bluebook", "timed", "zell", "composite", "english", "reading", "science", "math"],
    summary: "Pick SAT or ACT, drill one section at a time for free, or take a short timed practice test that estimates your score.",
    steps: [
      "Open SAT and ACT prep from the Menu and choose SAT or ACT at the top.",
      "Tap a section under Section drills to answer about 10 questions. Each answer is checked right away with an explanation.",
      "When you're ready, start the timed practice test. It gives the same time per question as the real test.",
      "At the end, see your estimated score and review every question.",
      "Check the Score plan: it lists the topics you miss most, your best practice estimate, and the score Zell Miller needs.",
    ],
    body: [
      "Each drill and practice test picks questions at random, starting with ones you haven't answered yet, so repeats are rare until you've seen the whole bank.",
      "Drills are free and use no AI. \"Explain it\" asks the tutor to walk you through a question (1 of today's 10 AI uses).",
      "Timed practice tests are part of the Homework Helper add-on and are free while ScholarTasks is in beta.",
      "Scores are rough estimates from short tests, not official scores. Before test day, take a full-length official practice test: Bluebook for the SAT, or ACT's free practice test.",
      "How the questions are made: every question is original, written by the ScholarTasks team (with help from AI) to match the skills, question types and difficulty in College Board's and ACT's published test outlines. We don't copy, reword or adapt questions from official tests, prep books or websites. A teacher on our team checks each one; until then it shows a Draft label.",
      "SAT is a trademark of the College Board and ACT is a trademark of ACT Education Corp. Neither makes, sponsors or endorses ScholarTasks.",
      "Got an official score? Save it on the Grades page so scholarship matches and the counselor use it.",
    ],
    faq: [
      { q: "SAT or ACT?", a: "Colleges accept either. Try a practice test of each and focus on the one where you score better. State scholarships such as HOPE, Bright Futures and TOPS accept both, but some only count a single sitting." },
      { q: "Does ACT Science count?", a: "On the current ACT, Science is optional and isn't part of the composite score. You can include or skip it in the practice test." },
    ],
  },

  // ---------- Account and privacy ----------
  {
    id: "signin",
    area: "Account and privacy",
    title: "Signing in and passwords",
    href: "/signin",
    keywords: ["sign in", "log in", "login", "password", "forgot", "reset", "google", "email link", "sign out", "face id", "touch id", "fingerprint", "passkey", "biometric", "windows hello"],
    summary: "Sign in with Face ID or fingerprint, email and password, an email link, or Google (website only).",
    body: [
      "Face ID or fingerprint: sign in once any other way, then tap Turn on Face ID on your Home page (or open Face ID, sign-in and account in the Menu). Next time, tap Sign in with Face ID on the sign-in page. No email or password needed.",
      "Do this once on each phone or computer. Lost a device? Remove it on the Face ID, sign-in and account page.",
      "Forgot your password? Tap Forgot password on the sign-in page and follow the email.",
      "Sign out from the Menu.",
      "Students should always use their own email, not a parent's.",
      "In the iPhone and Android app, sign in with a password, an email link or Face ID. Google sign-in works on the website.",
    ],
  },
  {
    id: "security",
    area: "Account and privacy",
    title: "Face ID, sign-in and account page",
    href: "/security",
    keywords: ["face id", "fingerprint", "passkey", "device", "lost phone", "18", "adult", "parent access", "sharing"],
    summary: "Turn on Face ID or fingerprint sign-in, remove lost devices, turn AI help on or off, delete your account, and (for students 18 and older) choose whether parents keep access.",
    body: [
      "Tap Turn on Face ID on this device once on each phone or computer.",
      "Lost a phone? Tap Remove next to it. Your other ways to sign in keep working.",
      "Students who are 18 or older see Parent access. Choose Yes, keep sharing or No, stop sharing. You can change it any time.",
    ],
  },
  {
    id: "billing",
    area: "Account and privacy",
    title: "Your plan, Homework Helper and extra AI messages",
    href: "/billing",
    keywords: ["free", "free plan", "plan", "price", "pay", "payment", "billing", "subscription", "cancel", "card", "receipt", "refund", "study coach", "homework helper", "message pack", "extra messages", "monthly", "yearly", "cost"],
    summary: "A parent manages one plan for the whole family on the Plan and billing page, from the Menu.",
    steps: [
      "Open Menu, then Plan and billing.",
      "Pick the Family plan, monthly or yearly. Current prices are shown on the page.",
      "Optional: add the Homework Helper (safe help with any homework, on its own or with the Family plan), or buy a pack of extra AI messages.",
      "Pay on Stripe's secure page. You come back to ScholarTasks when it's done.",
    ],
    body: [
      "The free plan is free for good: deadlines, college list and costs, grades and state scholarships, scholarships, FAFSA checklist, activities and resume, essays and practice, plus 3 AI uses a day per person. The Family plan adds more AI help (10 a day per person).",
      "During the beta everyone gets the Family plan's AI uses for free, and nobody is charged.",
      "To change your card, switch between monthly and yearly, see receipts or cancel, tap Manage billing. If you cancel, your plan keeps working until the end of the time you paid for.",
      "Only a parent can buy or change the plan. Students see what the family has.",
      "ScholarTasks never sees or stores your card number; Stripe handles payments.",
    ],
  },
  {
    id: "ai-help",
    area: "Account and privacy",
    title: "Allowing AI help, and reporting an AI answer",
    href: "/security#ai-help",
    keywords: ["ai", "allow ai", "anthropic", "claude", "consent", "permission", "report", "wrong answer", "bad answer", "flag"],
    summary: "The first time you open an AI feature, tap Allow AI help. Turn it off any time in Menu, Face ID, sign-in and account.",
    body: [
      "AI help is powered by Claude, made by Anthropic. When you use an AI feature, ScholarTasks sends your question and the planning details needed to answer it. Never passwords, Social Security numbers or FSA IDs.",
      "Each person allows AI help for themselves. Parents also choose whether each student may use AI chat in Family and permissions.",
      "If an AI answer is wrong, unsafe or does homework for you, tap Report this answer under it. Our team reads every report.",
    ],
  },
  {
    id: "delete-account",
    area: "Account and privacy",
    title: "Deleting your account",
    href: "/security#delete-account",
    keywords: ["delete", "delete account", "remove account", "close account", "erase", "my data", "leave"],
    summary: "Open Menu, then Face ID, sign-in and account, and tap Delete my account at the bottom.",
    steps: [
      "Open Menu, then Face ID, sign-in and account.",
      "Scroll to Delete my account and tap it.",
      "Tap Yes, delete it for good.",
    ],
    body: [
      "Parents: if you're the only parent, this deletes your whole family's information, including the students' plans and sign-ins. If another parent is on the account, only you are removed.",
      "Students: this deletes your sign-in. Your parent keeps your family's plan.",
      "Cancel a paid plan first. Can't sign in? Email support@scholartasks.com from your account's email and we'll delete it for you.",
    ],
  },
  {
    id: "privacy",
    area: "Account and privacy",
    title: "Privacy and safety",
    href: "/privacy",
    keywords: ["privacy", "safe", "security", "data", "share", "ssn", "social security", "fsa id"],
    summary: "Your family's information is private to your family. Never type passwords, FSA IDs or Social Security numbers into ScholarTasks.",
    body: ["Read the full Privacy policy and Terms from the links at the bottom of every page."],
  },
  {
    id: "contact",
    area: "Account and privacy",
    title: "Still need help?",
    keywords: ["contact", "support", "email", "bug", "problem", "broken", "feedback"],
    summary: "Email support@scholartasks.com and tell us what page you were on and what happened.",
  },
];

/**
 * A help balloon. It attaches to the first element on the page that matches
 * `sel` (and whose text starts with `text`, if given). Pages don't need any
 * changes; if the element isn't on screen the balloon is simply skipped.
 */
export interface Tip {
  /** Paths where this tip applies. "/study/*" matches any lesson. "*" matches every page. */
  routes: string[];
  sel: string;
  text?: string;
  body: string;
  topic?: string;
}

export const TIPS: Tip[] = [
  // Every page
  { routes: ["*"], sel: "details.menu summary", body: "Every page is in this menu. Students see their own pages; parents also see Family and permissions. Help and Sign out are at the bottom.", topic: "home" },
  { routes: ["*"], sel: ".strip-links", body: "The main pages. The underlined one is where you are now. Tap Home to go back to the start.", topic: "home" },
  { routes: ["*"], sel: ".tabbar", body: "Main pages along the bottom. More opens the full menu.", topic: "home" },
  { routes: ["*"], sel: ".pagestrip .student-switch", body: "Which student you are looking at. Pick another name and every page switches to that student.", topic: "home" },
  { routes: ["/home", "/plan", "/todo", "/grades", "/counselor", "/homework", "/scholarships", "/aid", "/study", "/practice"], sel: ".tabs:not(.sch-tabs):not(.todo-tabs)", body: "Tap a name to switch between your students.", topic: "home" },

  // Activities
  { routes: ["/activities"], sel: "#checkup h2", body: "What colleges read besides grades, and the next step for each. It changes with your grade.", topic: "beyond-grades" },
  { routes: ["/activities"], sel: "#brag h2", body: "Answer in your own words, then copy it into an email to each teacher who writes you a letter.", topic: "beyond-grades" },

  // Home
  { routes: ["/home"], sel: ".hero h1", body: "This is your home base. Try any tool below. You can add your student whenever you're ready.", topic: "welcome" },
  { routes: ["/home"], sel: ".family-card h2", body: "Your students and whether each one has connected their own phone or computer.", topic: "invite-student" },
  { routes: ["/home", "/grades"], sel: ".scorecard .eyebrow", body: "The GPA scorecard: your state scholarship GPA against the goal, whether things are on track, and classes that need attention.", topic: "scorecard" },
  { routes: ["/home"], sel: ".tile[href='/plan'] b", body: "Colleges, scholarships and forms in one list, with email reminders before each deadline.", topic: "plan-deadlines" },
  { routes: ["/home"], sel: ".tile[href='/counselor'] b", body: "Ask questions about colleges and aid. Each message uses 1 of today's 10 AI uses.", topic: "counselor" },
  { routes: ["/home"], sel: ".tile[href='/scholarships'] b", body: "Scholarships and grants matched to your student, sorted by how well they fit.", topic: "scholarship-matches" },
  { routes: ["/home"], sel: ".tile[href='/practice'] b", body: "Quick self-tests. Multiple choice is free; the tutor gives hints, never homework answers.", topic: "practice" },
  { routes: ["/home"], sel: ".tile[href='/grades'] b", body: "Grades, test scores and whether your student is on track for state scholarships.", topic: "hope" },
  { routes: ["/homework"], sel: ".hw-start .field span", body: "Type the problem or add a photo, then say what you tried. The helper gives hints, never answers.", topic: "homework-helper" },
  { routes: ["/homework"], sel: ".hw-switch", body: "Turn the Homework Helper on or off for this student. You see a summary here, never the full chat.", topic: "homework-helper" },
  { routes: ["/home"], sel: ".tile[href='/study'] b", body: "Free lessons on how to study. No AI used.", topic: "study" },
  { routes: ["/home"], sel: ".tile b", text: "Key ", body: "The next aid and college dates for your home state. Draft until checked with the state aid office.", topic: "ga-dates" },

  // Family
  { routes: ["/family"], sel: "h2", text: "Name your family", body: "You're the account owner. Name the family, then add students.", topic: "family-setup" },
  { routes: ["/family"], sel: "h2", text: "Add", body: "Add each student with their first name and grade. Students must be 13 or older.", topic: "family-setup" },
  { routes: ["/family"], sel: ".code-box .code", body: "Your student types this code after signing in with their own email. It works for 7 days.", topic: "invite-student" },
  { routes: ["/family"], sel: "button", text: "Invite", body: "Makes an 8-character code so your student can use their own phone or computer.", topic: "invite-student" },
  { routes: ["/family"], sel: "details.perm summary", body: "Switches that control what this student can do on their own, like using AI or changing the college list.", topic: "permissions" },

  // Join
  { routes: ["/join"], sel: "h2", text: "Enter your family code", body: "Type the 8-character code your parent sent you, then tap Join my family.", topic: "invite-student" },

  { routes: ["/home"], sel: ".tile[href='/todo'] b", body: "Everything still to do, with red for late and yellow for due this week.", topic: "todo" },

  // To-do list
  { routes: ["/todo"], sel: ".todo-summary", body: "How many things are late, due in the next 7 days, and already done.", topic: "todo" },
  { routes: ["/todo"], sel: ".todo-tabs", body: "To do shows what's left, sorted by due date. Done shows what's finished.", topic: "todo" },
  { routes: ["/todo"], sel: ".todo-steps summary", body: "Tap to tick off this scholarship's application steps.", topic: "scholarship-save" },

  // College plan
  { routes: ["/plan"], sel: "h2", text: "Coming up", body: "Everything due in the next 60 days. The switch below turns reminder emails on or off.", topic: "plan-deadlines" },
  { routes: ["/plan"], sel: "label.toggle", body: "Reminder emails go out 30, 14, 7, 2 and 1 days before each deadline, and on the day.", topic: "plan-deadlines" },
  { routes: ["/plan"], sel: "h2", text: "Colleges", body: "Add each college, how you plan to apply, and its deadline.", topic: "plan-colleges" },
  { routes: ["/plan"], sel: "h2", text: "Scholarships and other", body: "Add any scholarship, form or task with a due date. Check it off when it's done.", topic: "plan-deadlines" },
  { routes: ["/plan"], sel: "h2.state-dates", body: "State dates for this grade. Tap Add to plan to get reminders.", topic: "ga-dates" },
  { routes: ["/plan"], sel: "button", text: "Approve", body: "Your student changed something that needs your OK. Tap Approve to accept it.", topic: "permissions" },

  // Grades
  { routes: ["/grades"], sel: "h2", text: "Goals", body: "Set the goal GPA and lowest OK grade. The scorecard and AI use these.", topic: "goals" },
  { routes: ["/grades"], sel: ".tile b", body: "Each state program's GPA estimate and what's still missing.", topic: "hope" },
  { routes: ["/grades"], sel: "h2", text: "Test scores", body: "Best SAT and ACT scores. Used for Zell Miller and scholarship matches.", topic: "test-scores" },
  { routes: ["/grades"], sel: "h2", text: "Add grades from a report card", body: "Snap a photo or pick a PDF; the AI fills in the grades for you to check. Uses 1 AI use.", topic: "grades-import" },
  { routes: ["/grades"], sel: "h2", text: "Bring a grade back up", body: "A few questions, then a step-by-step plan to raise one class. Uses 1 AI use.", topic: "grade-rescue" },
  { routes: ["/grades"], sel: "h2", text: "Plan ", body: "List next year's classes and get advice on where to stretch. Uses 1 AI use.", topic: "next-year" },
  { routes: ["/grades"], sel: "h2", text: "School transcripts", body: "Keep copies of report cards and transcripts here. Private to your family.", topic: "transcripts" },
  { routes: ["/grades"], sel: "h2", text: "Self-reported academic record", body: "A printable grade summary for colleges that let students report their own grades.", topic: "record" },
  { routes: ["/grades"], sel: "h2", text: "Courses and grades", body: "Add each final grade. Tick Core for English, math, science, social studies and world languages.", topic: "grades-enter" },

  // Record
  { routes: ["/grades/record"], sel: "h1", body: "Check everything matches the report cards before you use it on an application.", topic: "record" },
  { routes: ["/grades/record"], sel: "button", text: "🖨", body: "Print it, or choose Save as PDF in the print window.", topic: "record" },

  // Counselor
  { routes: ["/counselor"], sel: "main h1", body: "Ask about colleges, aid and deadlines. Answers use your student's saved grades and plan.", topic: "counselor" },
  { routes: ["/counselor"], sel: ".chat .chip", body: "Tap a starter question to try it.", topic: "counselor" },
  { routes: ["/counselor"], sel: ".chat-input button", body: "Each message uses 1 of today's 10 AI uses. Reviewed library answers are free.", topic: "ai-uses" },
  { routes: ["/counselor"], sel: ".bank-note", body: "This answer came from our reviewed answer library.", topic: "counselor" },

  // Scholarships (selectors only, no page changes)
  { routes: ["/scholarships"], sel: "details.sch-profile summary", body: "About a minute of questions that make the matches much better. Tap to open or change answers.", topic: "scholarship-questions" },
  { routes: ["/scholarships"], sel: ".sch-tabs", body: "Good matches fit now. Maybe needs a check. Coming up opens in a later grade.", topic: "scholarship-matches" },
  { routes: ["/scholarships"], sel: ".sch-card h2", body: "Each card shows who offers it, the amount, the deadline and why it fits or what to check.", topic: "scholarship-matches" },
  { routes: ["/scholarships"], sel: ".sch-card button", text: "Add to my deadlines", body: "Puts this award on your plan with email reminders.", topic: "scholarship-save" },
  { routes: ["/scholarships"], sel: ".sch-card button", text: "Not for us", body: "Hides this award. Find it again under Hidden at the bottom.", topic: "scholarship-save" },

  // Financial aid
  { routes: ["/aid"], sel: ".aid-summary h2", body: "How many FAFSA steps are done. The button jumps to the next one.", topic: "aid-checklist" },
  { routes: ["/aid"], sel: ".aid-safe", body: "You file on the official sites. We never ask for FSA IDs, passwords or SSNs.", topic: "aid-safety" },
  { routes: ["/aid"], sel: "h2", text: "Who fills in", body: "Who must take part in the FAFSA, from the household questions.", topic: "aid-household" },
  { routes: ["/aid"], sel: "h2", text: "Documents to have ready", body: "What to have ready before you start. Tick each one off.", topic: "aid-documents" },
  { routes: ["/aid"], sel: "h2", text: "Aid dates", body: "Get reminders for the FAFSA deadline and each college's aid priority date.", topic: "aid-dates" },
  { routes: ["/aid"], sel: ".aid-step summary", body: "Tap a step to see what to do, then Mark done.", topic: "aid-checklist" },
  { routes: ["/home"], sel: ".tile[href='/aid'] b", body: "Step-by-step FAFSA and state aid checklist with reminders.", topic: "aid-checklist" },

  // Study
  { routes: ["/study"], sel: "main h1", body: "Free lessons on how to study. No AI used.", topic: "study" },
  { routes: ["/study"], sel: ".lesson-tile b", body: "Open a lesson. Each has a quick check and a small project for this week.", topic: "study" },
  { routes: ["/study/*"], sel: "h2", text: "Quick check", body: "A few questions to see if the idea stuck. Free.", topic: "study" },
  { routes: ["/study/*"], sel: "h2", text: "Try it this week", body: "A small project to try. Tap the finished button below when you're done.", topic: "study" },

  // SAT and ACT prep
  { routes: ["/home"], sel: ".tile[href='/test-prep'] b", body: "Free SAT and ACT drills, plus timed practice tests with a score estimate.", topic: "test-prep" },
  { routes: ["/test-prep"], sel: ".tp-exam-tabs", body: "Switch between SAT and ACT practice.", topic: "test-prep" },
  { routes: ["/test-prep"], sel: "h2", text: "Score plan", body: "Your official score, best practice estimate, the Zell Miller target and the topics to work on first.", topic: "test-prep" },
  { routes: ["/test-prep"], sel: ".practice-tile b", body: "A free, untimed drill of about 10 questions in this section.", topic: "test-prep" },
  { routes: ["/test-prep"], sel: "button", text: "Start the practice test", body: "A short timed test with the real test's pacing. You get an estimated score at the end.", topic: "test-prep" },
  { routes: ["/test-prep"], sel: ".tp-timer", body: "Time left in this section. When it runs out, the next section starts.", topic: "test-prep" },

  // Practice
  { routes: ["/practice"], sel: "h2", text: "Topics to review", body: "Topics missed in earlier rounds. Practice these first.", topic: "practice" },
  { routes: ["/practice"], sel: ".practice-tile b", body: "Pick a subject to start a round of questions.", topic: "practice" },
  { routes: ["/practice"], sel: "button", text: "🤖 Check my answer", body: "The tutor checks your written answer and gives feedback (1 AI use).", topic: "ai-uses" },
  { routes: ["/practice"], sel: "button", text: "Show a model answer", body: "See a strong answer after you've tried your own.", topic: "practice" },

];

export function tipsFor(path: string): Tip[] {
  const p = path.replace(/\/+$/, "") || "/";
  return TIPS.filter((t) =>
    t.routes.some((r) => r === "*" || r === p || (r.endsWith("/*") && p.startsWith(r.slice(0, -1)))),
  );
}

/** The manual topic that best describes a page, for "Read about this page". */
export function topicForPath(path: string): Topic | undefined {
  const p = path.replace(/\/+$/, "") || "/";
  return TOPICS.find((t) => t.href === p) ?? TOPICS.find((t) => t.href && p.startsWith(t.href + "/"));
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s]/gu, " ");

function topicText(t: Topic) {
  return [t.summary, ...(t.steps ?? []), ...(t.body ?? []), ...(t.faq ?? []).flatMap((f) => [f.q, f.a])].join(" ");
}

/** Simple ranked search. Every word must appear somewhere; title and keyword hits rank higher. */
export function searchTopics(query: string): Topic[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 0);
  if (!words.length) return TOPICS;
  const scored = TOPICS.map((t) => {
    const title = norm(t.title);
    const keys = norm(t.keywords.join(" ") + " " + t.area);
    const text = norm(topicText(t));
    let score = 0;
    for (const w of words) {
      const s = (title.includes(w) ? 6 : 0) + (keys.includes(w) ? 4 : 0) + (text.includes(w) ? 1 : 0);
      if (!s) return { t, score: 0 };
      score += s;
    }
    return { t, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.t);
}
