// Career interest quiz: a long, research-based interest and work-values inventory.
//
// How it works (see docs in the help guide and the PR that added it):
// - Six interest types from John Holland's RIASEC model, the model the U.S. Labor Department's
//   O*NET Interest Profiler uses: Building (Realistic), Thinking (Investigative), Creating (Artistic),
//   Helping (Social), Persuading (Enterprising) and Organizing (Conventional).
// - Six work values from O*NET's Work Importance research: Achievement, Independence, Recognition,
//   Relationships, Support and Working conditions.
// - Every question is an original activity written for ScholarTasks (no test company's items).
// - The bank is much larger than one sitting. Each sitting draws a new balanced mix in a new order,
//   so two friends (or the same student twice) never get the same quiz and can't copy an outcome.
// - Answers are likes and dislikes, not right or wrong. Nothing here measures intelligence, grades
//   or test scores, and the quiz never asks or uses race, ethnicity, sex or gender. Items were written
//   to avoid stereotypes, the same goal O*NET set when it dropped items that men and women (or
//   different racial and ethnic groups) answered very differently.

import { CAREERS, FIELDS, type Career } from "./majors";
import { CAREER_TAGS, CAREER_INTERESTS } from "./application";
import type { Trade } from "./trades";

export const RIASEC = ["R", "I", "A", "S", "E", "C"] as const;
export type InterestType = (typeof RIASEC)[number];

/** Plain-word names and descriptions for each interest type. */
export const INTEREST_TYPES: Record<InterestType, { name: string; formal: string; icon: string; about: string }> = {
  R: { name: "Building and doing", formal: "Realistic", icon: "🔧", about: "You like hands-on work with tools, machines, animals, plants or the outdoors, where you can see what you made or fixed." },
  I: { name: "Thinking and discovering", formal: "Investigative", icon: "🔬", about: "You like figuring out how things work: science, research, puzzles, data and finding answers to hard questions." },
  A: { name: "Creating", formal: "Artistic", icon: "🎨", about: "You like making something new: art, music, writing, design, film or performance, with room for your own ideas." },
  S: { name: "Helping and teaching", formal: "Social", icon: "🤝", about: "You like working with people to teach, care for, coach, heal or support them." },
  E: { name: "Leading and persuading", formal: "Enterprising", icon: "📣", about: "You like leading, selling, starting things, convincing people and making decisions." },
  C: { name: "Organizing", formal: "Conventional", icon: "🗂️", about: "You like order and detail: numbers, records, plans and making sure things are done right." },
};

export const WORK_VALUES = {
  achievement: { name: "Achievement", about: "Using your strengths and seeing real results", tip: "Look for work where you finish things you can point to: building, fixing, healing, designing or solving." },
  independence: { name: "Independence", about: "Making your own decisions and trying your own ideas", tip: "Careers where you can work on your own, set your schedule or start a business someday (many trades, design, writing and consulting) fit this." },
  recognition: { name: "Recognition", about: "Moving up, leading and being respected", tip: "Look at careers with clear steps up, such as management, law, medicine, the military, or owning a business." },
  relationships: { name: "Relationships", about: "Working with good people and helping others", tip: "Team-based and service careers fit this: teaching, health care, counseling, public safety and ministry or nonprofit work." },
  support: { name: "Support", about: "A fair boss, good training and a company that backs you up", tip: "Large employers, apprenticeships, hospitals, schools, government and the military usually offer strong training and clear rules." },
  conditions: { name: "Working conditions", about: "Good pay, a steady job, variety and time for life outside work", tip: "Compare pay, job growth and schedules on each career's page. Some high-paying jobs have long or odd hours." },
} as const;
export type WorkValue = keyof typeof WORK_VALUES;

/** Extra themes beyond the career interests, so results can be more specific. */
export const QUIZ_TAGS = {
  ...CAREER_INTERESTS,
  performing: "Music, acting, film and performing",
  sports: "Sports, fitness and coaching",
  selling: "Selling, business and starting things",
} as const;
export type QuizTag = keyof typeof QUIZ_TAGS;

export interface InterestItem { id: string; type: InterestType; text: string; tags: QuizTag[] }
export interface ValueItem { id: string; value: WorkValue; text: string }

type Row = [string, QuizTag[]];
const bank = (type: InterestType, rows: Row[]): InterestItem[] =>
  rows.map(([text, tags], i) => ({ id: `${type.toLowerCase()}${String(i + 1).padStart(2, "0")}`, type, text, tags }));

/** Every interest question: an activity the student rates from "Strongly dislike" to "Strongly like". */
export const INTEREST_ITEMS: InterestItem[] = [
  ...bank("R", [
    ["Build a bookshelf or a deck out of wood", ["hands"]],
    ["Fix a leaky faucet or a toilet that keeps running", ["hands", "precise"]],
    ["Change the oil and tires on a car", ["machines"]],
    ["Take apart a small engine to see how it works", ["machines", "hands"]],
    ["Wire a light switch or an outlet, after training", ["electric", "hands"]],
    ["Install solar panels on a roof", ["electric", "heights", "outdoors"]],
    ["Climb a tower or a utility pole to make repairs", ["heights", "outdoors", "action"]],
    ["Drive a big truck across the country", ["driving"]],
    ["Run a bulldozer or a crane at a building site", ["machines", "outdoors"]],
    ["Take care of horses, cows or other farm animals", ["animals", "outdoors"]],
    ["Plant and grow crops or a large garden", ["outdoors"]],
    ["Work on a fishing boat or a ship", ["water", "outdoors"]],
    ["Weld metal parts together", ["hands", "precise"]],
    ["Fix an air conditioner on a hot day", ["hands", "machines", "electric"]],
    ["Repair a broken phone or laptop screen", ["computers", "hands", "precise"]],
    ["Repair an airplane engine", ["machines", "precise"]],
    ["Work outdoors as a park ranger or game warden", ["outdoors", "animals", "justice"]],
    ["Put out fires and rescue people", ["action", "heights"]],
    ["Cook meals in a busy restaurant kitchen", ["cooking", "action"]],
    ["Set up the lights and sound for a concert", ["hands", "heights", "performing", "electric"]],
    ["Lay brick or tile to make a wall or a floor", ["hands", "design"]],
    ["Train dogs to guide people or to work with police", ["animals"]],
    ["Run a machine that cuts metal parts to exact sizes", ["machines", "precise", "computers"]],
    ["Paint houses or fix up old furniture", ["hands", "design"]],
    ["Dive underwater to check a bridge or a dock", ["water", "action"]],
    ["Keep the machines in a factory running", ["machines", "electric"]],
    ["Trim and shoe a horse's hooves", ["animals", "hands"]],
    ["Build or repair a fence or a barn", ["hands", "outdoors"]],
    ["Learn a hands-on job in the military, like mechanic or medic", ["serving", "machines"]],
    ["Do trail work and camp for weeks in a national forest", ["outdoors"]],
    ["Fly a drone to map a farm or inspect a roof", ["computers", "outdoors"]],
    ["Install and fix home internet and TV cables", ["electric", "computers", "heights"]],
    ["Care for the lawns and trees at a park or golf course", ["outdoors", "design"]],
    ["Repair farm tractors and equipment", ["machines", "outdoors"]],
  ]),
  ...bank("I", [
    ["Do experiments in a science lab", ["science", "research"]],
    ["Figure out why a plant or an animal got sick", ["science", "animals"]],
    ["Study the ocean and the animals that live in it", ["water", "science", "animals"]],
    ["Work on hard math puzzles", ["numbers", "research"]],
    ["Write a computer program that solves a problem", ["computers", "research"]],
    ["Find out what causes a disease", ["science", "research"]],
    ["Study stars and planets with a telescope", ["science", "research"]],
    ["Test water or soil for pollution", ["science", "outdoors"]],
    ["Read about how the brain works", ["science", "research"]],
    ["Look for clues at a crime scene", ["justice", "research", "precise"]],
    ["Find patterns in a big set of data", ["numbers", "computers", "research"]],
    ["Figure out how to make a crop grow better", ["science", "outdoors"]],
    ["Study rocks, volcanoes or earthquakes", ["science", "outdoors"]],
    ["Learn how a medicine works inside the body", ["science", "precise"]],
    ["Find and fix a security hole in a computer system", ["computers", "justice"]],
    ["Study the weather and predict storms", ["science", "numbers"]],
    ["Learn why people act the way they do", ["research", "people"]],
    ["Set up a fair test to see which idea works best", ["research"]],
    ["Study a sports team's stats to find ways to win", ["numbers", "sports"]],
    ["Work out how strong a bridge needs to be", ["numbers", "research"]],
    ["Figure out how a robot can sense what is around it", ["computers", "machines", "research"]],
    ["Read and learn about a topic just because it is interesting", ["research"]],
    ["Look at germs under a microscope", ["science", "precise"]],
    ["Track wild animals to learn how they live", ["animals", "outdoors", "research"]],
    ["Find a way to make batteries last longer", ["science", "electric", "research"]],
    ["Piece together history from old letters and records", ["research", "words"]],
    ["Test food in a lab to make sure it is safe", ["cooking", "science", "precise"]],
    ["Check the facts to decide if a claim online is true", ["research", "words"]],
    ["Study how what we eat affects our health", ["science", "cooking", "people"]],
    ["Build a computer model that predicts how a sickness spreads", ["numbers", "science", "computers"]],
    ["Figure out why a car's computer shows an error", ["machines", "computers", "research"]],
    ["Study how coral reefs can be protected", ["water", "science", "outdoors"]],
    ["Teach a computer to recognize pictures", ["computers", "research"]],
    ["Work out the best way to do something, then test it", ["research", "precise"]],
  ]),
  ...bank("A", [
    ["Draw or paint pictures", ["design"]],
    ["Write short stories or poems", ["words"]],
    ["Play an instrument in a band", ["performing"]],
    ["Sing in front of an audience", ["performing"]],
    ["Act in a play or a film", ["performing"]],
    ["Design a logo or a poster", ["design", "computers"]],
    ["Film and edit videos", ["performing", "computers", "design"]],
    ["Design clothes or costumes", ["design"]],
    ["Take photos for a magazine or website", ["design"]],
    ["Write songs", ["performing", "words"]],
    ["Design the inside of a home or a store", ["design"]],
    ["Draw plans for a new building", ["design", "numbers"]],
    ["Create the art or the story for a video game", ["design", "computers", "words"]],
    ["Write articles for a news website", ["words"]],
    ["Decorate cakes or make food look amazing on the plate", ["cooking", "design"]],
    ["Create new hair, makeup or nail styles", ["design", "people"]],
    ["Dance in a show", ["performing", "action"]],
    ["Make pottery, jewelry or crafts", ["design", "hands"]],
    ["Write the script for a movie or a podcast", ["words", "performing"]],
    ["Plan how a garden or a park will look", ["design", "outdoors"]],
    ["Paint a mural on a wall", ["design"]],
    ["Translate a book into another language", ["words"]],
    ["Design the screens of a phone app", ["design", "computers"]],
    ["Direct a film or a school play", ["performing", "leading"]],
    ["Write music for a video or a game", ["performing", "computers"]],
    ["Write a blog about your ideas", ["words"]],
    ["Build sets and props for a theater", ["design", "hands", "performing"]],
    ["Design how a new product will look", ["design"]],
    ["Make animated cartoons", ["design", "computers"]],
    ["Tell stories to a crowd", ["performing", "words"]],
    ["Restore an old car so it looks like new", ["design", "machines", "hands"]],
    ["Create a comic book", ["design", "words"]],
    ["Design a float or decorations for a parade", ["design", "hands"]],
    ["Come up with a brand-new recipe", ["cooking", "design"]],
  ]),
  ...bank("S", [
    ["Teach young children how to read", ["teaching", "people"]],
    ["Help a sick person feel better", ["people"]],
    ["Coach a youth sports team", ["sports", "teaching", "people"]],
    ["Help a friend work through a problem", ["people"]],
    ["Volunteer at a food bank or a shelter", ["people"]],
    ["Tutor a classmate in a subject", ["teaching"]],
    ["Care for older people in a nursing home", ["people"]],
    ["Help someone recover from an injury with exercises", ["people", "sports", "science"]],
    ["Teach a class for adults", ["teaching"]],
    ["Give first aid in an emergency", ["people", "action"]],
    ["Help new students feel welcome", ["people"]],
    ["Lead a youth group in your community or place of worship", ["people", "leading"]],
    ["Help families find food, housing or medical care", ["people", "justice"]],
    ["Teach someone sign language", ["teaching", "words"]],
    ["Care for babies and toddlers", ["people", "teaching"]],
    ["Help a student choose classes and plan for college", ["teaching", "people"]],
    ["Work as a nurse in a hospital", ["people", "science", "action"]],
    ["Teach people how to eat healthy", ["teaching", "cooking"]],
    ["Help people with disabilities live on their own", ["people"]],
    ["Help two people settle an argument fairly", ["people", "justice"]],
    ["Train new workers how to do their jobs", ["teaching"]],
    ["Help animals at a shelter find new homes", ["animals", "people"]],
    ["Lead an exercise or fitness class", ["sports", "teaching"]],
    ["Help someone learn to speak English", ["teaching", "words"]],
    ["Listen to people and help them through hard times", ["people"]],
    ["Clean teeth and teach good brushing habits", ["people", "precise"]],
    ["Help patients at a doctor's office", ["people"]],
    ["Help a family that just moved here from another country", ["people", "words"]],
    ["Plan activities for kids at a summer camp", ["teaching", "outdoors"]],
    ["Help a neighbor with chores or repairs around the house", ["people", "hands"]],
    ["Ride in an ambulance to help people in an emergency", ["people", "action", "driving"]],
    ["Serve your country and help people after a disaster", ["serving", "people", "action"]],
    ["Help a pet owner care for a sick animal", ["animals", "people"]],
    ["Explain a hard idea so it finally makes sense to someone", ["teaching", "words"]],
  ]),
  ...bank("E", [
    ["Start your own business", ["leading", "selling"]],
    ["Sell a product you believe in", ["selling"]],
    ["Lead a team to win a contest", ["leading"]],
    ["Run for class officer or student council", ["leading", "words"]],
    ["Manage a store or a restaurant", ["leading", "selling"]],
    ["Give a speech to change people's minds", ["words", "leading"]],
    ["Plan a big event like a festival or a fundraiser", ["leading"]],
    ["Bargain for a good price on a car or a house", ["selling", "numbers"]],
    ["Argue a case in court", ["justice", "words"]],
    ["Raise money for a cause you care about", ["selling", "people"]],
    ["Market a new product on social media", ["selling", "design"]],
    ["Be the boss of a construction crew", ["leading", "hands", "outdoors"]],
    ["Run a hotel or a resort", ["leading", "people"]],
    ["Invest money and try to make it grow", ["numbers", "selling"]],
    ["Convince lawmakers to pass a new law", ["justice", "words", "leading"]],
    ["Sell houses as a real estate agent", ["selling", "people"]],
    ["Host a radio show or a podcast", ["performing", "words"]],
    ["Run the business side of a sports team", ["sports", "leading"]],
    ["Lead a team on a military mission", ["serving", "leading", "action"]],
    ["Make the big decisions for a company", ["leading"]],
    ["Pitch your idea to people who might invest in it", ["selling", "words"]],
    ["Get your neighbors together to fix a problem in town", ["leading", "people"]],
    ["Run a farm or a ranch as a business", ["outdoors", "animals", "leading"]],
    ["Find and hire the right people for a company", ["people", "leading"]],
    ["Run a booth and sell things at a market or a fair", ["selling"]],
    ["Take charge when something goes wrong in an emergency", ["action", "leading"]],
    ["Be a manager who helps a team do its best", ["leading", "people"]],
    ["Plan an ad campaign", ["selling", "design"]],
    ["Speak for your school or town at a big event", ["leading", "words"]],
    ["Buy things and resell them for a profit", ["selling", "numbers"]],
    ["Run your own repair or construction company", ["leading", "hands", "selling"]],
    ["Open your own salon, barbershop or food truck", ["selling", "design", "cooking"]],
    ["Lead a group of volunteers", ["leading", "people"]],
    ["Talk a customer into the plan that is right for them", ["selling", "people"]],
  ]),
  ...bank("C", [
    ["Keep track of money in a budget", ["numbers", "precise"]],
    ["Organize files so anyone can find them", ["precise"]],
    ["Check a report for mistakes", ["precise", "words"]],
    ["Do taxes for a family or a business", ["numbers", "precise"]],
    ["Enter information into a spreadsheet", ["computers", "numbers"]],
    ["Keep the schedule for a busy office", ["precise"]],
    ["Track supplies in a warehouse", ["precise", "numbers"]],
    ["Follow a checklist to make sure a job is done right", ["precise"]],
    ["Work as a bank teller", ["numbers", "people"]],
    ["Keep medical records up to date", ["precise", "people"]],
    ["Plan the steps of a project and track each one", ["precise", "leading"]],
    ["Count and reorder the stock in a store", ["numbers"]],
    ["Check that a building meets the safety rules", ["precise", "justice"]],
    ["Proofread a book before it is printed", ["words", "precise"]],
    ["Keep a company's database neat and correct", ["computers", "precise"]],
    ["Keep score and stats at games", ["sports", "numbers"]],
    ["Fill medicine orders carefully at a pharmacy", ["precise", "science"]],
    ["Figure out how much a building project will cost", ["numbers"]],
    ["Keep a club's meeting notes and records", ["words", "precise"]],
    ["Handle insurance claims", ["numbers", "precise"]],
    ["Make sure a company follows the law and its rules", ["justice", "precise"]],
    ["Organize a library's books and records", ["words", "precise"]],
    ["Plan delivery routes so every truck arrives on time", ["driving", "numbers"]],
    ["Match receipts to a bank statement", ["numbers", "precise"]],
    ["Run payroll so everyone gets paid the right amount", ["numbers"]],
    ["Sort and label samples in a lab", ["science", "precise"]],
    ["Set up a step-by-step system so a job is always done the same way", ["precise"]],
    ["Make sure a computer network is backed up every night", ["computers", "precise"]],
    ["Keep the case files in a court office", ["justice", "precise"]],
    ["Keep track of parts in a repair shop", ["machines", "precise"]],
    ["Check that every part on an airplane was inspected", ["machines", "precise"]],
    ["Track a farm's feed, costs and harvest numbers", ["numbers", "animals"]],
    ["Keep a team's travel plans and paperwork in order", ["precise"]],
    ["Check orders and bills to catch errors", ["numbers", "precise"]],
  ]),
];

const vbank = (value: WorkValue, rows: string[]): ValueItem[] => rows.map((text, i) => ({ id: `v-${value}-${i + 1}`, value, text }));

/** Work values: the student rates how important each is in a future job. */
export const VALUE_ITEMS: ValueItem[] = [
  ...vbank("achievement", ["Do work where I can see what I made or fixed", "Use what I am best at every day", "Finish hard jobs and feel proud of them", "Keep learning new skills on the job", "Do work that really matters"]),
  ...vbank("independence", ["Make my own decisions about how to do my work", "Try out my own ideas", "Work without someone watching over me", "Set my own schedule", "Be my own boss someday"]),
  ...vbank("recognition", ["Have a chance to move up to a higher job", "Be respected for the work I do", "Be in charge of other people", "Have a job people look up to", "Get credit when I do well"]),
  ...vbank("relationships", ["Work with people I get along with", "Help other people through my work", "Never be asked to do something I think is wrong", "Be part of a close team", "Work for something I believe in"]),
  ...vbank("support", ["Have a boss who treats workers fairly", "Get good training", "Work for a company I can trust", "Know exactly what is expected of me", "Have someone to ask when I am stuck"]),
  ...vbank("conditions", ["Earn a lot of money", "Have a steady job that is hard to lose", "Do different things every day", "Work in a clean, safe place", "Have time for family and life outside work"]),
];

/** The five answers, scored 0 to 4, like the O*NET Interest Profiler's scale. */
export const LIKE_SCALE = ["Strongly dislike", "Dislike", "Not sure", "Like", "Strongly like"] as const;
export const IMPORTANCE_SCALE = ["Not important", "A little important", "Somewhat important", "Very important", "Extremely important"] as const;
export type Answer = 0 | 1 | 2 | 3 | 4;

/** How many questions a sitting draws. The standard quiz is long on purpose: more answers, steadier results. */
export const QUIZ_LENGTH = { perType: 16, perValue: 3, deeperPerType: 8 } as const;

// ---------- Drawing a new quiz each time ----------

/** Small seeded random number generator, so a sitting can be resumed with the same questions. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Puts questions in an order where the same interest type never comes three times in a row. */
function spread<T extends { type?: InterestType; value?: WorkValue }>(list: T[]): T[] {
  const key = (x: T) => x.type ?? x.value ?? "";
  const rest = [...list];
  const out: T[] = [];
  while (rest.length) {
    const n = out.length;
    const blocked = n >= 2 && key(out[n - 1]!) === key(out[n - 2]!) ? key(out[n - 1]!) : null;
    const i = rest.findIndex((x) => key(x) !== blocked);
    out.push(rest.splice(i < 0 ? 0 : i, 1)[0]!);
  }
  return out;
}

export interface QuizDraw { interests: InterestItem[]; values: ValueItem[] }

/**
 * A new mix of questions: the same number from each interest type (so results stay balanced), the
 * questions this device saw last time held back when there are enough others, and a shuffled order.
 */
export function drawQuiz(seed: number, opts: { perType?: number; perValue?: number; avoid?: Iterable<string>; exclude?: Iterable<string> } = {}): QuizDraw {
  const rnd = seededRandom(seed);
  const perType = opts.perType ?? QUIZ_LENGTH.perType;
  const perValue = opts.perValue ?? QUIZ_LENGTH.perValue;
  const avoid = new Set(opts.avoid ?? []);
  const exclude = new Set(opts.exclude ?? []);
  const pick = <T extends { id: string }>(pool: T[], n: number) => {
    const open = shuffle(pool.filter((x) => !exclude.has(x.id)), rnd);
    // Fresh questions first, then ones seen last time if the fresh ones run out.
    return [...open.filter((x) => !avoid.has(x.id)), ...open.filter((x) => avoid.has(x.id))].slice(0, n);
  };
  const interests = RIASEC.flatMap((t) => pick(INTEREST_ITEMS.filter((x) => x.type === t), perType));
  const values = (Object.keys(WORK_VALUES) as WorkValue[]).flatMap((v) => pick(VALUE_ITEMS.filter((x) => x.value === v), perValue));
  return { interests: spread(shuffle(interests, rnd)), values: spread(shuffle(values, rnd)) };
}

const ITEM_BY_ID = new Map<string, InterestItem | ValueItem>([...INTEREST_ITEMS, ...VALUE_ITEMS].map((x) => [x.id, x]));
export const quizItem = (id: string) => ITEM_BY_ID.get(id);

// ---------- Scoring ----------

export interface QuizResult {
  /** 0 to 100 for each interest type: how much the student liked that type's activities. */
  scores: Record<InterestType, number>;
  /** The top three types, strongest first, like "SIA". */
  code: string;
  /** 0 to 100 for each theme that came up in the questions. */
  tags: Partial<Record<QuizTag, number>>;
  /** 0 to 100 for each work value. */
  values: Record<WorkValue, number>;
  answered: number;
  /** Plain-word notes about how much to trust this result. */
  notes: string[];
}

const pct = (sum: number, n: number) => (n ? Math.round((sum / (n * 4)) * 100) : 0);

/**
 * Scores a sitting. It only takes answers to questions: there is no way to pass in race, ethnicity,
 * sex, gender, grades or test scores, so none of them can change a result.
 */
export function scoreQuiz(answers: Record<string, Answer>, opts: { seconds?: number } = {}): QuizResult {
  const sums = Object.fromEntries(RIASEC.map((t) => [t, { s: 0, n: 0 }])) as Record<InterestType, { s: number; n: number }>;
  const tagSums: Partial<Record<QuizTag, { s: number; n: number }>> = {};
  const valSums = Object.fromEntries(Object.keys(WORK_VALUES).map((v) => [v, { s: 0, n: 0 }])) as Record<WorkValue, { s: number; n: number }>;
  const counts = [0, 0, 0, 0, 0];
  let answered = 0;
  for (const [id, a] of Object.entries(answers)) {
    const item = ITEM_BY_ID.get(id);
    if (!item || !(a >= 0 && a <= 4)) continue;
    answered++;
    if ("type" in item) {
      counts[a]!++;
      sums[item.type].s += a; sums[item.type].n++;
      for (const t of item.tags) { const x = (tagSums[t] ??= { s: 0, n: 0 }); x.s += a; x.n++; }
    } else {
      valSums[item.value].s += a; valSums[item.value].n++;
    }
  }
  const scores = Object.fromEntries(RIASEC.map((t) => [t, pct(sums[t].s, sums[t].n)])) as Record<InterestType, number>;
  // Ties keep the RIASEC order, so the same answers always give the same code.
  const code = [...RIASEC].sort((a, b) => scores[b] - scores[a]).slice(0, 3).join("");
  const tags = Object.fromEntries(Object.entries(tagSums).map(([t, x]) => [t, pct(x!.s, x!.n)])) as Partial<Record<QuizTag, number>>;
  const values = Object.fromEntries(Object.entries(valSums).map(([v, x]) => [v, pct(x.s, x.n)])) as Record<WorkValue, number>;

  const notes: string[] = [];
  const interestCount = counts.reduce((a, b) => a + b, 0);
  const top = Math.max(...counts);
  const ordered = [...RIASEC].sort((a, b) => scores[b] - scores[a]);
  const spreadPts = scores[ordered[0]!] - scores[ordered[5]!];
  if (interestCount >= 20 && top / interestCount >= 0.85) notes.push("Almost every answer was the same, so this result may not mean much. Take it again when you have time to think about each activity.");
  else if (spreadPts < 12) notes.push("Your interests are spread evenly. That is common and not a bad thing: you could be happy in many fields. Job shadowing and trying classes will help you narrow it down.");
  if (Math.max(...RIASEC.map((t) => scores[t])) < 40) notes.push("Not much stood out yet. That is normal, especially in middle school. Try new activities, then take the quiz again in a few months.");
  if (scores[ordered[2]!] >= 40 && scores[ordered[2]!] - scores[ordered[3]!] < 4) notes.push(`Your third and fourth types (${INTEREST_TYPES[ordered[2]!].name} and ${INTEREST_TYPES[ordered[3]!].name}) are very close, so look at careers for both.`);
  if (opts.seconds && interestCount >= 20 && opts.seconds / interestCount < 1.5) notes.push("You answered very fast. Results are more accurate when you picture yourself doing each activity.");
  return { scores, code, tags, values, answered, notes };
}

// ---------- Matching careers and trades ----------

/**
 * Interest codes for each career and trade, strongest type first, based on the U.S. Labor
 * Department's O*NET occupation interest profiles. Pay never changes the match.
 */
export const CAREER_CODES: Record<string, string> = {
  vet: "IRS", vettech: "RIS", zoologist: "IRA", geoscientist: "IRC", conservation: "RIE", agscientist: "IRC", farmer: "REC",
  rn: "SIC", lpn: "SRC", np: "SIE", doctor: "ISR", pa: "SIR", pharmacist: "ICS", dentist: "IRS", hygienist: "SRC",
  pt: "SIR", ot: "SIR", slp: "SIA", radtech: "RSI", resptherapist: "ISR", dietitian: "ISE",
  software: "ICR", cyber: "CIR", datasci: "ICR", mecheng: "RIC", civileng: "RIC", eleceng: "IRC", chemist: "IRC",
  accountant: "CEI", finance: "CEI", analyst: "EIC", marketing: "EAC", hsteacher: "SAE", elemteacher: "SAC",
  lawyer: "EIS", paralegal: "CIE", psychologist: "ISA", socialworker: "SIE", police: "RES",
  automech: "RIC", aircraftmech: "RIC", electrician: "RIC", pilot: "RIE", designer: "AER",
  architect: "AIR", writer: "AIE", reporter: "AES", producer: "EAS", interior: "AER", translator: "ASC", pr: "EAS",
  salesmanager: "ECS", realestate: "ECS", insurance: "ECS", lodging: "ECS", hr: "ESC", schoolcounselor: "SEI",
  coach: "SER", librarian: "CSA", planner: "IEA",
};

/** Themes for the careers the older quiz did not tag. */
const EXTRA_CAREER_TAGS: Record<string, QuizTag[]> = {
  architect: ["design", "numbers", "heights"], writer: ["words"], reporter: ["words", "research"], producer: ["performing", "leading"],
  interior: ["design"], translator: ["words", "people"], pr: ["words", "selling"], salesmanager: ["selling", "leading"],
  realestate: ["selling", "people"], insurance: ["selling", "numbers"], lodging: ["leading", "people", "cooking"], hr: ["people", "leading"],
  schoolcounselor: ["people", "teaching"], coach: ["sports", "teaching", "leading"], librarian: ["words", "research", "precise"],
  planner: ["design", "research", "justice"], police: ["action", "justice", "people", "driving", "serving"], pilot: ["machines", "driving", "action", "precise", "serving"],
};
export const careerTags = (key: string): QuizTag[] => EXTRA_CAREER_TAGS[key] ?? (CAREER_TAGS as Record<string, QuizTag[]>)[key] ?? [];

/** Interest codes for each trade in the trades pack, by slug. */
export const TRADE_CODES: Record<string, string> = {
  electrician: "RIC", lineworker: "RCE", plumber: "RCI", hvac: "RIC", welder: "RCI", "cnc-machinist": "RCI",
  "industrial-maintenance": "RIC", "auto-technician": "RIC", "diesel-technician": "RIC", "heavy-equipment-mechanic": "RCI",
  "collision-repair": "RCA", "aircraft-mechanic": "RIC", "cdl-truck-driver": "RCE", "heavy-equipment-operator": "RCE",
  carpenter: "RCI", mason: "RCA", ironworker: "RCE", "sheet-metal": "RCI", boilermaker: "RCE", "elevator-installer": "RIC",
  "construction-manager": "ERC", "solar-installer": "RCI", "wind-turbine-technician": "RIC", "commercial-diver": "RIC",
  "marine-mechanic": "RIC", "ag-mechanic": "RIC", farrier: "REC", "vet-technician": "RIS", landscaping: "RAE",
  "water-operator": "RCI", lpn: "SRC", cna: "SRC", "medical-assistant": "SCR", "dental-hygienist": "SRC",
  "surgical-technologist": "RSC", "radiologic-technologist": "RSI", paramedic: "SRI", "pharmacy-technician": "CRS",
  cosmetologist: "ASE", barber: "ASR", "nail-technician": "ASR", "police-officer": "RES", firefighter: "RSE",
  "it-support": "RCI", "network-technician": "ICR", cybersecurity: "CIR", "drone-pilot": "RIC", chef: "ERA",
  "film-crew": "RAE", logistics: "CRE",
  "cnc-operator": "RCI", "cnc-programmer": "IRC", "tool-and-die-maker": "RIC", millwright: "RIC",
  "power-plant-operator": "RCI", "substation-technician": "RIC", "avionics-technician": "RIC", "crane-operator": "RCE",
  "telecom-line-installer": "RCI", "air-traffic-controller": "CER", "railroad-conductor": "RCE", "boat-captain": "REC",
  sonographer: "SIR", "mri-technologist": "RSI", "physical-therapist-assistant": "SRE", "occupational-therapy-assistant": "SRA",
  "respiratory-therapist": "SIR",
};

const CODE_WEIGHTS = [1, 0.6, 0.35];

/** 0 to 100: how well a student's six scores fit a job's interest code. */
export function codeFit(scores: Record<InterestType, number>, code: string): number {
  let s = 0, w = 0;
  [...code].forEach((t, i) => { const wt = CODE_WEIGHTS[i] ?? 0; s += wt * (scores[t as InterestType] ?? 0); w += wt; });
  return w ? s / w : 0;
}

/** Interest code fit counts most; the specific themes (animals, water, music...) fine-tune it. */
function fit(result: QuizResult, code: string, tags: QuizTag[]): number {
  const base = codeFit(result.scores, code);
  const known = tags.map((t) => result.tags[t]).filter((x): x is number => x !== undefined);
  const themed = known.length ? known.reduce((a, b) => a + b, 0) / known.length : base;
  return Math.round(0.65 * base + 0.35 * themed);
}

export interface QuizCareerMatch { key: string; career: Career; fit: number; fieldId: string | null }
export interface QuizTradeMatch { trade: Trade; fit: number }

/** A plain label for a fit, compared with the student's own strongest interest. */
export function fitLabel(result: QuizResult, fitScore: number): "Strong fit" | "Good fit" | "Worth a look" {
  const best = Math.max(1, ...RIASEC.map((t) => result.scores[t]));
  const r = fitScore / best;
  return r >= 0.85 ? "Strong fit" : r >= 0.7 ? "Good fit" : "Worth a look";
}

/** College-path careers, best fit first. Pay is shown but never used to rank. */
export function quizCareers(result: QuizResult, limit = 10): QuizCareerMatch[] {
  return Object.entries(CAREER_CODES)
    .filter(([key]) => CAREERS[key])
    .map(([key, code]) => ({ key, career: CAREERS[key]!, fit: fit(result, code, careerTags(key)), fieldId: FIELDS.find((f) => (f.careers as string[]).includes(key))?.id ?? null }))
    .sort((a, b) => b.fit - a.fit || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/** Skilled trades, best fit first. */
export function quizTrades(result: QuizResult, trades: Trade[], limit = 8): QuizTradeMatch[] {
  return trades
    .filter((t) => TRADE_CODES[t.slug])
    .map((trade) => ({ trade, fit: fit(result, TRADE_CODES[trade.slug]!, trade.interests) }))
    .sort((a, b) => b.fit - a.fit || a.trade.slug.localeCompare(b.trade.slug))
    .slice(0, limit);
}

/** How strongly the military paths fit: the "serving" theme, plus building and leading interests. */
export function militaryFit(result: QuizResult): number {
  const serving = result.tags.serving;
  const base = codeFit(result.scores, "RES");
  return Math.round(serving === undefined ? base : 0.5 * serving + 0.5 * base);
}

/** The strongest themes, for the "what lit you up" list. */
export function topTags(result: QuizResult, n = 5): { tag: QuizTag; score: number }[] {
  return (Object.entries(result.tags) as [QuizTag, number][])
    .filter(([, s]) => s >= 60)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([tag, score]) => ({ tag, score }));
}

/** Work values, most important first. */
export const rankedValues = (result: QuizResult) =>
  (Object.entries(result.values) as [WorkValue, number][]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

// ---------- Saving a short summary on the student's profile ----------

/** What is kept on the student's profile (small, so the AI counselor can use it). */
export interface SavedQuiz { at: string; code: string; scores: Record<InterestType, number>; values: WorkValue[]; careers: string[]; trades: string[]; tags: QuizTag[] }

export function summarizeQuiz(result: QuizResult, trades: Trade[], today: string): SavedQuiz {
  return {
    at: today,
    code: result.code,
    scores: result.scores,
    values: rankedValues(result).slice(0, 2).map(([v]) => v),
    careers: quizCareers(result, 6).map((c) => c.key),
    trades: quizTrades(result, trades, 4).map((t) => t.trade.slug),
    tags: topTags(result, 5).map((t) => t.tag),
  };
}

/** One line for the AI counselor about a saved quiz. */
export function quizLine(q: SavedQuiz): string {
  const types = [...q.code].map((t) => INTEREST_TYPES[t as InterestType]?.name).filter(Boolean).join(", ");
  const careers = q.careers.map((k) => CAREERS[k]?.name).filter(Boolean).join(", ");
  const values = q.values.map((v) => WORK_VALUES[v]?.name).filter(Boolean).join(" and ");
  return `Career interest quiz (${q.at}): strongest interests ${types} (code ${q.code}); themes ${q.tags.map((t) => QUIZ_TAGS[t]).join("; ") || "none stood out"}; values ${values || "not answered"}; top career ideas ${careers}; top trades ${q.trades.join(", ")}. Treat these as interests to explore, not a verdict, and never as a limit.`;
}

export const QUIZ_DISCLAIMER =
  "This quiz is a tool to explore ideas, not a test of what you can do and not a decision. It looks only at what you like and what matters to you. It does not measure ability, intelligence or your chances of success, and it never asks about or uses race, ethnicity, sex or gender. Interests often change during the teen years. Results are suggestions only: ScholarTasks does not promise that any career will be a good fit, available, or pay a certain amount. Before choosing a career, school, major or training program, talk with your family and a school counselor, try a class, a job shadow or a summer program, and check the facts yourself. All choices are your family's own.";
