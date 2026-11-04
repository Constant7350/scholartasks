// Downloads the U.S. Department of Education's College Scorecard data for
// every operating college that mainly awards bachelor's degrees, plus
// Georgia's two-year and technical colleges (HOPE Grant schools).
// Writes supabase/seed/colleges.json. Run by .github/workflows/college-data.yml
// once a year (new Scorecard data comes out each fall).
//
//   SCORECARD_API_KEY=... node scripts/colleges/fetch.mjs
// A free key comes from https://api.data.gov/signup/ ; DEMO_KEY works for a
// single run (about 25 requests).

import { writeFileSync } from "node:fs";

const KEY = process.env.SCORECARD_API_KEY || "DEMO_KEY";
const BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";
const LEVELS = ["0-30000", "30001-48000", "48001-75000", "75001-110000", "110001-plus"];
// Two-digit program families we match student interests against.
export const PROGRAMS = [
  "agriculture", "resources", "biological", "health", "engineering", "computer", "mathematics",
  "physical_science", "business_marketing", "education", "psychology", "social_science",
  "visual_performing", "communication", "english", "history", "parks_recreation_fitness",
  "security_law_enforcement", "public_administration_social_service", "architecture",
  "mechanic_repair_technology", "construction", "precision_production", "family_consumer_science",
  "language", "philosophy_religious", "legal", "military",
];

const FIELDS = [
  "id", "school.name", "school.city", "school.state", "school.school_url", "school.ownership",
  "school.degrees_awarded.predominant", "school.price_calculator_url",
  "latest.student.size", "latest.admissions.admission_rate.overall",
  "latest.admissions.sat_scores.average.overall", "latest.admissions.act_scores.midpoint.cumulative",
  "latest.cost.tuition.in_state", "latest.cost.tuition.out_of_state", "latest.cost.attendance.academic_year",
  "latest.cost.avg_net_price.public", "latest.cost.avg_net_price.private",
  ...LEVELS.flatMap((l) => [`latest.cost.net_price.public.by_income_level.${l}`, `latest.cost.net_price.private.by_income_level.${l}`]),
  "latest.completion.completion_rate_4yr_150nt", "latest.earnings.10_yrs_after_entry.median",
  "latest.aid.median_debt.completers.overall",
  ...PROGRAMS.map((p) => `latest.academics.program_percentage.${p}`),
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(query, n) {
  const qs = new URLSearchParams({ ...query, api_key: KEY, _fields: FIELDS.join(","), _per_page: "100", page: String(n) });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}?${qs}`);
    if (res.ok) return res.json();
    const text = await res.text();
    if (attempt >= 4) throw new Error(`Scorecard ${res.status}: ${text.slice(0, 300)}`);
    console.log(`retry ${attempt} after ${res.status}`);
    await sleep(5000 * attempt);
  }
}

async function all(query) {
  const out = [];
  for (let n = 0; ; n++) {
    const body = await page(query, n);
    out.push(...body.results);
    console.log(`${JSON.stringify(query)} page ${n}: ${body.results.length} (total ${body.metadata.total})`);
    if (out.length >= body.metadata.total || body.results.length === 0) break;
    await sleep(1500);
  }
  return out;
}

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const round = (v, d = 3) => (num(v) === null ? null : Number(Number(v).toFixed(d)));

const bachelors = await all({ "school.operating": "1", "school.degrees_awarded.predominant": "3" });
const gaTwoYear = await all({ "school.operating": "1", "school.state": "GA", "school.degrees_awarded.predominant": "2" });
console.log("sample record:", JSON.stringify(bachelors[0]));

const seen = new Set();
const rows = [];
for (const r of [...bachelors, ...gaTwoYear]) {
  if (seen.has(r.id)) continue;
  seen.add(r.id);
  const pub = r["school.ownership"] === 1;
  const net = LEVELS.map((l) => num(r[`latest.cost.net_price.${pub ? "public" : "private"}.by_income_level.${l}`]));
  const programs = Object.fromEntries(PROGRAMS.map((p) => [p, round(r[`latest.academics.program_percentage.${p}`])]).filter(([, v]) => v && v > 0));
  rows.push({
    id: r.id,
    name: r["school.name"],
    city: r["school.city"],
    state: r["school.state"],
    url: r["school.school_url"],
    calc: r["school.price_calculator_url"],
    own: r["school.ownership"],
    deg: r["school.degrees_awarded.predominant"],
    size: num(r["latest.student.size"]),
    adm: round(r["latest.admissions.admission_rate.overall"]),
    sat: num(r["latest.admissions.sat_scores.average.overall"]),
    act: num(r["latest.admissions.act_scores.midpoint.cumulative"]),
    tin: num(r["latest.cost.tuition.in_state"]),
    tout: num(r["latest.cost.tuition.out_of_state"]),
    coa: num(r["latest.cost.attendance.academic_year"]),
    avgnet: num(r[`latest.cost.avg_net_price.${pub ? "public" : "private"}`]),
    net,
    grad: round(r["latest.completion.completion_rate_4yr_150nt"]),
    earn: num(r["latest.earnings.10_yrs_after_entry.median"]),
    debt: num(r["latest.aid.median_debt.completers.overall"]),
    prog: programs,
  });
}
rows.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
writeFileSync("supabase/seed/colleges.json", JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: "U.S. Department of Education College Scorecard", rows }) + "\n");
console.log(`wrote ${rows.length} colleges`);
const missing = Object.fromEntries(["coa", "tin", "adm", "grad", "earn"].map((k) => [k, rows.filter((r) => r[k] === null).length]));
console.log("missing values:", JSON.stringify(missing));
console.log("programs filled:", rows.filter((r) => Object.keys(r.prog).length).length);
