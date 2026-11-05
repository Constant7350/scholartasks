// Search colleges by what a student wants to study.
//
// A "field" is something a family would type: "marine biology", "vet", "nurse".
// Each one points at federal major codes (4-digit CIP codes, the codes the
// U.S. Department of Education uses for majors) and the degree levels that
// lead to that career. Colleges are then scored on that major with federal
// College Scorecard data (see rankPrograms). Careers carry pay and job growth
// from the U.S. Bureau of Labor Statistics Occupational Outlook Handbook.

/** Degree levels as numbered in the College Scorecard field-of-study data. */
export type DegreeLevel = 1 | 2 | 3 | 5 | 6 | 7;

export interface DegreeInfo {
  level: DegreeLevel;
  name: string;
  /** Years of school after high school, full time. */
  years: string;
  /** Typical yearly pay for all workers 25+ whose highest degree is this (BLS, 2025). */
  typicalPay: number | null;
  /** Unemployment rate for the same group (BLS, 2025). */
  unemployment: number | null;
  plain: string;
}

/**
 * How long each degree takes and what people with it typically earn.
 * Pay: BLS "Education pays" 2025, median weekly earnings x 52, full-time workers 25 and older.
 * https://www.bls.gov/emp/tables/unemployment-earnings-education.htm
 */
export const DEGREES: DegreeInfo[] = [
  { level: 1, name: "Certificate or diploma", years: "Under 1 to 2 years", typicalPay: null, unemployment: null, plain: "Fastest path to a job. Most Georgia technical colleges offer these, and HOPE Grant can pay tuition." },
  { level: 2, name: "Associate degree", years: "2 years", typicalPay: 59020, unemployment: 3.0, plain: "Leads straight to jobs like nursing (RN), dental hygiene and vet tech, or transfers into a bachelor's." },
  { level: 3, name: "Bachelor's degree", years: "4 years", typicalPay: 82056, unemployment: 2.8, plain: "The usual four-year college degree. Needed for most professional jobs and for graduate school." },
  { level: 5, name: "Master's degree", years: "About 6 years (4 + 1 to 2)", typicalPay: 97552, unemployment: 2.6, plain: "One to two years after a bachelor's. Required for jobs like nurse practitioner, counselor and speech therapist." },
  { level: 7, name: "Professional degree (vet, medicine, law, pharmacy)", years: "7 to 8 years (4 + 3 to 4), plus residency for doctors", typicalPay: 119288, unemployment: 1.9, plain: "Doctor of Veterinary Medicine, MD, law (JD), pharmacy (PharmD), dentistry. Very competitive to get into." },
  { level: 6, name: "Doctorate (PhD)", years: "About 9 to 10 years (4 + 5 to 6)", typicalPay: 119964, unemployment: 1.8, plain: "For research scientists and professors. Many PhD programs pay tuition and a small salary." },
];
export const HIGH_SCHOOL_PAY = 50232; // BLS 2025, high school diploma, median weekly 966 x 52
export const EARNINGS_SOURCE = "https://www.bls.gov/emp/tables/unemployment-earnings-education.htm";

export const degreeName = (level: number) => DEGREES.find((d) => d.level === level)?.name ?? "Degree";

export interface Career {
  name: string;
  /** Median yearly pay, May 2025 (half earn more, half less). */
  pay: number;
  /** Typical education needed to start. */
  education: string;
  /** Degree level needed to start (for sorting "fast job" vs "high pay"). */
  level: DegreeLevel | 0;
  /** Expected job growth 2025-2035, percent. */
  growth: number;
  url: string;
}

const OOH = "https://www.bls.gov/ooh/";
/** Careers, from the BLS Occupational Outlook Handbook (pay May 2025, outlook 2025-35). */
export const CAREERS: Record<string, Career> = {
  vet: { name: "Veterinarian", pay: 130100, education: "Doctor of Veterinary Medicine (DVM)", level: 7, growth: 9, url: `${OOH}healthcare/veterinarians.htm` },
  vettech: { name: "Veterinary technician", pay: 47380, education: "Associate degree", level: 2, growth: 9, url: `${OOH}healthcare/veterinary-technologists-and-technicians.htm` },
  zoologist: { name: "Zoologist or wildlife/marine biologist", pay: 76780, education: "Bachelor's degree", level: 3, growth: 4, url: `${OOH}life-physical-and-social-science/zoologists-and-wildlife-biologists.htm` },
  geoscientist: { name: "Geoscientist or oceanographer", pay: 101920, education: "Bachelor's degree", level: 3, growth: 5, url: `${OOH}life-physical-and-social-science/geoscientists.htm` },
  conservation: { name: "Conservation scientist or forester", pay: 73920, education: "Bachelor's degree", level: 3, growth: 4, url: `${OOH}life-physical-and-social-science/conservation-scientists.htm` },
  agscientist: { name: "Agricultural or food scientist", pay: 81970, education: "Bachelor's degree", level: 3, growth: 6, url: `${OOH}life-physical-and-social-science/agricultural-and-food-scientists.htm` },
  farmer: { name: "Farm, ranch or horse farm manager", pay: 89900, education: "High school, plus experience (a degree helps)", level: 0, growth: -3, url: `${OOH}management/farmers-ranchers-and-other-agricultural-managers.htm` },
  rn: { name: "Registered nurse (RN)", pay: 97550, education: "Bachelor's (BSN) or associate (ADN), then the NCLEX exam", level: 2, growth: 6, url: `${OOH}healthcare/registered-nurses.htm` },
  lpn: { name: "Licensed practical nurse (LPN)", pay: 64400, education: "Certificate (about 1 year)", level: 1, growth: 3, url: `${OOH}healthcare/licensed-practical-and-licensed-vocational-nurses.htm` },
  np: { name: "Nurse practitioner, anesthetist or midwife", pay: 134920, education: "Master's degree (after a BSN)", level: 5, growth: 36, url: `${OOH}healthcare/nurse-anesthetists-nurse-midwives-and-nurse-practitioners.htm` },
  doctor: { name: "Physician or surgeon", pay: 275930, education: "Medical degree (MD/DO) plus 3-7 years of residency", level: 7, growth: 4, url: `${OOH}healthcare/physicians-and-surgeons.htm` },
  pa: { name: "Physician assistant", pay: 135880, education: "Master's degree", level: 5, growth: 21, url: `${OOH}healthcare/physician-assistants.htm` },
  pharmacist: { name: "Pharmacist", pay: 140910, education: "Doctor of Pharmacy (PharmD)", level: 7, growth: 5, url: `${OOH}healthcare/pharmacists.htm` },
  dentist: { name: "Dentist", pay: 176110, education: "Dental degree (DDS/DMD)", level: 7, growth: 6, url: `${OOH}healthcare/dentists.htm` },
  hygienist: { name: "Dental hygienist", pay: 98100, education: "Associate degree", level: 2, growth: 8, url: `${OOH}healthcare/dental-hygienists.htm` },
  pt: { name: "Physical therapist", pay: 102760, education: "Doctor of Physical Therapy (about 3 years after a bachelor's)", level: 6, growth: 12, url: `${OOH}healthcare/physical-therapists.htm` },
  ot: { name: "Occupational therapist", pay: 100330, education: "Master's degree", level: 5, growth: 15, url: `${OOH}healthcare/occupational-therapists.htm` },
  slp: { name: "Speech-language pathologist", pay: 97870, education: "Master's degree", level: 5, growth: 17, url: `${OOH}healthcare/speech-language-pathologists.htm` },
  radtech: { name: "Radiologic (X-ray) technologist", pay: 81390, education: "Associate degree", level: 2, growth: 5, url: `${OOH}healthcare/radiologic-technologists.htm` },
  resptherapist: { name: "Respiratory therapist", pay: 82280, education: "Associate degree", level: 2, growth: 9, url: `${OOH}healthcare/respiratory-therapists.htm` },
  dietitian: { name: "Dietitian or nutritionist", pay: 76400, education: "Bachelor's degree (new dietitians need a master's)", level: 3, growth: 8, url: `${OOH}healthcare/dietitians-and-nutritionists.htm` },
  software: { name: "Software developer", pay: 134040, education: "Bachelor's degree", level: 3, growth: 10, url: `${OOH}computer-and-information-technology/software-developers.htm` },
  cyber: { name: "Information security (cybersecurity) analyst", pay: 129180, education: "Bachelor's degree", level: 3, growth: 21, url: `${OOH}computer-and-information-technology/information-security-analysts.htm` },
  datasci: { name: "Data scientist", pay: 120230, education: "Bachelor's degree", level: 3, growth: 35, url: `${OOH}math/data-scientists.htm` },
  mecheng: { name: "Mechanical engineer", pay: 104110, education: "Bachelor's degree", level: 3, growth: 11, url: `${OOH}architecture-and-engineering/mechanical-engineers.htm` },
  civileng: { name: "Civil engineer", pay: 100840, education: "Bachelor's degree", level: 3, growth: 6, url: `${OOH}architecture-and-engineering/civil-engineers.htm` },
  eleceng: { name: "Electrical engineer", pay: 125040, education: "Bachelor's degree", level: 3, growth: 8, url: `${OOH}architecture-and-engineering/electrical-and-electronics-engineers.htm` },
  chemist: { name: "Chemist", pay: 95060, education: "Bachelor's degree", level: 3, growth: 7, url: `${OOH}life-physical-and-social-science/chemists-and-materials-scientists.htm` },
  accountant: { name: "Accountant or auditor", pay: 83680, education: "Bachelor's degree", level: 3, growth: 5, url: `${OOH}business-and-financial/accountants-and-auditors.htm` },
  finance: { name: "Financial analyst", pay: 103570, education: "Bachelor's degree", level: 3, growth: 7, url: `${OOH}business-and-financial/financial-analysts.htm` },
  analyst: { name: "Management analyst (consultant)", pay: 101860, education: "Bachelor's degree", level: 3, growth: 10, url: `${OOH}business-and-financial/management-analysts.htm` },
  marketing: { name: "Marketing manager", pay: 166790, education: "Bachelor's degree, plus years of experience", level: 3, growth: 6, url: `${OOH}management/advertising-promotions-and-marketing-managers.htm` },
  hsteacher: { name: "High school teacher", pay: 72040, education: "Bachelor's degree and a teaching certificate", level: 3, growth: 0, url: `${OOH}education-training-and-library/high-school-teachers.htm` },
  elemteacher: { name: "Elementary school teacher", pay: 63820, education: "Bachelor's degree and a teaching certificate", level: 3, growth: 0, url: `${OOH}education-training-and-library/kindergarten-and-elementary-school-teachers.htm` },
  lawyer: { name: "Lawyer", pay: 159670, education: "Law degree (JD), 3 years after a bachelor's", level: 7, growth: 5, url: `${OOH}legal/lawyers.htm` },
  paralegal: { name: "Paralegal", pay: 62890, education: "Associate degree", level: 2, growth: 0, url: `${OOH}legal/paralegals-and-legal-assistants.htm` },
  psychologist: { name: "Psychologist", pay: 99110, education: "Master's or doctorate", level: 5, growth: 6, url: `${OOH}life-physical-and-social-science/psychologists.htm` },
  socialworker: { name: "Social worker", pay: 61780, education: "Bachelor's (master's for counseling)", level: 3, growth: 6, url: `${OOH}community-and-social-service/social-workers.htm` },
  police: { name: "Police officer or detective", pay: 77310, education: "High school to college degree, plus police academy", level: 0, growth: 3, url: `${OOH}protective-service/police-and-detectives.htm` },
  automech: { name: "Automotive technician", pay: 50620, education: "Certificate (about 1 year)", level: 1, growth: 5, url: `${OOH}installation-maintenance-and-repair/automotive-service-technicians-and-mechanics.htm` },
  aircraftmech: { name: "Aircraft mechanic", pay: 80180, education: "Certificate (FAA-approved school)", level: 1, growth: 6, url: `${OOH}installation-maintenance-and-repair/aircraft-and-avionics-equipment-mechanics-and-technicians.htm` },
  electrician: { name: "Electrician", pay: 63190, education: "High school plus a paid apprenticeship (a certificate helps)", level: 0, growth: 9, url: `${OOH}construction-and-extraction/electricians.htm` },
  pilot: { name: "Airline pilot", pay: 232140, education: "Bachelor's degree plus flight hours and FAA licenses", level: 3, growth: 7, url: `${OOH}transportation-and-material-moving/airline-and-commercial-pilots.htm` },
  designer: { name: "Graphic designer", pay: 62960, education: "Bachelor's degree", level: 3, growth: -2, url: `${OOH}arts-and-design/graphic-designers.htm` },
};

/** One list of colleges inside a field, e.g. "Vet schools" or "Pre-vet majors". */
export interface FieldGroup {
  title: string;
  /** 4-digit federal major codes (CIP). */
  cips: string[];
  levels: DegreeLevel[];
  hint?: string;
}

export interface CheckLink { label: string; url: string }

export interface StudyField {
  id: string;
  label: string;
  /** Words a family might type. */
  words: string[];
  groups: FieldGroup[];
  careers: (keyof typeof CAREERS)[];
  /** Things to check about a program that the federal data doesn't have (accreditation, licensing pass rates). */
  checks?: CheckLink[];
  note?: string;
}

const B: DegreeLevel[] = [3];
const AVMA: CheckLink = { label: "List of accredited vet schools (AAVMC)", url: "https://www.aavmc.org/member-institutions" };
const NURSING_CHECKS: CheckLink[] = [
  { label: "CCNE accredited nursing programs", url: "https://www.aacnnursing.org/ccne-accreditation/find-accredited-programs" },
  { label: "Georgia approved nursing programs and NCLEX pass rates", url: "https://sos.ga.gov/page/approved-programs-and-nclex-information" },
];
const ABET: CheckLink = { label: "ABET accredited engineering and computing programs", url: "https://amspub.abet.org/aps/name-search" };

/** The majors families ask about most. Anything else is found by the major's federal name. */
export const FIELDS: StudyField[] = [
  {
    id: "marine-biology", label: "Marine biology", words: ["marine", "marine biology", "ocean", "oceanography", "sea", "dolphin", "fish", "aquatic", "marine science"],
    groups: [
      { title: "Marine biology, ecology and fisheries majors", cips: ["2613", "0303"], levels: B, hint: "Federal data groups marine biology with ecology and evolution, so check each college has a marine track." },
      { title: "Biology (most marine biologists start here)", cips: ["2601"], levels: B },
      { title: "Oceanography and earth science", cips: ["4006"], levels: B },
    ],
    careers: ["zoologist", "geoscientist", "conservation"],
    note: "Many marine biologists earn a master's degree. Colleges on the coast often have field stations and boats; ask about them on a visit.",
  },
  {
    id: "veterinarian", label: "Veterinarian", words: ["vet", "veterinarian", "veterinary", "animal doctor", "pre-vet", "prevet", "dvm"],
    groups: [
      { title: "Vet schools (Doctor of Veterinary Medicine)", cips: ["0180"], levels: [7], hint: "Four years after college. Only about 35 U.S. vet schools; most take mainly their own state's residents." },
      { title: "Four-year majors before vet school (pre-vet)", cips: ["0109", "2601", "0113"], levels: B, hint: "Animal science, biology or a pre-vet program. Vet schools care about the required science classes and animal experience, not the major's name." },
    ],
    careers: ["vet", "vettech", "zoologist"],
    checks: [AVMA, { label: "Vet school entry requirements (AAVMC)", url: "https://www.aavmc.org/becoming-a-veterinarian/" }],
    note: "Veterinarian takes about 8 years after high school: 4 for a bachelor's, then 4 at vet school. Vet tech takes 2.",
  },
  {
    id: "vet-tech", label: "Vet tech", words: ["vet tech", "veterinary technician", "veterinary technology", "animal care"],
    groups: [{ title: "Veterinary technology", cips: ["0183"], levels: [2, 3], hint: "Check the program is AVMA accredited; graduates must pass the national vet tech exam." }],
    careers: ["vettech"], checks: [{ label: "AVMA accredited vet tech programs", url: "https://avma.org/education/accreditation/programs/accredited-programs-cvtea" }],
  },
  {
    id: "animal-science", label: "Animal science and horses", words: ["animal", "animals", "animal science", "horse", "horses", "equine", "equestrian", "livestock"],
    groups: [{ title: "Animal science and equine studies", cips: ["0109", "0105"], levels: B }],
    careers: ["agscientist", "farmer", "vet"],
  },
  {
    id: "agriculture", label: "Agriculture", words: ["agriculture", "ag", "farming", "agribusiness", "plant", "crop", "food science"],
    groups: [{ title: "Agriculture, plant and food science", cips: ["0101", "0111", "0110", "0109"], levels: B }],
    careers: ["agscientist", "farmer", "conservation"],
  },
  {
    id: "wildlife", label: "Wildlife, forestry and environment", words: ["wildlife", "forestry", "environment", "environmental", "conservation", "zoology", "zoo", "park ranger", "natural resources"],
    groups: [{ title: "Wildlife, forestry and natural resources", cips: ["0306", "0305", "0301"], levels: B }, { title: "Ecology and zoology", cips: ["2613", "2607"], levels: B }],
    careers: ["conservation", "zoologist"],
  },
  {
    id: "nursing", label: "Nursing", words: ["nurse", "nursing", "rn", "bsn", "adn", "registered nurse", "nurse practitioner", "lpn"],
    groups: [
      { title: "Bachelor of Science in Nursing (BSN)", cips: ["5138"], levels: B, hint: "Four years. Most hospitals now prefer a BSN, and it leads to nurse practitioner later." },
      { title: "Two-year nursing (ADN) at technical and state colleges", cips: ["5138"], levels: [2], hint: "Two years, then the same NCLEX exam to become an RN. Much cheaper; HOPE Grant can help." },
    ],
    careers: ["rn", "lpn", "np"], checks: NURSING_CHECKS,
    note: "Every nurse must pass the NCLEX licensing exam. Ask each school for its first-time NCLEX pass rate.",
  },
  {
    id: "pre-med", label: "Doctor (pre-med)", words: ["doctor", "physician", "medicine", "medical", "pre-med", "premed", "surgeon", "md"],
    groups: [
      { title: "Four-year majors before medical school (pre-med)", cips: ["2601", "2602", "5111", "4005"], levels: B, hint: "Any major works if you take the required science classes; biology and chemistry are most common." },
      { title: "Medical schools (MD/DO)", cips: ["5112"], levels: [7] },
    ],
    careers: ["doctor", "pa", "np"],
    note: "Doctor takes 11 to 15 years after high school: 4 college, 4 medical school, then 3 to 7 years of residency (paid).",
  },
  {
    id: "pharmacy", label: "Pharmacy", words: ["pharmacy", "pharmacist", "pharmd"],
    groups: [{ title: "Pharmacy schools (PharmD)", cips: ["5120"], levels: [7] }, { title: "Pre-pharmacy majors", cips: ["4005", "2601"], levels: B }],
    careers: ["pharmacist"],
  },
  {
    id: "dental", label: "Dentist and dental hygiene", words: ["dentist", "dental", "dental hygiene", "hygienist", "orthodontist"],
    groups: [{ title: "Dental hygiene", cips: ["5106"], levels: [2, 3] }, { title: "Dental schools (DDS/DMD)", cips: ["5104"], levels: [7] }],
    careers: ["hygienist", "dentist"],
  },
  {
    id: "therapy", label: "Physical, occupational and speech therapy", words: ["physical therapy", "physical therapist", "pt", "occupational therapy", "ot", "speech", "kinesiology", "exercise science", "sports medicine", "athletic trainer"],
    groups: [{ title: "Kinesiology and exercise science (common before PT school)", cips: ["3105"], levels: B }, { title: "Rehabilitation and therapy", cips: ["5123"], levels: [3, 5, 6] }, { title: "Speech and hearing", cips: ["5102"], levels: [3, 5] }],
    careers: ["pt", "ot", "slp"],
  },
  {
    id: "health-tech", label: "X-ray, sonography and respiratory therapy", words: ["x-ray", "radiology", "radiologic", "sonography", "ultrasound", "respiratory", "medical lab", "health technician"],
    groups: [{ title: "Medical imaging and respiratory therapy", cips: ["5109"], levels: [2, 3] }],
    careers: ["radtech", "resptherapist"],
  },
  {
    id: "public-health", label: "Public health and nutrition", words: ["public health", "nutrition", "dietitian", "health science"],
    groups: [{ title: "Public health", cips: ["5122"], levels: B }, { title: "Nutrition and dietetics", cips: ["5131"], levels: B }],
    careers: ["dietitian"],
  },
  {
    id: "computer-science", label: "Computer science and cybersecurity", words: ["computer", "computer science", "coding", "programming", "software", "cyber", "cybersecurity", "it", "information technology", "data science", "ai"],
    groups: [{ title: "Computer science", cips: ["1107"], levels: B }, { title: "IT and cybersecurity", cips: ["1110", "1101"], levels: [2, 3] }],
    careers: ["software", "cyber", "datasci"], checks: [ABET],
  },
  {
    id: "engineering", label: "Engineering", words: ["engineer", "engineering", "mechanical", "civil", "electrical", "aerospace", "biomedical engineering", "chemical engineering"],
    groups: [{ title: "Engineering (all kinds)", cips: ["1419", "1408", "1410", "1402", "1405", "1407", "1409", "1435", "1401"], levels: B }],
    careers: ["mecheng", "civileng", "eleceng"], checks: [ABET],
  },
  {
    id: "business", label: "Business, accounting and finance", words: ["business", "accounting", "accountant", "finance", "marketing", "management", "entrepreneur", "cpa"],
    groups: [{ title: "Business, accounting, finance and marketing", cips: ["5202", "5201", "5203", "5208", "5214"], levels: B }],
    careers: ["accountant", "finance", "marketing", "analyst"],
    checks: [{ label: "AACSB accredited business schools", url: "https://www.aacsb.edu/accredited" }],
  },
  {
    id: "education", label: "Teaching", words: ["teacher", "teaching", "education", "elementary", "early childhood", "special education"],
    groups: [{ title: "Teacher education", cips: ["1312", "1313", "1310", "1301"], levels: B }],
    careers: ["elemteacher", "hsteacher"],
    note: "Georgia teachers need a certificate from the Georgia Professional Standards Commission; education programs build this in.",
  },
  {
    id: "psychology", label: "Psychology and social work", words: ["psychology", "psychologist", "counselor", "counseling", "therapist", "social work", "social worker"],
    groups: [{ title: "Psychology", cips: ["4201", "4228"], levels: B }, { title: "Social work", cips: ["4407"], levels: B }],
    careers: ["psychologist", "socialworker"],
  },
  {
    id: "law", label: "Law and criminal justice", words: ["law", "lawyer", "attorney", "pre-law", "criminal justice", "police", "forensic", "paralegal", "political science"],
    groups: [{ title: "Criminal justice", cips: ["4301"], levels: [2, 3] }, { title: "Political science (common before law school)", cips: ["4510"], levels: B }, { title: "Law schools (JD)", cips: ["2201"], levels: [7] }],
    careers: ["lawyer", "paralegal", "police"],
  },
  {
    id: "science", label: "Biology and chemistry", words: ["biology", "chemistry", "biochemistry", "science", "genetics", "microbiology", "neuroscience"],
    groups: [{ title: "Biology", cips: ["2601", "2602", "2605", "2615"], levels: B }, { title: "Chemistry", cips: ["4005"], levels: B }],
    careers: ["chemist", "zoologist", "doctor"],
  },
  {
    id: "aviation", label: "Aviation and pilot", words: ["pilot", "aviation", "flying", "airline", "aircraft mechanic", "aviation maintenance"],
    groups: [{ title: "Pilot and aviation programs", cips: ["4901"], levels: [2, 3] }, { title: "Aircraft maintenance", cips: ["4706"], levels: [1, 2] }],
    careers: ["pilot", "aircraftmech"],
  },
  {
    id: "trades", label: "Skilled trades", words: ["trade", "trades", "mechanic", "automotive", "welding", "electrician", "hvac", "construction", "plumbing"],
    groups: [{ title: "Mechanics and repair", cips: ["4706", "4702", "4701"], levels: [1, 2] }, { title: "Construction trades", cips: ["4603", "4602"], levels: [1, 2] }, { title: "Welding and manufacturing", cips: ["4805"], levels: [1, 2] }],
    careers: ["automech", "electrician", "aircraftmech"],
    note: "Georgia's technical colleges teach most trades in a year or two, and HOPE Grant can cover tuition. Many trades also pay you to learn through an apprenticeship.",
  },
  {
    id: "art", label: "Art, design and media", words: ["art", "design", "graphic design", "animation", "film", "photography", "journalism", "communications"],
    groups: [{ title: "Art and design", cips: ["5004", "5007", "5006"], levels: B }, { title: "Communication and journalism", cips: ["0901", "0904", "0909"], levels: B }],
    careers: ["designer", "marketing"],
  },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Fields that match what was typed, best first. */
export function findFields(query: string): StudyField[] {
  const q = norm(query);
  if (!q) return [];
  const scored = FIELDS.map((f) => {
    let best = 0;
    for (const w of [f.label, ...f.words].map(norm)) {
      if (w === q) best = Math.max(best, 3);
      else if (w.startsWith(q) || q.startsWith(w + " ") || q.endsWith(" " + w)) best = Math.max(best, 2);
      else if (q.length >= 3 && (w.includes(q) || (w.length >= 4 && q.includes(w)))) best = Math.max(best, 1);
    }
    return { f, best };
  }).filter((x) => x.best > 0);
  return scored.sort((a, b) => b.best - a.best).map((x) => x.f);
}

/** A plain field made from any federal major name (for searches the list above doesn't cover). */
export function fieldFromMajor(cip: string, title: string): StudyField {
  return { id: `cip-${cip}`, label: title, words: [], groups: [{ title, cips: [cip], levels: [1, 2, 3] }], careers: [] };
}

// ------------------------------------------------------------ ranking

/** One college's numbers for one field group (rows for the group's majors added together). */
export interface ProgramFacts {
  collegeId: number;
  state: string;
  /** Graduates in this major per year. */
  grads: number;
  /** Median pay of this major's graduates, 1 and 4 years after finishing (federal data). */
  earn1: number | null;
  earn4: number | null;
  /** Median federal loan debt of this major's graduates. */
  debt: number | null;
  /** The college's overall graduation rate (0-1). */
  gradRate: number | null;
  satAvg: number | null;
}

export interface ScoreParts { size: number | null; finish: number | null; pay: number | null; debt: number | null; academics: number | null }
export interface RankedProgram<T extends ProgramFacts = ProgramFacts> { p: T; score: number; parts: ScoreParts; homeState: boolean }

/** What each part of the score counts for. Shown to families in plain words. */
export const SCORE_WEIGHTS: Record<keyof ScoreParts, number> = { size: 0.3, finish: 0.25, pay: 0.25, debt: 0.1, academics: 0.1 };
export const SCORE_EXPLAINED: Record<keyof ScoreParts, string> = {
  size: "How many students finish this major there each year (a bigger program usually means more classes, labs and professors in it)",
  finish: "How many students graduate from the college",
  pay: "What graduates of this major earn",
  debt: "How much they borrow compared with what they earn",
  academics: "Average SAT of admitted students",
};

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** Rank of x among values, 0 (lowest) to 1 (highest). */
function percentile(values: number[], x: number) {
  if (values.length <= 1) return 0.5;
  let below = 0, equal = 0;
  for (const v of values) { if (v < x) below++; else if (v === x) equal++; }
  return (below + (equal - 1) / 2) / (values.length - 1);
}

/**
 * Scores every college's program 0-100 using only federal data, comparing
 * colleges with each other for this major. Missing numbers are left out and
 * the other parts count for more. Home-state colleges are not boosted here;
 * the page shows them in their own list first.
 */
export function rankPrograms<T extends ProgramFacts>(programs: T[], homeState: string): RankedProgram<T>[] {
  const maxGrads = Math.max(1, ...programs.map((p) => p.grads));
  const pays = programs.map((p) => p.earn4 ?? p.earn1).filter((x): x is number => x != null);
  const out = programs.map((p) => {
    const pay = p.earn4 ?? p.earn1;
    const parts: ScoreParts = {
      size: Math.log(p.grads + 1) / Math.log(maxGrads + 1),
      finish: p.gradRate == null ? null : clamp(Number(p.gradRate)),
      pay: pay == null ? null : percentile(pays, pay),
      debt: p.debt == null || !(p.earn1 ?? p.earn4) ? null : clamp(1 - p.debt / (p.earn1 ?? p.earn4)!),
      academics: p.satAvg == null ? null : clamp((p.satAvg - 900) / 600),
    };
    let sum = 0, weight = 0;
    for (const k of Object.keys(SCORE_WEIGHTS) as (keyof ScoreParts)[]) {
      const v = parts[k];
      if (v == null) continue;
      sum += v * SCORE_WEIGHTS[k];
      weight += SCORE_WEIGHTS[k];
    }
    // Few numbers known: pull toward the middle so thin data can't top the list.
    const known = weight / 1;
    const raw = weight ? sum / weight : 0.5;
    const score = Math.round(100 * (raw * known + 0.5 * (1 - known)));
    return { p, score, parts, homeState: p.state === homeState };
  });
  return out.sort((a, b) => b.score - a.score || b.p.grads - a.p.grads);
}

/** Adds up program rows for the same college (a group can cover several majors). */
export function combinePrograms<R extends { college_id: number; grads: number; earn_1yr: number | null; earn_4yr: number | null; debt: number | null }>(rows: R[]) {
  const by = new Map<number, { rows: R[] }>();
  for (const r of rows) {
    const e = by.get(r.college_id) ?? { rows: [] };
    e.rows.push(r);
    by.set(r.college_id, e);
  }
  const wavg = (rs: R[], k: "earn_1yr" | "earn_4yr" | "debt") => {
    const v = rs.filter((r) => r[k] != null);
    const w = v.reduce((n, r) => n + r.grads, 0);
    return w ? Math.round(v.reduce((n, r) => n + r[k]! * r.grads, 0) / w) : null;
  };
  return [...by.entries()].map(([collegeId, { rows: rs }]) => ({
    collegeId,
    grads: rs.reduce((n, r) => n + r.grads, 0),
    earn1: wavg(rs, "earn_1yr"),
    earn4: wavg(rs, "earn_4yr"),
    debt: wavg(rs, "debt"),
    rows: rs,
  }));
}

/** "Fast to a job" or "highest pay" view of a field's careers. */
export function sortCareers(keys: string[], by: "pay" | "fast"): Career[] {
  const list = keys.map((k) => CAREERS[k]).filter((c): c is Career => !!c);
  return by === "pay" ? list.sort((a, b) => b.pay - a.pay) : list.sort((a, b) => a.level - b.level || b.pay - a.pay);
}
