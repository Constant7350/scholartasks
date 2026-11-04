// The study skills library. Short lessons on study methods with strong
// research behind them (practice testing and spaced practice rate highest in
// Dunlosky et al., 2013, "Improving Students' Learning With Effective Learning
// Techniques"). Each lesson has steps, a quick check with feedback, and a
// "try it this week" project sized by grade band. Content is reviewed by a
// teacher on /admin/lessons before it is marked reviewed.

export interface Check { q: string; options: string[]; answer: number; explain: string }
export interface Project { band: "8-9" | "10-12"; title: string; steps: string[] }
export type Tool = "spacing-planner" | "focus-timer" | "week-planner";

export interface Lesson {
  id: string;
  emoji: string;
  title: string;
  minutes: number;
  summary: string;
  why: string;
  steps: { title: string; body: string }[];
  tool?: Tool;
  checks: Check[];
  projects: Project[];
}

export const LESSONS: Lesson[] = [
  {
    id: "test-yourself",
    emoji: "🧠",
    title: "Test yourself instead of rereading",
    minutes: 6,
    summary: "Pulling an answer out of your memory makes it stick far better than reading it again.",
    why: "Rereading feels productive because the page looks familiar, but familiar isn't the same as remembered. Each time you make yourself recall something, your brain strengthens the path to it. That's why practice tests are one of the best-studied ways to learn.",
    steps: [
      { title: "Close the book first", body: "After reading a section, close it and write or say everything you remember. Then open it and check what you missed." },
      { title: "Turn notes into questions", body: "Rewrite each heading or key idea as a question (\"What causes inflation?\"). Cover the answers and quiz yourself." },
      { title: "Use flashcards the right way", body: "Say the answer out loud before you flip the card. Keep the cards you miss in a separate pile and go through that pile again." },
      { title: "Make it a little hard", body: "If recalling feels easy, wait longer before testing yourself. A small struggle is a sign it's working." },
    ],
    checks: [
      { q: "You have a test Friday. Which plan helps you remember the most?", options: ["Reread your notes three times", "Highlight the important parts of the chapter", "Answer practice questions without looking, then check"], answer: 2, explain: "Recalling answers without looking (practice testing) beats rereading and highlighting." },
      { q: "You flip a flashcard and think \"oh yeah, I knew that.\" What's the better habit?", options: ["Say the answer out loud before flipping", "Flip faster to get through more cards", "Only study the cards you already know"], answer: 0, explain: "Committing to an answer first is what makes flashcards real practice." },
      { q: "Recalling something takes effort and you get some wrong. That means:", options: ["The method isn't working", "You're learning: the effort helps it stick", "You should go back to rereading"], answer: 1, explain: "Some struggle while recalling is normal and actually helps memory." },
    ],
    projects: [
      { band: "8-9", title: "Question cards for one class", steps: ["Pick the class with the next quiz.", "Make 10 question cards from your notes (question on front, answer on back).", "Quiz yourself on 2 different days and keep a tally of how many you got right each time."] },
      { band: "10-12", title: "Build your own practice test", steps: ["Pick the next unit test.", "Write a 10-question practice test in the style your teacher uses (multiple choice, short answer or problems).", "Take it 2 days before the real test without notes, mark it, and study only what you missed."] },
    ],
  },
  {
    id: "space-it-out",
    emoji: "📅",
    title: "Space it out (no more cramming)",
    minutes: 5,
    summary: "Short review sessions spread over several days beat one long night of cramming.",
    why: "Cramming can get you through tomorrow's quiz, but most of it is forgotten within days, and finals and the SAT need it later. Reviewing a little on several days, with gaps in between, makes memories last.",
    steps: [
      { title: "Start early", body: "When a test is announced, put review sessions on your calendar right away, not just the night before." },
      { title: "Use growing gaps", body: "Review the day after you learn something, then a few days later, then a week later." },
      { title: "Keep sessions short", body: "20 to 30 minutes of focused review is enough. Three short sessions beat one three-hour session." },
      { title: "Mix in old material", body: "Spend a few minutes of each session on last month's topics so they don't fade." },
    ],
    tool: "spacing-planner",
    checks: [
      { q: "Which schedule is best for a test in 8 days?", options: ["3 hours the night before", "30 minutes on 4 different days", "1 hour today, then nothing"], answer: 1, explain: "Spreading the same time over several days leads to much better memory." },
      { q: "Why does cramming feel like it works?", options: ["It does work for long-term memory", "The material is fresh, so you remember it for a day or two", "Teachers design tests for cramming"], answer: 1, explain: "Crammed material is forgotten fast, which hurts on finals and later units." },
      { q: "A good gap pattern after learning something new is:", options: ["Next day, a few days later, a week later", "Every hour on the same day", "Once, a month later"], answer: 0, explain: "Growing gaps give your memory time to strengthen between reviews." },
    ],
    projects: [
      { band: "8-9", title: "Plan your next quiz", steps: ["Use the review planner on this page for your next quiz.", "Put the review days in your phone or planner.", "Do each short session and check them off."] },
      { band: "10-12", title: "Spacing for a big test", steps: ["Pick your next unit test or the SAT/ACT.", "Use the review planner to set at least 4 sessions.", "After the test, compare your score with your last test and write one sentence about what changed."] },
    ],
  },
  {
    id: "focus-sessions",
    emoji: "⏱️",
    title: "Focus sessions: phone away, timer on",
    minutes: 5,
    summary: "Work in short, distraction-free blocks with real breaks in between.",
    why: "Every time you check your phone, it takes a while to get your focus back. Short timed blocks with the phone in another room get more done in less time, and the breaks keep your energy up.",
    steps: [
      { title: "Pick one task", body: "Decide exactly what you'll do in this block, like \"finish 10 math problems\" or \"outline the essay.\"" },
      { title: "Phone out of reach", body: "Put it in another room or in a drawer, on silent. Out of sight works better than face down." },
      { title: "Work for 25 minutes", body: "If you think of something else, write it on a scrap of paper and get back to the task." },
      { title: "Take a real 5-minute break", body: "Stand up, stretch, get water. After four blocks, take a longer 15 to 30 minute break." },
    ],
    tool: "focus-timer",
    checks: [
      { q: "Where should your phone be during a focus block?", options: ["Face down on the desk", "In another room or a drawer", "In your hand, on silent"], answer: 1, explain: "Even a face-down phone pulls your attention. Out of reach works best." },
      { q: "You remember you need to text a friend in the middle of a block. What do you do?", options: ["Text them quickly", "Write it down and do it on your break", "End the block early"], answer: 1, explain: "Parking the thought on paper protects your focus." },
      { q: "What makes a good break?", options: ["Scrolling social media", "Standing up, moving and getting water", "Starting a different assignment"], answer: 1, explain: "Moving rests your brain; scrolling keeps it busy." },
    ],
    projects: [
      { band: "8-9", title: "Three focus blocks", steps: ["Use the timer on this page for 3 homework sessions this week.", "Keep your phone in another room each time.", "Write down how much you finished in each block."] },
      { band: "10-12", title: "Track your focus", steps: ["Do at least 6 focus blocks this week.", "Note your best time of day and best place to work.", "Plan next week's study time around what you found."] },
    ],
  },
  {
    id: "plan-your-week",
    emoji: "🗓️",
    title: "Plan your week and big projects",
    minutes: 6,
    summary: "A 10-minute plan on Sunday prevents most last-minute panics.",
    why: "Most missing assignments come from losing track, not from not knowing how. Seeing the whole week, and breaking big projects into small dated steps, keeps work from piling up.",
    steps: [
      { title: "Collect everything", body: "On Sunday, check every class's portal or planner and list what's due this week and what tests are coming." },
      { title: "Block your time", body: "Mark when you're busy (practice, work, family) and choose study times in the gaps." },
      { title: "Plan backward for big projects", body: "Start from the due date and list the steps: research, outline, draft, revise. Give each step its own date." },
      { title: "Check daily", body: "Each evening, take two minutes to tick off what's done and move anything you missed." },
    ],
    tool: "week-planner",
    checks: [
      { q: "A research paper is due in 3 weeks. What's the best first move?", options: ["Wait until the week before", "Break it into steps and put a date on each", "Write the whole thing this weekend"], answer: 1, explain: "Backward planning turns one scary deadline into small, doable steps." },
      { q: "When is a good time to plan your week?", options: ["Sunday, for about 10 minutes", "Only when something is late", "Never; just go day by day"], answer: 0, explain: "A short weekly plan catches deadlines before they surprise you." },
      { q: "You missed a planned study session. What now?", options: ["Give up on the plan", "Move it to another open time this week", "Skip that subject"], answer: 1, explain: "Plans change. Move the session rather than drop it." },
    ],
    projects: [
      { band: "8-9", title: "My first weekly plan", steps: ["On Sunday, list everything due this week for every class.", "Pick a study time for each item.", "On Friday, check how many you finished on time."] },
      { band: "10-12", title: "Backward-plan a big project", steps: ["Pick your next essay, project or college application.", "List at least 5 steps from start to finish and give each a date.", "Share the plan with a parent and check in at the halfway point."] },
    ],
  },
  {
    id: "notes-that-work",
    emoji: "📝",
    title: "Take notes that work (Cornell notes)",
    minutes: 6,
    summary: "Notes are for studying later, so set them up to quiz yourself.",
    why: "Copying the board word for word doesn't help much. Notes in your own words, with questions in the margin and a short summary, turn into a ready-made study guide.",
    steps: [
      { title: "Split the page", body: "Draw a line about 2 inches from the left edge, and leave a few lines at the bottom of the page." },
      { title: "Notes on the right", body: "During class, write the main ideas in your own words. Use short phrases, not full sentences." },
      { title: "Questions on the left", body: "The same day, write a question in the left column for each chunk of notes." },
      { title: "Summary at the bottom", body: "Write 2 or 3 sentences summing up the page. To study, cover the right side and answer the questions on the left." },
    ],
    checks: [
      { q: "During class, your notes should be:", options: ["Every word the teacher says", "Main ideas in your own words", "Only what's on the slides"], answer: 1, explain: "Putting ideas in your own words helps you understand them." },
      { q: "What goes in the left column?", options: ["Doodles", "Questions about the notes", "The date only"], answer: 1, explain: "The questions let you quiz yourself later by covering the notes." },
      { q: "When should you add the questions and summary?", options: ["The same day as class", "The night before the test", "Never"], answer: 0, explain: "Doing it the same day is a quick first review while it's fresh." },
    ],
    projects: [
      { band: "8-9", title: "One week of Cornell notes", steps: ["Use Cornell notes in one class for a week.", "Add questions and a summary the same evening.", "Quiz yourself with the left column before the next quiz."] },
      { band: "10-12", title: "Compare note styles", steps: ["Use Cornell notes in your hardest class for two weeks.", "Before a test, study only by covering and answering the questions.", "Compare the result with your previous test in that class."] },
    ],
  },
  {
    id: "read-actively",
    emoji: "📖",
    title: "Read a textbook actively",
    minutes: 5,
    summary: "Preview, ask questions, then recall. Don't just let your eyes move over the page.",
    why: "It's easy to read a whole chapter and remember almost nothing. Active reading gives your brain a job: finding answers to questions you set before you start.",
    steps: [
      { title: "Preview for 2 minutes", body: "Look at the headings, bold words, pictures and end-of-chapter questions before reading." },
      { title: "Ask before you read", body: "Turn each heading into a question, like \"What were the causes of the Civil War?\"" },
      { title: "Read one section at a time", body: "Read to answer your question. Skip highlighting everything; it gives a false feeling of learning." },
      { title: "Recall and check", body: "After each section, look away and say or write the answer. Then check the page." },
    ],
    checks: [
      { q: "What should you do before reading a chapter?", options: ["Highlight the first page", "Preview headings and questions", "Read the last page first"], answer: 1, explain: "A quick preview shows you what matters, so you read with a purpose." },
      { q: "Why isn't highlighting enough?", options: ["It feels like learning but doesn't build memory", "Teachers don't allow it", "It takes too long"], answer: 0, explain: "Highlighting is passive. Recalling the answer is what helps." },
      { q: "After each section you should:", options: ["Move straight on", "Look away and recall the main point", "Reread it twice"], answer: 1, explain: "Recalling after each section is practice testing in small doses." },
    ],
    projects: [
      { band: "8-9", title: "Question-first reading", steps: ["For your next reading assignment, write 3 questions from the headings first.", "Read to answer them.", "Write the answers from memory, then check."] },
      { band: "10-12", title: "Chapter summary from memory", steps: ["Read your next chapter using preview, questions and recall.", "Close the book and write a one-page summary from memory.", "Check it and fill in what you missed in another color."] },
    ],
  },
  {
    id: "get-test-ready",
    emoji: "✅",
    title: "Get ready for a test",
    minutes: 6,
    summary: "Find out what's on it, practice like it's the real thing, and sleep.",
    why: "Many students study hard but study the wrong things or the wrong way. Knowing the format, practicing under test conditions and being rested all show up in the score.",
    steps: [
      { title: "Ask what's on it", body: "Ask the teacher what topics and question types to expect. Gather old quizzes and homework." },
      { title: "Practice like the real test", body: "Do practice problems without notes and with a time limit, then check and fix your mistakes." },
      { title: "Focus on mistakes", body: "Spend most of your time on what you got wrong, not on what you already know." },
      { title: "Sleep and eat", body: "Sleep helps lock in what you studied. An all-nighter usually costs more than it gains." },
    ],
    checks: [
      { q: "Where should most of your study time go?", options: ["Topics you already know well", "The questions you got wrong in practice", "Rewriting your notes neatly"], answer: 1, explain: "Your mistakes show exactly what still needs work." },
      { q: "The night before a big test, the best choice is usually:", options: ["Stay up all night studying", "Light review, then a full night of sleep", "No review at all"], answer: 1, explain: "Sleep helps your brain hold on to what you studied." },
      { q: "A good first step when a test is announced:", options: ["Ask the teacher what it will cover", "Hope it's easy", "Start memorizing the whole textbook"], answer: 0, explain: "Knowing the topics and format lets you study the right things." },
    ],
    projects: [
      { band: "8-9", title: "Test-ready checklist", steps: ["For your next test, ask what's on it and write the topics down.", "Do one timed practice set without notes.", "Fix every mistake and redo those problems 2 days later."] },
      { band: "10-12", title: "Mistake log", steps: ["Start a mistake log for your hardest class (problem, what went wrong, the fix).", "Add every missed question from homework and quizzes for 2 weeks.", "Use the log as your main study guide for the next test."] },
    ],
  },
  {
    id: "ask-for-help",
    emoji: "🙋",
    title: "Ask for help early",
    minutes: 4,
    summary: "Teachers want you to come to them. The earlier you ask, the easier it is to fix.",
    why: "A small gap in understanding grows as a class builds on it. Students who talk to the teacher early often turn a grade around in a few weeks, and teachers notice and remember the effort.",
    steps: [
      { title: "Notice the signs", body: "A lower quiz score, homework that takes much longer, or feeling lost in class are signals to ask now." },
      { title: "Bring something specific", body: "Show the problems you got stuck on and say what you tried. \"I don't get it\" is harder to help with." },
      { title: "Ask about missing work", body: "Ask which assignments can still be turned in, and whether there's any way to show you've learned it." },
      { title: "Use every option", body: "Tutoring at school, study groups, office hours and trusted videos all count. Asking is a skill, not a weakness." },
    ],
    checks: [
      { q: "When is the best time to ask a teacher for help?", options: ["As soon as you feel lost", "After the report card comes out", "Only if a parent makes you"], answer: 0, explain: "Early questions fix small gaps before they grow." },
      { q: "Which request is easiest for a teacher to help with?", options: ["\"I don't get any of this.\"", "\"I got stuck on problems 4 and 7. Here's what I tried.\"", "\"Can you just give me the answers?\""], answer: 1, explain: "Specific examples show the teacher exactly where to help." },
      { q: "You have missing assignments. A good question to ask is:", options: ["\"Which of these can I still turn in?\"", "\"Do they really count?\"", "Nothing; just leave it"], answer: 0, explain: "Missing work is often the fastest grade to win back." },
    ],
    projects: [
      { band: "8-9", title: "One question this week", steps: ["Pick one class where something is confusing.", "Write down 2 specific questions or problems.", "Ask the teacher before or after class, or by email, and note what you learned."] },
      { band: "10-12", title: "Help plan for your hardest class", steps: ["Find out when your teacher or school tutoring is available.", "Go at least once this week with specific problems.", "Write down one change you'll make based on what they said."] },
    ],
  },
];

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id);
export const bandFor = (grade: number): Project["band"] => (grade <= 9 ? "8-9" : "10-12");
