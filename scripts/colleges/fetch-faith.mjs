// Downloads each college's religious affiliation from the U.S. Department of
// Education's College Scorecard (school.religious_affiliation, the IPEDS
// RELAFFIL code) so families can search Christian colleges and universities.
// Writes supabase/seed/college_faith.json as { id: code } for every college
// in supabase/seed/colleges.json that reports one. Run by
// .github/workflows/college-data.yml (what = faith, or with colleges/both).
//
//   SCORECARD_API_KEY=... node scripts/colleges/fetch-faith.mjs

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.SCORECARD_API_KEY || "DEMO_KEY";
const BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(deg, n) {
  const qs = new URLSearchParams({
    api_key: KEY, "school.operating": "1", "school.degrees_awarded.predominant": deg,
    _fields: "id,school.religious_affiliation", _per_page: "100", page: String(n),
  });
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

const ours = new Set(JSON.parse(readFileSync("supabase/seed/colleges.json", "utf8")).rows.map((r) => r.id));
const faith = {};
for (const deg of ["3", "2", "1"]) {
  let got = 0;
  for (let n = 0; ; n++) {
    const body = await page(deg, n);
    for (const r of body.results) {
      const code = Number(r["school.religious_affiliation"]);
      if (ours.has(r.id) && Number.isInteger(code) && code > 0) faith[r.id] = code;
    }
    got += body.results.length;
    if (got >= body.metadata.total || body.results.length === 0) break;
    await sleep(KEY === "DEMO_KEY" ? 6500 : 800);
  }
  console.log(`degree ${deg}: ${got} schools read`);
}
const sorted = Object.fromEntries(Object.entries(faith).sort(([a], [b]) => Number(a) - Number(b)));
writeFileSync("supabase/seed/college_faith.json", JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), source: "U.S. Department of Education College Scorecard (religious affiliation)", faith: sorted }) + "\n");
console.log(`wrote ${Object.keys(sorted).length} colleges with a religious affiliation`);
