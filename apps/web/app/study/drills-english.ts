// i18n-skip
// English class drills. They practice English words, sentences and reading,
// so they stay in English on the Spanish screen (the page marks them
// translate="no"). Same shape as drills.ts; the right option is written first.
import type { Check } from "./lessons";
import type { Drill } from "./drills";

const c = (q: string, options: string[], explain: string): Check => ({ q, options, answer: 0, explain });

export const ENGLISH_DRILLS: Record<string, Drill[]> = {
  "test-yourself": [{
    subject: "english", kind: "memory",
    title: "Word parts flashcards",
    how: "Vocabulary is memory work. Learn a word part once and you can figure out many new words.",
    study: { title: "Common word roots", hide: true, lines: [
      "bio = life (biology)",
      "graph = write (autograph)",
      "port = carry (transport)",
      "dict = say (predict)",
      "tele = far (telephone)",
    ] },
    checks: [
      c("What does \"portable\" most likely mean?", ["Able to be carried", "Able to be written", "Very far away"], "port = carry."),
      c("A \"biography\" is:", ["The written story of a person's life", "A science experiment", "A long phone call"], "bio (life) + graph (write)."),
      c("To \"dictate\" means to:", ["Say words aloud for someone to write down", "Carry something far", "Study living things"], "dict = say."),
    ],
    yourTurn: "Make 5 flashcards from this week's vocabulary. Say the meaning out loud before you flip each card.",
  }],
  "space-it-out": [{
    subject: "english", kind: "memory",
    title: "Vocabulary review round",
    how: "Words you review on spaced days stay with you. Do this round today, again in 2 days and again next week.",
    checks: [
      c("\"She was reluctant to jump into the cold lake.\" Reluctant means:", ["Unwilling or hesitant", "Excited", "Fast"], "The cold lake is the clue: she didn't want to jump."),
      c("\"The garden had an abundant crop of tomatoes.\" Abundant means:", ["Plentiful", "Very small", "Rotten"], "Abundant means more than enough."),
      c("\"Keep your answer concise.\" Concise means:", ["Short and clear", "Long and detailed", "Funny"], "A concise answer uses few words but says it all."),
    ],
    yourTurn: "Keep a list of new words. Review it the next day, a few days later and a week later.",
  }],
  "focus-sessions": [{
    subject: "english", kind: "understanding",
    title: "Focus round: fix the sentences",
    how: "Editing needs a slow, focused eye. Read each sentence word by word, phone away.",
    checks: [
      c("Which sentence is correct?", ["They're going to the game tonight.", "Their going to the game tonight.", "There going to the game tonight."], "They're = they are."),
      c("Which sentence is correct?", ["The dog wagged its tail.", "The dog wagged it's tail.", "The dog wagged its' tail."], "Its = belonging to it. It's = it is."),
      c("Which one is a complete sentence?", ["The bus was late, so we walked.", "Because the bus was late.", "Running to the bus stop."], "It has a subject, a verb and a complete thought."),
    ],
    yourTurn: "Proofread your next essay in one focus block, reading it out loud sentence by sentence.",
  }],
  "plan-your-week": [{
    subject: "english", kind: "understanding",
    title: "Plan a class novel",
    how: "A book for class goes best a little every day, with time left to review before the test or essay.",
    checks: [
      c("A 240-page book is due in 12 days. How many pages a day?", ["20", "24", "12"], "240 ÷ 12 = 20."),
      c("You fell 2 days behind. What's the best fix?", ["Add a few extra pages to each of the next days", "Skip to the end", "Read only a summary"], "Small catch-ups keep you on track without cramming."),
      c("Why read a little each day instead of all at once?", ["You remember the story and details better", "It's a rule", "The book gets shorter"], "Spaced reading helps you remember characters and events."),
    ],
    yourTurn: "Divide your next class book into daily pages and write them in your planner.",
  }],
  "notes-that-work": [{
    subject: "english", kind: "understanding",
    title: "Cornell notes for literature",
    how: "In English notes, write the idea on the right and a question that asks for evidence on the left.",
    study: { title: "Notes: reading a story", hide: true, lines: [
      "Theme: the message about life that a story shows, often without saying it directly.",
      "Conflict: the problem the main character faces.",
      "Character change: how the main character is different by the end.",
      "Evidence: a quote or detail from the text that supports your idea.",
    ] },
    checks: [
      c("Which left-column question is best?", ["How is a theme different from a topic?", "Theme", "What day was class?"], "A real question makes you explain, not just name."),
      c("A boy learns to share after he loses a friend. A likely theme is:", ["Friendship matters more than things", "A boy", "Toys"], "A theme is a message about life, not a person or object."),
      c("Which one is evidence?", ["A quote from the story", "Your opinion with no example", "The price of the book"], "Evidence comes from the text itself."),
    ],
    yourTurn: "While reading your next class book, note one quote per chapter that shows a theme.",
  }],
  "read-actively": [{
    subject: "english", kind: "understanding",
    title: "Read a short passage actively",
    how: "In English, read for the character's problem and change. Read the card, hide it, then answer.",
    study: { title: "The recital", hide: true, lines: [
      "Maya had practiced the piano piece for weeks, but at the recital her hands shook.",
      "She missed the first note and heard someone in the front row whisper.",
      "She took a breath, started the line again and played to the end.",
      "Afterward, her teacher said the restart was the bravest part of the night.",
    ] },
    checks: [
      c("What is Maya's main problem?", ["Nerves at her recital", "She lost her piano", "She forgot to come"], "Her shaking hands and the missed note show her nerves."),
      c("What does the teacher's comment suggest?", ["Recovering from a mistake takes courage", "Maya should quit", "The audience was rude"], "The teacher praises how she kept going."),
      c("Which detail shows Maya was nervous?", ["Her hands shook", "She practiced for weeks", "Her teacher spoke afterward"], "Shaking hands are a sign of nerves."),
    ],
    yourTurn: "After each chapter of your class book, write the main character's problem and any change from memory.",
  }],
  "get-test-ready": [{
    subject: "english", kind: "understanding",
    title: "Find the mistake in an essay answer",
    how: "On English tests, many points are lost by answering a different question than the one asked.",
    worked: { title: "A student's answer (it has a mistake)", problem: "Prompt: Explain how the main character changes. Use one quote.", steps: ["Answer: \"The story is about a girl named Rosa who moves to a new town. She goes to school and meets people. Then the story ends.\""] },
    checks: [
      c("What's the biggest problem?", ["It retells the plot instead of explaining a change", "It's too long", "It uses a name"], "The prompt asked how she changes, not what happens."),
      c("What did the prompt ask for that is missing?", ["A quote from the story", "A title", "A rhyme"], "The prompt asked for one quote as evidence."),
      c("What's the best first step on a written test question?", ["Underline what the prompt asks you to do", "Start writing right away", "Write as much as possible"], "Underlining the task keeps you on track."),
    ],
    yourTurn: "On your next English test, underline the task words in each prompt before you write.",
  }],
  "ask-for-help": [{
    subject: "english", kind: "understanding",
    title: "Ask about one part of your draft",
    how: "In English, bring your draft and ask about one specific part. Teachers can help most with a clear question.",
    checks: [
      c("Which question is best?", ["\"Does my second paragraph support my thesis?\"", "\"Is my essay good?\"", "\"Can you write my introduction?\""], "It points to one part and one goal."),
      c("Your teacher wrote \"needs evidence\" on your essay. What do you ask?", ["\"Which of my points needs a quote, and where should it go?\"", "\"What does evidence mean?\"", "Nothing; just ignore it"], "It turns the comment into a clear next step."),
      c("When is the best time to ask about an essay?", ["While you're drafting, before it's due", "After it's graded", "Never"], "Feedback helps most while you can still change the essay."),
    ],
    yourTurn: "Bring your next draft to your teacher with one specific question about it.",
  }],
};
