// Downloads the College Scorecard "field of study" data: for every college in
// supabase/seed/colleges.json, each major (4-digit CIP code) with how many
// students finished it, what graduates of that major earn, and their typical
// federal loan debt. Writes supabase/seed/college_programs.json.
// Run by .github/workflows/college-data.yml (choose "programs" or "both").
//
//   SCORECARD_API_KEY=... node scripts/colleges/fetch-programs.mjs
//
// Kept: associate's (level 2), bachelor's (3) and first professional
// degrees (7: veterinary medicine, pharmacy, medicine, law ...), only programs
// that awarded at least one degree.

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.SCORECARD_API_KEY || "DEMO_KEY";
const BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";
const KEEP_LEVELS = new Set([2, 3, 7]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

const { rows: colleges } = JSON.parse(readFileSync("supabase/seed/colleges.json", "utf8"));
const wanted = new Set(colleges.map((c) => c.id));

/** Flattens a nested object to {"a.b.c": value}. */
function flat(o, pre = "", out = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flat(v, key, out);
    else out[key] = v;
  }
  return out;
}
/** First non-null value whose key matches one of the patterns, in order. */
function pick(f, patterns) {
  for (const re of patterns) {
    for (const [k, v] of Object.entries(f)) if (re.test(k) && num(v) !== null) return num(v);
  }
  return null;
}

async function page(query, n) {
  const qs = new URLSearchParams({ ...query, api_key: KEY, _fields: "id,latest.programs.cip_4_digit", _per_page: "50", page: String(n) });
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}?${qs}`);
    if (res.ok) return res.json();
    const text = await res.text();
    if (attempt >= 6) throw new Error(`Scorecard ${res.status}: ${text.slice(0, 300)}`);
    const wait = res.status === 429 ? 65000 * attempt : 5000 * attempt;
    console.log(`retry ${attempt} after ${res.status}, waiting ${wait / 1000}s`);
    await sleep(wait);
  }
}

async function all(query) {
  const out = [];
  for (let n = 0; ; n++) {
    const body = await page(query, n);
    out.push(...body.results);
    console.log(`${JSON.stringify(query)} page ${n}: ${body.results.length} (total ${body.metadata.total})`);
    if (out.length >= body.metadata.total || body.results.length === 0) break;
    await sleep(KEY === "DEMO_KEY" ? 6500 : 700);
  }
  return out;
}

const schools = [
  ...(await all({ "school.operating": "1", "school.degrees_awarded.predominant": "3" })),
  ...(await all({ "school.operating": "1", "school.state": "GA", "school.degrees_awarded.predominant": "2" })),
];

let shown = false;
const titles = {};
const out = [];
const seen = new Set();
for (const s of schools) {
  if (!wanted.has(s.id)) continue;
  const progs = s["latest.programs.cip_4_digit"] ?? s.latest?.programs?.cip_4_digit ?? [];
  if (!shown && progs.length) {
    console.log("sample program:", JSON.stringify(progs[0]));
    console.log("sample keys:", Object.keys(flat(progs[0])).join(" "));
    shown = true;
  }
  for (const p of progs) {
    const f = flat(p);
    const level = num(f["credential.level"]);
    if (!KEEP_LEVELS.has(level)) continue;
    const code = String(f.code ?? "").replace(/\D/g, "").padStart(4, "0").slice(0, 4);
    if (code.length !== 4) continue;
    const grads = pick(f, [/counts\.ipeds_awards2$/, /counts\.ipeds_awards1$/]);
    if (!grads) continue;
    const key = `${s.id}:${code}:${level}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (f.title && !titles[code]) titles[code] = String(f.title).replace(/\.$/, "").trim();
    const earn1 = pick(f, [/earnings\.(highest\.)?1_yr\.overall_median_earnings$/, /1_yr.*median_earnings$/]);
    const earn4 = pick(f, [/earnings\.(highest\.)?4_yr\.overall_median_earnings$/, /earnings\.(highest\.)?3_yr\.overall_median_earnings$/, /earnings\.(highest\.)?2_yr\.overall_median_earnings$/]);
    const debt = pick(f, [/debt\.staff_grad_plus\.all\.eval_inst\.median$/, /debt\.staff_grad_plus\.all\.all_inst\.median$/, /debt\..*\.median$/]);
    out.push([s.id, code, level, grads, earn1, earn4, debt]);
  }
}
out.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2]);
writeFileSync("supabase/seed/college_programs.json", JSON.stringify({
  fetched: new Date().toISOString().slice(0, 10),
  source: "U.S. Department of Education College Scorecard, field of study data",
  columns: ["college_id", "cip4", "level", "grads", "earn_1yr", "earn_4yr", "debt"],
  titles,
  rows: out,
}) + "\n");
console.log(`wrote ${out.length} programs at ${new Set(out.map((r) => r[0])).size} colleges, ${Object.keys(titles).length} fields`);
console.log("with earnings:", out.filter((r) => r[4] || r[5]).length, "with debt:", out.filter((r) => r[6]).length);
console.log("levels:", JSON.stringify(Object.fromEntries([2, 3, 7].map((l) => [l, out.filter((r) => r[2] === l).length]))));
