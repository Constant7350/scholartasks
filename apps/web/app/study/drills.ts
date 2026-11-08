// Practice drills: each study method practiced in different subjects, because
// a method looks different in each one. Math and science are mostly
// understanding (worked problems, explain why, find the mistake); history is
// mostly memory (study a card, hide it, recall names, dates and causes).
// English drills live in drills-english.ts and stay in English on the Spanish
// screen, since they practice English words and sentences.
//
// All content is our own, written for grades 6 to 12. Free, no AI. Options are
// written with the right one first; the page mixes up the order.
import type { Check } from "./lessons";
import { ENGLISH_DRILLS } from "./drills-english";

export type Subject = "math" | "science" | "history" | "english";

export interface Drill {
  subject: Subject;
  title: string;
  /** Understanding (why and how) or memory (facts to recall). */
  kind: "understanding" | "memory";
  /** One line: how this method works in this subject. */
  how: string;
  /** A card to study. With hide, the questions come only after it is hidden. */
  study?: { title: string; lines: string[]; hide: boolean };
  /** A worked example (or a student's work with a mistake in it). */
  worked?: { title: string; problem: string; steps: string[] };
  checks: Check[];
  /** Write it in your own words, then compare with a model answer. */
  explain?: { question: string; answer: string };
  /** The same method with the student's own class work. */
  yourTurn: string;
}

const c = (q: string, options: string[], explain: string): Check => ({ q, options, answer: 0, explain });

// A key starting with "ask" reads as AI instructions to the Spanish line finder,
// so this lesson's key is computed.
const ASK_FOR_HELP = "ask-for-help";

const OTHER: Record<string, Drill[]> = {
  "test-yourself": [
    {
      subject: "math", kind: "understanding",
      title: "Solve it from a blank page",
      how: "In math, testing yourself means solving problems without looking at the example, then explaining why each step works.",
      worked: { title: "Worked example", problem: "Solve 3x + 5 = 20.", steps: ["Subtract 5 from both sides: 3x = 15.", "Divide both sides by 3: x = 5.", "Check it: 3 × 5 + 5 = 20. ✓"] },
      checks: [
        c("Now without looking back: solve 4x − 7 = 13.", ["x = 5", "x = 1.5", "x = 6"], "Add 7 to both sides to get 4x = 20, then divide by 4."),
        c("Why do you add 7 to both sides, not just one?", ["To keep both sides equal", "Because 7 is the biggest number", "It doesn't matter which side"], "An equation is a balance. Whatever you do to one side, you do to the other."),
        c("Solve 2(x + 3) = 18.", ["x = 6", "x = 7.5", "x = 12"], "Divide both sides by 2 to get x + 3 = 9, then subtract 3."),
      ],
      explain: { question: "In one or two sentences, explain how you can check any answer to an equation.", answer: "Put your answer in place of x in the original equation. If both sides come out equal, it's right." },
      yourTurn: "Pick 3 problems from your last math homework, cover the answers and solve them on a blank page.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Explain the process, not just the words",
      how: "In science, test yourself on how and why things happen, not only on the vocabulary words.",
      study: { title: "Photosynthesis", hide: true, lines: [
        "Plants take in carbon dioxide from the air and water from the soil.",
        "Using energy from sunlight, they make glucose, a sugar they use as food.",
        "Oxygen is given off as a by-product.",
        "This happens in the chloroplasts, mostly in the leaves.",
      ] },
      checks: [
        c("What three things does a plant need for photosynthesis?", ["Carbon dioxide, water and sunlight", "Oxygen, soil and sugar", "Nitrogen, water and heat"], "Carbon dioxide and water are the raw materials; sunlight supplies the energy."),
        c("A plant sits in a dark closet for a week. What happens to its food-making?", ["It slows down or stops, because there is no light energy", "It speeds up", "Nothing changes"], "Without light, the plant has no energy to make glucose."),
        c("Where does the oxygen that plants give off come from?", ["It is released while the plant makes glucose", "Plants store it from the air", "It comes up from the soil"], "Oxygen is a by-product of photosynthesis."),
      ],
      explain: { question: "Explain why forests matter for the air we breathe.", answer: "Trees take in carbon dioxide and give off oxygen while they make food, so forests add oxygen to the air and remove carbon dioxide." },
      yourTurn: "Pick one process from your science notes and explain it out loud, step by step, without looking.",
    },
    {
      subject: "history", kind: "memory",
      title: "Recall the facts, then check",
      how: "History has more to remember: names, dates and causes. Study a short card, hide it, then pull the facts from memory.",
      study: { title: "The Louisiana Purchase (1803)", hide: true, lines: [
        "In 1803 the United States bought the Louisiana Territory from France.",
        "President Thomas Jefferson made the deal. Napoleon sold it partly to raise money for war in Europe.",
        "The price was about $15 million, roughly 3 cents an acre.",
        "It about doubled the size of the country.",
        "Lewis and Clark set out in 1804 to explore the new land.",
      ] },
      checks: [
        c("Which country sold the Louisiana Territory?", ["France", "Spain", "Britain"], "France, led by Napoleon, sold it in 1803."),
        c("Who was president when the deal was made?", ["Thomas Jefferson", "George Washington", "Abraham Lincoln"], "Jefferson made the purchase."),
        c("What was one big result?", ["The country about doubled in size", "The Civil War ended", "Texas joined the United States"], "The new land about doubled the size of the United States."),
      ],
      yourTurn: "Turn one page of history notes into 5 questions, cover the notes and answer them out loud.",
    },
  ],

  "space-it-out": [
    {
      subject: "math", kind: "understanding",
      title: "Mixed review: pick the right tool",
      how: "Mixing different kinds of problems makes you decide which method to use, the same skill a real test asks for. Come back to a mixed set every few days.",
      checks: [
        c("A $40 shirt is 25% off. What is the sale price?", ["$30", "$10", "$35"], "25% of $40 is $10, and $40 − $10 = $30."),
        c("What is 3/4 + 1/8?", ["7/8", "4/12", "1/2"], "Change 3/4 to 6/8, then 6/8 + 1/8 = 7/8."),
        c("A rectangle is 6 cm long and 4 cm wide. What is its area?", ["24 cm²", "20 cm²", "10 cm²"], "Area is length times width: 6 × 4."),
      ],
      explain: { question: "Which problem was hardest to start, and how did you decide what to do?", answer: "Spotting the problem type is the skill: \"% off\" means find the percent and subtract, adding fractions needs the same bottom number, and area means multiply." },
      yourTurn: "Each week, mix 2 or 3 problems from older units into your math practice.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Mixed review across units",
      how: "Science units build on each other. Short mixed reviews of older units keep them from fading before the final.",
      checks: [
        c("Which of these is a chemical change?", ["Wood burning", "Ice melting", "Salt dissolving in water"], "Burning makes new substances, like ash and smoke. Melting and dissolving don't."),
        c("What is the main job of red blood cells?", ["Carry oxygen around the body", "Fight germs", "Digest food"], "Red blood cells carry oxygen from the lungs to the rest of the body."),
        c("Why does Earth have seasons?", ["Earth's axis is tilted", "Earth gets much closer to the sun in summer", "The sun gets hotter in summer"], "The tilt changes how directly sunlight hits each half of Earth during the year."),
      ],
      yourTurn: "Before each science quiz, add 3 questions from an older unit to your review.",
    },
    {
      subject: "history", kind: "memory",
      title: "Put it in order (timeline review)",
      how: "Timelines help history stick. Review the order of events again on spaced days, and it lasts until the final.",
      study: { title: "Early America timeline", hide: true, lines: [
        "Jamestown is founded in Virginia (1607).",
        "The Declaration of Independence is signed (1776).",
        "The Constitution is written (1787).",
        "The Louisiana Purchase (1803).",
        "The Civil War begins (1861).",
      ] },
      checks: [
        c("Which came first?", ["The Declaration of Independence", "The Constitution", "The Louisiana Purchase"], "The Declaration (1776) came before the Constitution (1787) and the Louisiana Purchase (1803)."),
        c("About how many years after the Declaration was the Constitution written?", ["About 11 years", "About 50 years", "The same year"], "From 1776 to 1787 is 11 years."),
        c("Which event happened most recently?", ["The Civil War begins", "Jamestown is founded", "The Constitution is written"], "The Civil War began in 1861, the latest date on the card."),
      ],
      yourTurn: "Make a timeline of your current history unit and review it today, in 2 days and in a week.",
    },
  ],

  "focus-sessions": [
    {
      subject: "math", kind: "understanding",
      title: "Focus round: mental math",
      how: "Math needs steady focus: one slip in one step changes the answer. Do this round in one go, phone away.",
      checks: [
        c("What is 15 × 4?", ["60", "45", "54"], "Split it: 10 × 4 = 40 and 5 × 4 = 20, so 60."),
        c("What is 10% of 250?", ["25", "2.5", "250"], "To find 10%, move the decimal point one place to the left."),
        c("A recipe uses 3 eggs for 12 cookies. How many eggs for 36 cookies?", ["9", "6", "12"], "That's 3 times as many cookies, so use 3 times as many eggs."),
      ],
      yourTurn: "Start a 25-minute focus block with only math homework, phone in another room.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Focus round: read the experiment",
      how: "Science questions hide details in units and in what was changed. Read the card once with full focus, then answer.",
      study: { title: "Plant growth experiment", hide: false, lines: [
        "Plant A (full sun): grew 12 cm in two weeks.",
        "Plant B (half shade): grew 7 cm in two weeks.",
        "Plant C (dark closet): grew 1 cm and turned yellow.",
        "All three plants got the same water and the same soil.",
      ] },
      checks: [
        c("What was changed on purpose in this experiment?", ["The amount of light", "The amount of water", "The type of soil"], "Light was the only thing changed on purpose. Water and soil stayed the same."),
        c("Why did every plant get the same water and soil?", ["So light is the only thing that could explain the difference", "To save water", "It doesn't matter"], "Keeping everything else the same makes it a fair test."),
        c("What can you conclude?", ["More light led to more growth", "Plants don't need light", "Soil matters most"], "Growth went down as light went down."),
      ],
      yourTurn: "Do one focus block on a lab report or science reading, phone in another room.",
    },
    {
      subject: "history", kind: "memory",
      title: "Focus round: one careful read",
      how: "History reading means keeping track of who, when, cause and effect. One focused read beats three distracted ones.",
      study: { title: "The Erie Canal", hide: true, lines: [
        "The Erie Canal opened in 1825. It linked the Hudson River to Lake Erie.",
        "Before the canal, moving goods by wagon from Buffalo to New York City was slow and expensive.",
        "After it opened, shipping costs fell sharply and trips took far less time.",
        "New York City grew into the country's busiest port.",
      ] },
      checks: [
        c("What did the Erie Canal connect?", ["The Hudson River and Lake Erie", "The Atlantic and the Pacific", "Chicago and New Orleans"], "It linked the Hudson River to Lake Erie, and so the Great Lakes to New York City."),
        c("What was the main effect on trade?", ["Moving goods got cheaper and faster", "Trade stopped", "Wagons became more popular"], "Shipping costs fell sharply and trips got much shorter."),
        c("Which city grew the most because of it?", ["New York City", "Boston", "Philadelphia"], "New York City became the country's busiest port."),
      ],
      yourTurn: "Read your next history assignment in one focus block, then write the who, when and why from memory.",
    },
  ],

  "plan-your-week": [
    {
      subject: "math", kind: "understanding",
      title: "Plan backward for a math test",
      how: "Math builds step by step, so plan practice that starts with the earliest skill in the unit and ends with a mixed practice test.",
      checks: [
        c("Your math test is in 6 days and covers 3 sections. Which plan is best?", ["One section a day, then a mixed practice test, then fix mistakes", "All 3 sections the night before", "Only the newest section"], "Spreading it out and ending with a mixed test shows you what still needs work."),
        c("You have 30 practice problems and 5 days. How many a day keeps it even?", ["6", "5", "10"], "Divide 30 by 5."),
        c("Why practice the earliest section first?", ["Later sections usually build on it", "It's always the easiest", "Teachers always test it most"], "In math, new skills usually rest on older ones."),
      ],
      yourTurn: "List the sections on your next math test and give each its own practice day.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Break up a science project",
      how: "Science projects have steps that must happen in order: you can't study results before the experiment has run.",
      checks: [
        c("Which step comes first?", ["Ask a question and make a hypothesis", "Write the conclusion", "Make the display board"], "Everything else depends on the question you're testing."),
        c("Your plants need 2 weeks to grow and the fair is in 3 weeks. When should the experiment start?", ["This week", "The week before the fair", "The night before"], "Growing takes 2 weeks, which leaves a week to study the results and build the display."),
        c("What comes right after collecting the data?", ["Studying it and making a graph", "Choosing a new topic", "Buying supplies"], "Data turns into a conclusion once you organize and graph it."),
      ],
      yourTurn: "For your next science project or lab report, write each step with a date beside it.",
    },
    {
      subject: "history", kind: "memory",
      title: "Plan a history paper",
      how: "History papers need research time: finding sources, taking notes and checking facts, all before you write.",
      checks: [
        c("A history paper is due in 3 weeks. What goes first on your plan?", ["Find and read 3 good sources", "Write the final draft", "Make the cover page"], "You need facts before you can write about them."),
        c("How should you keep track of where each fact came from?", ["Write the source next to each note", "Try to remember it", "Look it up again later"], "Noting the source as you go saves hours when you write citations."),
        c("What's a good last step before the due date?", ["Revise, and check facts, dates and spelling", "Start researching", "Pick a topic"], "Leave time at the end to check and polish."),
      ],
      yourTurn: "Backward-plan your next history assignment: sources, notes, outline, draft, revise, each with a date.",
    },
  ],

  "notes-that-work": [
    {
      subject: "math", kind: "understanding",
      title: "Cornell notes for math",
      how: "In math notes, write a worked example on the right and the \"why\" for each step as a question on the left.",
      study: { title: "Notes: finding slope", hide: false, lines: [
        "Slope = rise over run = change in y ÷ change in x.",
        "Example: points (1, 2) and (3, 8). Change in y = 8 − 2 = 6. Change in x = 3 − 1 = 2.",
        "Slope = 6 ÷ 2 = 3.",
        "A positive slope goes up to the right; a negative slope goes down.",
      ] },
      checks: [
        c("Which is the best left-column question for these notes?", ["How do I find the slope between two points?", "What page is this?", "Slope"], "A how or why question lets you quiz yourself later."),
        c("Use the notes: what's the slope between (0, 1) and (2, 5)?", ["2", "4", "3"], "Change in y is 4 and change in x is 2, and 4 ÷ 2 = 2."),
        c("Which summary fits best?", ["Slope tells how steep a line is: change in y divided by change in x.", "Lines are straight.", "Points have two numbers."], "A good summary says the main idea and how to use it."),
      ],
      yourTurn: "In your next math notes, write a \"why\" question beside each worked example.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Cornell notes for science",
      how: "In science notes, write each stage of a process in your own words, then quiz yourself on what causes each one.",
      study: { title: "Notes: the water cycle", hide: true, lines: [
        "Evaporation: the sun heats water and it turns into vapor.",
        "Condensation: the vapor cools and forms clouds.",
        "Precipitation: water falls as rain, snow, sleet or hail.",
        "Collection: water gathers in oceans, lakes and underground, and the cycle starts again.",
      ] },
      checks: [
        c("Which left-column question fits these notes best?", ["What happens at each stage of the water cycle?", "Clouds?", "Who discovered rain?"], "It covers the whole page and you can answer it from memory."),
        c("Which stage turns water vapor into clouds?", ["Condensation", "Evaporation", "Collection"], "Vapor cools and condenses into the droplets that make clouds."),
        c("Which summary is best?", ["Water moves in a loop: it evaporates, condenses into clouds, falls and collects, then starts again.", "Rain is wet.", "The ocean is big."], "It names every stage in order."),
      ],
      yourTurn: "Use Cornell notes in your next science class, with one \"what causes it\" question for each chunk.",
    },
    {
      subject: "history", kind: "memory",
      title: "Cornell notes for history",
      how: "History notes work best with cause-and-effect questions in the left column, because that's what tests ask.",
      study: { title: "Notes: causes of the American Revolution", hide: true, lines: [
        "Britain taxed the colonies to pay for the French and Indian War (Stamp Act 1765, Tea Act 1773).",
        "Colonists had no vote in Parliament: \"No taxation without representation.\"",
        "At the Boston Tea Party (1773), colonists dumped British tea into Boston Harbor.",
        "Britain punished Boston with harsh laws, and fighting began in 1775.",
      ] },
      checks: [
        c("Which left-column question helps most on a test?", ["Why did the colonists turn against Britain?", "What color was the tea?", "How do you spell Parliament?"], "Cause-and-effect questions are what history tests ask most."),
        c("Why did Britain tax the colonies?", ["To pay for the French and Indian War", "To build schools", "To punish France"], "The war left Britain with large debts."),
        c("What did \"No taxation without representation\" mean?", ["Colonists didn't want taxes from a government they couldn't vote in", "Nobody should ever pay taxes", "Only Britain should pay taxes"], "The colonists had no members in Parliament, which set their taxes."),
      ],
      yourTurn: "For your next history notes, write one \"why\" or \"what happened because of it\" question for each chunk.",
    },
  ],

  "read-actively": [
    {
      subject: "math", kind: "understanding",
      title: "Read a math example with a pencil",
      how: "Math textbooks are read with a pencil: cover each step of an example and try to predict it before you look.",
      worked: { title: "Worked example", problem: "A phone plan costs $20 a month plus $5 for each gigabyte of data. What does 3 gigabytes cost in one month?", steps: ["Write the rule: cost = 20 + 5 × gigabytes.", "Put in 3: cost = 20 + 5 × 3.", "Multiply first, then add: 20 + 15 = $35."] },
      checks: [
        c("Using the same plan, what do 6 gigabytes cost?", ["$50", "$30", "$26"], "Multiply first: 5 × 6 = 30, then add the $20."),
        c("Why do you multiply before adding?", ["Order of operations: multiplication comes before addition", "Because 5 is smaller than 20", "You can do it in any order"], "Adding first would give 25 × 3 = 75, which is wrong."),
        c("Which question should you ask before reading an example like this?", ["What does each number in the rule stand for?", "How long is this chapter?", "Is there a picture?"], "Knowing what each number means is the key to the whole example."),
      ],
      yourTurn: "In your math book, cover the steps of the next example and predict each one before you look.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Preview, ask, read, recall",
      how: "Science reading is full of new ideas that connect. Turn the heading into a question first, then read to answer it.",
      study: { title: "Food chains", hide: true, lines: [
        "Producers, like grass and algae, make their own food from sunlight.",
        "Consumers eat other living things: herbivores eat plants and carnivores eat animals.",
        "Decomposers, like fungi and bacteria, break down dead things and return nutrients to the soil.",
        "Energy passes up the chain, but most of it is used up at each step, so there are fewer animals at the top.",
      ] },
      checks: [
        c("Before reading, which question fits the heading \"Food chains\"?", ["How does energy move from one living thing to another?", "What's for dinner?", "How long is a chain?"], "A good question tells you what to look for as you read."),
        c("Which of these is a producer?", ["Grass", "A hawk", "A mushroom"], "Grass makes its own food from sunlight. A mushroom is a decomposer."),
        c("Why are there fewer hawks than mice?", ["Most energy is used up at each step up the chain", "Hawks are shy", "Mice eat hawks"], "Less energy reaches the top of the chain, so it supports fewer animals."),
      ],
      yourTurn: "Before your next science reading, write a question for each heading, then answer them from memory.",
    },
    {
      subject: "history", kind: "memory",
      title: "Turn headings into questions",
      how: "In history, a question from the heading gives you something to remember: a cause, a result or a person.",
      study: { title: "The Great Depression", hide: true, lines: [
        "The stock market crashed in October 1929.",
        "Banks failed, and many families lost their savings.",
        "By 1933, about one in four workers had no job.",
        "President Franklin D. Roosevelt's New Deal created jobs and programs such as Social Security.",
      ] },
      checks: [
        c("Which question would you write from this heading before reading?", ["What caused the Great Depression, and how did the country recover?", "Who wrote this book?", "How many pages are left?"], "Cause and recovery are what the section explains."),
        c("By 1933, about how many workers had no job?", ["About one in four", "About one in a hundred", "Almost all of them"], "Roughly a quarter of workers were unemployed."),
        c("What was the New Deal?", ["Roosevelt's programs to create jobs and help people", "A trade deal with Britain", "The stock market crash"], "It included jobs programs and Social Security."),
      ],
      yourTurn: "Turn the headings of your next history chapter into questions and answer them from memory after each section.",
    },
  ],

  "get-test-ready": [
    {
      subject: "math", kind: "understanding",
      title: "Find the mistake",
      how: "On math tests, most lost points come from a few repeat mistakes. Finding the exact wrong step is how you stop making it.",
      worked: { title: "A student's work (it has one mistake)", problem: "Solve 5 − 2(x + 1) = 9.", steps: ["Step 1: 5 − 2x + 2 = 9", "Step 2: 7 − 2x = 9", "Step 3: −2x = 2, so x = −1"] },
      checks: [
        c("Which step has the mistake?", ["Step 1", "Step 2", "Step 3"], "−2 times +1 is −2, not +2. The line should be 5 − 2x − 2 = 9."),
        c("What is the right answer?", ["x = −3", "x = −1", "x = 3"], "Combine 5 − 2 to get 3 − 2x = 9, then −2x = 6, so x = −3."),
        c("What should go in your mistake log?", ["The problem, the wrong step and the fix: multiply the minus sign into every term", "Just the score", "Nothing; it was only one mistake"], "Writing the exact fix is what keeps the mistake from coming back."),
      ],
      explain: { question: "How could the student have caught this mistake before turning it in?", answer: "By checking: put x = −1 back into 5 − 2(x + 1). That gives 5, not 9, so something was wrong." },
      yourTurn: "Start a mistake log for math: for each missed problem, write the wrong step and the fix.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Find the mistake (check the units)",
      how: "In science, units are a built-in check. If the units don't make sense, the formula is probably wrong.",
      worked: { title: "A student's work (it has one mistake)", problem: "A car travels 120 km in 2 hours. What is its speed?", steps: ["Speed = distance × time", "Speed = 120 × 2 = 240 km/h"] },
      checks: [
        c("What went wrong?", ["They used the wrong formula: speed is distance ÷ time", "They multiplied wrong", "Nothing; it's right"], "Speed is how far you go in each hour, so divide distance by time."),
        c("What is the right speed?", ["60 km/h", "240 km/h", "122 km/h"], "Divide: 120 km ÷ 2 hours = 60 km per hour."),
        c("Which check would have caught the mistake?", ["Check the units: km × hours isn't a speed, but km ÷ hours is", "Write the answer bigger", "Leave the units off"], "Units tell you whether the formula makes sense."),
      ],
      explain: { question: "Why do units help you catch mistakes in science?", answer: "Units show whether a formula makes sense. Kilometers divided by hours gives kilometers per hour, a speed; kilometers times hours isn't a speed at all." },
      yourTurn: "On your next science homework, check the units on every answer before you turn it in.",
    },
    {
      subject: "history", kind: "memory",
      title: "Find the mistake in an answer",
      how: "History mistakes are often mix-ups between events. A list of the dates and causes you confuse is the fastest fix.",
      worked: { title: "A student's short answer (it has a mistake)", problem: "Question: Why did the Civil War begin?", steps: ["Answer: \"The Civil War began in 1776 because the colonies wanted freedom from Britain.\""] },
      checks: [
        c("What's the mistake?", ["They mixed it up with the American Revolution", "The spelling", "It's too short"], "1776 and freedom from Britain belong to the American Revolution."),
        c("When did the Civil War begin?", ["1861", "1776", "1812"], "The Civil War began in 1861."),
        c("Which answer is stronger?", ["It began in 1861 after Southern states left the Union, mainly over slavery and its spread west.", "It began because people were angry.", "It was a long time ago."], "It gives the date and the main cause."),
      ],
      yourTurn: "Before your next history test, list any events or dates you mix up and quiz yourself on just those.",
    },
  ],

  [ASK_FOR_HELP]: [
    {
      subject: "math", kind: "understanding",
      title: "Ask about the exact step",
      how: "In math, show the exact step where you got stuck. A teacher can fix one step in a minute.",
      checks: [
        c("Which question helps your math teacher most?", ["\"On problem 6 I got 3x = 12, but I'm not sure what to do next.\"", "\"I don't get equations.\"", "\"Can you just do problem 6?\""], "It shows exactly where you are stuck and what you tried."),
        c("You missed most of a fractions quiz. What should you bring?", ["The quiz, with the problems you missed and what you tried", "Nothing", "A note from a friend"], "Your work shows the teacher where the gap is."),
        c("When should you ask?", ["As soon as you hit problems you can't start", "After the unit test", "Next semester"], "Math builds on itself, so small gaps grow fast."),
      ],
      yourTurn: "Mark one math problem you couldn't finish this week and ask your teacher about that exact step.",
    },
    {
      subject: "science", kind: "understanding",
      title: "Say what you think happens",
      how: "In science, say which idea or lab step confuses you, and what you think happens. That shows where the gap is.",
      checks: [
        c("Which question is best?", ["\"I know plants need light, but I don't see why the plant in the dark turned yellow.\"", "\"Science is hard.\"", "\"What's the answer to the lab?\""], "It says what you know and the exact part you don't."),
        c("A graph in the lab confuses you. What helps most?", ["Point to the confusing part and say what you think it shows", "Copy a friend's answer", "Leave it blank"], "Saying your guess lets the teacher fix the exact idea."),
        c("Your teacher answers with a question: \"What do you think happens?\" Why?", ["To help you think it through yourself", "They don't know", "They're annoyed"], "Good teachers guide you to the answer so you understand it."),
      ],
      yourTurn: "Write down one science idea you're unsure about and what you think is true, and ask your teacher this week.",
    },
    {
      subject: "history", kind: "memory",
      title: "Ask about the connection",
      how: "In history, ask about connections: why one event led to another, or how two events differ.",
      checks: [
        c("Which question is best?", ["\"I know the dates, but I don't see how the Stamp Act led to the Revolution.\"", "\"Is this on the test?\"", "\"Can I have the study guide answers?\""], "It asks about the cause and effect, which is what you need to understand."),
        c("You keep mixing up two events. What helps?", ["Ask the teacher about the difference, then make a two-column comparison", "Hope only one is on the test", "Memorize just one of them"], "A side-by-side comparison makes the difference stick."),
        c("Where can you check a history fact?", ["Your textbook, or a trusted library or museum website", "A random comment online", "A friend's guess"], "Trusted sources are checked by experts."),
      ],
      yourTurn: "Write one \"how did this lead to that?\" question about your current history unit and ask it in class.",
    },
  ],
};

/** Drills for a lesson, in the order math, science, history, English. */
export function drillsFor(lessonId: string): Drill[] {
  return [...(OTHER[lessonId] ?? []), ...(ENGLISH_DRILLS[lessonId] ?? [])];
}

export const SUBJECTS: { id: Subject; icon: string; label: string }[] = [
  { id: "math", icon: "🔢", label: "Math" },
  { id: "science", icon: "🔬", label: "Science" },
  { id: "history", icon: "🏛️", label: "History" },
  { id: "english", icon: "📚", label: "English" },
];
