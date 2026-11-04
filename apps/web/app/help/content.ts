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
  "Grades and HOPE",
  "AI counselor",
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
    summary: "ScholarTasks helps families plan for college: colleges, deadlines, grades, HOPE, scholarships and study help in one place.",
    body: [
      "A parent owns the family account and adds each student. Students can connect their own phone or computer with a code, and the parent chooses what they are allowed to do.",
      "Everything is advice only. The final decisions are always your family's, and official details should be checked on the college's or sponsor's own site.",
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
    keywords: ["dashboard", "menu", "navigation", "tiles", "main page", "where is", "back", "switch student", "tab bar"],
    summary: "Home shows your students, each student's GPA scorecard, the main tools and key Georgia dates.",
    body: [
      "Tap a tile to open that tool. The Menu button at the top right lists every page. Students see only their own pages; parents also see Family and permissions. Help and Sign out are at the bottom of the menu.",
      "On a computer, the main pages sit in a row under the top bar, and the page you are on is underlined. On a phone, they sit along the bottom of the screen, and More opens the full menu.",
      "Parents: the Viewing box shows which student you are looking at. Pick another name and every page switches to that student, and stays on them as you move around.",
      "Home is always one tap away, in the page row on a computer or the bottom bar on a phone.",
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
      "Add your student's first name and grade. Students must be 13 or older. Georgia only for now.",
      "Repeat for each student.",
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
      "Chat with the AI counselor and study coach. When off, the student can't use any AI features.",
      "See family income band and cost estimates. Off by default for students under 18.",
      "Mark forms and scholarships done without my approval. When off, the student's checkmark waits for your OK.",
      "Change the college list or plan without my approval. When off, colleges the student adds wait for you to tap Approve.",
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
    ],
  },
  {
    id: "ga-dates",
    area: "College plan",
    title: "Georgia dates for your student's grade",
    href: "/plan",
    keywords: ["georgia", "gsfc", "gafutures", "dates", "calendar", "add to plan"],
    summary: "Key Georgia aid and college dates for your student's grade. Tap Add to plan to track one with reminders.",
    body: ["These are draft dates still being checked with the Georgia Student Finance Commission. Confirm on GAfutures before relying on them."],
  },

  // ---------- Grades and HOPE ----------
  {
    id: "grades-enter",
    area: "Grades and HOPE",
    title: "Add courses and grades",
    href: "/grades",
    keywords: ["grades", "courses", "classes", "report card", "letter grade", "honors", "AP", "IB", "dual enrollment", "core", "enter"],
    summary: "Add each final grade with the course name, level (standard, honors, AP, IB or dual enrollment), grade year and term.",
    steps: [
      "Open Menu, then Grades and HOPE.",
      "Under Courses and grades, start typing the course name and pick it from the list (or keep what you typed).",
      "Choose the level, grade and term, and tick Core if it's English, math, science, social studies or a world language.",
      "Tap Add course.",
    ],
    body: ["Core courses are the ones that count toward HOPE. A student can only add grades if the parent allows it."],
  },
  {
    id: "grades-import",
    area: "Grades and HOPE",
    title: "Add grades from a report card photo",
    href: "/grades",
    keywords: ["photo", "picture", "scan", "pdf", "upload", "import", "camera", "transcript"],
    summary: "Take a photo of a report card or choose a PDF. The AI reads the courses and grades, and you check them before anything is saved.",
    body: ["This uses 1 of today's 10 AI uses. Always look over the list before saving, because the AI can misread a photo."],
  },
  {
    id: "scorecard",
    area: "Grades and HOPE",
    title: "The GPA scorecard",
    href: "/grades",
    keywords: ["gpa", "scorecard", "on track", "attention", "trend", "weighted", "unweighted", "school gpa"],
    summary: "Always shows your student's HOPE GPA against their goal, whether they're on track, and which classes need attention.",
    body: [
      "The arrow shows how the GPA moved this year. Classes below the lowest OK grade are listed so you know where to focus.",
      "Schools add different extra points for harder classes. Use the school weights setting on the scorecard to match your report card (many schools add 1 for AP, IB and dual enrollment, and 0.5 for honors).",
      "It's an estimate. GAfutures calculates the official HOPE GPA.",
    ],
  },
  {
    id: "goals",
    area: "Grades and HOPE",
    title: "Set a GPA goal",
    href: "/grades",
    keywords: ["goal", "target", "lowest grade", "minimum", "below standard", "expectations"],
    summary: "Choose a goal GPA and the lowest grade you're OK with. The scorecard and AI counselor use them to decide what needs attention.",
    body: ["With no goal saved, the scorecard uses 3.0 (the HOPE line) and B. Goals are suggestions only; the choice is your family's."],
  },
  {
    id: "hope",
    area: "Grades and HOPE",
    title: "HOPE and Zell Miller",
    href: "/grades",
    keywords: ["hope", "zell", "zell miller", "georgia scholarship", "3.0", "3.7", "rigor", "eligibility", "lottery"],
    summary: "Georgia's HOPE and Zell Miller scholarships depend on the HOPE GPA from core classes and, for Zell, test scores and rigor.",
    body: [
      "HOPE needs a 3.0 HOPE GPA. Zell Miller needs a 3.7 HOPE GPA plus a qualifying SAT or ACT score. Both also need enough rigor courses (harder classes such as AP, IB, dual enrollment and some advanced courses).",
      "The tiles on the Grades page show the GPA for each program and what's still missing.",
      "No student yet? Try the quick HOPE checker at /tools/hope. Nothing there is saved.",
      "Georgia rules come from a draft data pack being checked with GSFC. Confirm on GAfutures.",
    ],
  },
  {
    id: "test-scores",
    area: "Grades and HOPE",
    title: "Save SAT and ACT scores",
    href: "/grades",
    keywords: ["sat", "act", "psat", "test", "score", "exam"],
    summary: "Enter your student's best SAT and ACT scores under Test scores so Zell Miller and scholarship matches can use them.",
  },
  {
    id: "grade-rescue",
    area: "Grades and HOPE",
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
    area: "Grades and HOPE",
    title: "Plan next year's classes",
    href: "/grades",
    keywords: ["next year", "schedule", "course selection", "registration", "which classes", "rigor", "workload"],
    summary: "List the classes your student is considering and their level. The AI weighs the goal, grades so far and HOPE's rigor rule, then suggests where to stretch.",
    body: ["It also lists questions to ask the school counselor. Uses 1 of today's 10 AI uses. The final choice is yours and the school's."],
  },
  {
    id: "transcripts",
    area: "Grades and HOPE",
    title: "Keep school transcripts",
    href: "/grades",
    keywords: ["transcript", "file", "upload", "store", "documents", "report cards"],
    summary: "Upload copies of report cards and transcripts so they're handy for applications. Files are private to your family.",
    body: ["Colleges still need the official transcript sent by the school. You can ask the AI to read a saved file into your grades (1 AI use)."],
  },
  {
    id: "record",
    area: "Grades and HOPE",
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
      "With the Study Coach add-on, a person gets more tutor help each day.",
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
      "Our list is checked for changes twice a week during scholarship season, but always confirm details on the sponsor's official site.",
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
      "Official site opens the sponsor's page, where you apply.",
    ],
  },

  // ---------- Financial aid forms ----------
  {
    id: "aid-checklist",
    area: "Financial aid forms",
    title: "The FAFSA and Georgia aid checklist",
    href: "/aid",
    keywords: ["fafsa", "fsa id", "studentaid", "gafutures", "gsfapp", "hope", "zell", "css profile", "financial aid", "pell", "forms", "sai"],
    summary: "Step by step through the FAFSA, the GAfutures account, HOPE and Zell, from making accounts to accepting aid. You file on the official sites; ScholarTasks keeps you on track.",
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
      "Drills are free and use no AI. \"Explain it\" asks the tutor to walk you through a question (1 of today's 10 AI uses).",
      "Timed practice tests are part of the Study Coach add-on and are free while ScholarTasks is in beta.",
      "Scores are rough estimates from short tests, not official scores. Before test day, take a full-length official practice test: Bluebook for the SAT, or ACT's free practice test.",
      "All questions are written for ScholarTasks in the style of the real tests. Questions marked Draft are still being checked by our teacher reviewer.",
      "Got an official score? Save it on the Grades page so scholarship matches and the counselor use it.",
    ],
    faq: [
      { q: "SAT or ACT?", a: "Colleges accept either. Try a practice test of each and focus on the one where you score better. Georgia's HOPE and Zell Miller rules accept both." },
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
    summary: "Sign in with Face ID or fingerprint, email and password, an email link, or Google.",
    body: [
      "Face ID or fingerprint: sign in once any other way, then tap Turn on Face ID on your Home page (or open Face ID, sign-in and account in the Menu). Next time, tap Sign in with Face ID on the sign-in page. No email or password needed.",
      "Do this once on each phone or computer. Lost a device? Remove it on the Face ID, sign-in and account page.",
      "Forgot your password? Tap Forgot password on the sign-in page and follow the email.",
      "Sign out from the Menu.",
      "Students should always use their own email, not a parent's.",
    ],
  },
  {
    id: "billing",
    area: "Account and privacy",
    title: "Your plan, Study Coach and extra AI messages",
    href: "/billing",
    keywords: ["plan", "price", "pay", "payment", "billing", "subscription", "cancel", "card", "receipt", "refund", "study coach", "message pack", "extra messages", "monthly", "yearly", "cost"],
    summary: "A parent manages one plan for the whole family on the Plan and billing page, from the Menu.",
    steps: [
      "Open Menu, then Plan and billing.",
      "Pick the Family plan, monthly or yearly. Current prices are shown on the page.",
      "Optional: add Study Coach for more tutor help, or buy a pack of extra AI messages.",
      "Pay on Stripe's secure page. You come back to ScholarTasks when it's done.",
    ],
    body: [
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
  { routes: ["/home", "/plan", "/todo", "/grades", "/counselor", "/scholarships", "/aid", "/study", "/practice"], sel: ".tabs:not(.sch-tabs):not(.todo-tabs)", body: "Tap a name to switch between your students.", topic: "home" },

  // Home
  { routes: ["/home"], sel: ".hero h1", body: "This is your home base. Try any tool below. You can add your student whenever you're ready.", topic: "welcome" },
  { routes: ["/home"], sel: ".family-card h2", body: "Your students and whether each one has connected their own phone or computer.", topic: "invite-student" },
  { routes: ["/home", "/grades"], sel: ".scorecard .eyebrow", body: "The GPA scorecard: HOPE GPA against the goal, whether things are on track, and classes that need attention.", topic: "scorecard" },
  { routes: ["/home"], sel: ".tile[href='/plan'] b", body: "Colleges, scholarships and forms in one list, with email reminders before each deadline.", topic: "plan-deadlines" },
  { routes: ["/home"], sel: ".tile[href='/counselor'] b", body: "Ask questions about colleges and aid. Each message uses 1 of today's 10 AI uses.", topic: "counselor" },
  { routes: ["/home"], sel: ".tile[href='/scholarships'] b", body: "Scholarships and grants matched to your student, sorted by how well they fit.", topic: "scholarship-matches" },
  { routes: ["/home"], sel: ".tile[href='/practice'] b", body: "Quick self-tests. Multiple choice is free; the tutor gives hints, never homework answers.", topic: "practice" },
  { routes: ["/home"], sel: ".tile[href='/grades'] b", body: "Grades, test scores and whether your student is on track for HOPE and Zell Miller.", topic: "hope" },
  { routes: ["/home"], sel: ".tile[href='/study'] b", body: "Free lessons on how to study. No AI used.", topic: "study" },
  { routes: ["/home"], sel: ".tile b", text: "Key Georgia dates", body: "The next Georgia aid and college dates. Draft until checked with GSFC.", topic: "ga-dates" },

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
  { routes: ["/plan"], sel: "h2", text: "Georgia dates", body: "Georgia dates for this grade. Tap Add to plan to get reminders.", topic: "ga-dates" },
  { routes: ["/plan"], sel: "button", text: "Approve", body: "Your student changed something that needs your OK. Tap Approve to accept it.", topic: "permissions" },

  // Grades
  { routes: ["/grades"], sel: "h2", text: "Goals", body: "Set the goal GPA and lowest OK grade. The scorecard and AI use these.", topic: "goals" },
  { routes: ["/grades"], sel: ".tile b", body: "Each Georgia program's GPA estimate and what's still missing.", topic: "hope" },
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
  { routes: ["/home"], sel: ".tile[href='/aid'] b", body: "Step-by-step FAFSA and Georgia aid checklist with reminders.", topic: "aid-checklist" },

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
