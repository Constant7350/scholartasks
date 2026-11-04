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
    if (attempt >= 6) throw new Error(`Scorecard ${res.status}: ${text.slice(0, 300)}`);
    // DEMO_KEY allows only a few requests a minute: wait a full minute and more.
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
    await sleep(KEY === "DEMO_KEY" ? 6500 : 1000);
  }
  return out;
}

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const round = (v, d = 3) => (num(v) === null ? null : Number(Number(v).toFixed(d)));

// With an api.data.gov key, use the API. Without one, download the Scorecard's
// published "Most Recent Institution-Level Data" file instead (no key needed)
// and turn its columns into the same shape as the API's.

async function fromApi() {
  const bachelors = await all({ "school.operating": "1", "school.degrees_awarded.predominant": "3" });
  const gaTwoYear = await all({ "school.operating": "1", "school.state": "GA", "school.degrees_awarded.predominant": "2" });
  return [...bachelors, ...gaTwoYear];
}

// Two-digit CIP families in the bulk file (PCIPxx) for each API program name.
const CIP = {
  agriculture: "01", resources: "03", biological: "26", health: "51", engineering: "14", computer: "11", mathematics: "27",
  physical_science: "40", business_marketing: "52", education: "13", psychology: "42", social_science: "45",
  visual_performing: "50", communication: "09", english: "23", history: "54", parks_recreation_fitness: "31",
  security_law_enforcement: "43", public_administration_social_service: "44", architecture: "04",
  mechanic_repair_technology: "47", construction: "46", precision_production: "48", family_consumer_science: "19",
  language: "16", philosophy_religious: "38", legal: "22", military: "29",
};

/** A small CSV reader (quoted fields, commas and newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function findBulkUrl() {
  if (process.env.SCORECARD_FILE_URL) return process.env.SCORECARD_FILE_URL;
  for (const page of ["https://collegescorecard.ed.gov/data/", "https://collegescorecard.ed.gov/data/documentation/"]) {
    const res = await fetch(page).catch(() => null);
    if (!res?.ok) continue;
    const html = await res.text();
    const m = html.match(/https?:\/\/[^"'\s)]*Most-Recent-Cohorts-Institution[^"'\s)]*\.zip/i);
    if (m) return m[0];
    console.log(`no institution file link on ${page}; links seen:`, [...html.matchAll(/https?:\/\/[^"'\s)]+\.zip/gi)].map((x) => x[0]).slice(0, 10));
  }
  throw new Error("Couldn't find the Scorecard data file. Set SCORECARD_API_KEY or SCORECARD_FILE_URL.");
}

async function fromBulkFile() {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, readdirSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const url = await findBulkUrl();
  console.log("downloading", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const dir = mkdtempSync(join(tmpdir(), "scorecard-"));
  const buf = Buffer.from(await res.arrayBuffer());
  let csvText;
  if (/\.zip$/i.test(url)) {
    writeFileSync(join(dir, "data.zip"), buf);
    execFileSync("unzip", ["-q", "-o", join(dir, "data.zip"), "-d", dir]);
    const csv = readdirSync(dir, { recursive: true }).map(String).find((f) => /Most-Recent-Cohorts-Institution.*\.csv$/i.test(f) || /\.csv$/i.test(f));
    if (!csv) throw new Error("no CSV in the download");
    csvText = readFileSync(join(dir, csv), "utf8");
  } else csvText = buf.toString("utf8");
  const [head, ...lines] = parseCsv(csvText);
  const ix = Object.fromEntries(head.map((h, i) => [h.replace(/^\uFEFF/, "").trim(), i]));
  console.log(`${lines.length} rows in file`);
  const get = (r, col) => {
    const v = r[ix[col]];
    return v === undefined || v === "" || v === "NULL" || v === "PrivacySuppressed" ? null : v;
  };
  const out = [];
  for (const r of lines) {
    if (get(r, "CURROPER") !== "1") continue;
    const deg = Number(get(r, "PREDDEG"));
    const st = get(r, "STABBR");
    if (!(deg === 3 || (deg === 2 && st === "GA"))) continue;
    const rec = {
      id: Number(get(r, "UNITID")), "school.name": get(r, "INSTNM"), "school.city": get(r, "CITY"), "school.state": st,
      "school.school_url": get(r, "INSURL"), "school.ownership": Number(get(r, "CONTROL")),
      "school.degrees_awarded.predominant": deg, "school.price_calculator_url": get(r, "NPCURL"),
      "latest.student.size": get(r, "UGDS"), "latest.admissions.admission_rate.overall": get(r, "ADM_RATE"),
      "latest.admissions.sat_scores.average.overall": get(r, "SAT_AVG"), "latest.admissions.act_scores.midpoint.cumulative": get(r, "ACTCMMID"),
      "latest.cost.tuition.in_state": get(r, "TUITIONFEE_IN"), "latest.cost.tuition.out_of_state": get(r, "TUITIONFEE_OUT"),
      "latest.cost.attendance.academic_year": get(r, "COSTT4_A"),
      "latest.cost.avg_net_price.public": get(r, "NPT4_PUB"), "latest.cost.avg_net_price.private": get(r, "NPT4_PRIV"),
      "latest.completion.completion_rate_4yr_150nt": get(r, "C150_4"), "latest.earnings.10_yrs_after_entry.median": get(r, "MD_EARN_WNE_P10"),
      "latest.aid.median_debt.completers.overall": get(r, "GRAD_DEBT_MDN"),
    };
    LEVELS.forEach((l, i) => {
      rec[`latest.cost.net_price.public.by_income_level.${l}`] = get(r, `NPT4${i + 1}_PUB`);
      rec[`latest.cost.net_price.private.by_income_level.${l}`] = get(r, `NPT4${i + 1}_PRIV`);
    });
    for (const p of PROGRAMS) rec[`latest.academics.program_percentage.${p}`] = get(r, `PCIP${CIP[p]}`);
    out.push(rec);
  }
  return out;
}

const records = process.env.SCORECARD_API_KEY ? await fromApi() : await fromBulkFile();
console.log("sample record:", JSON.stringify(records[0]));

const seen = new Set();
const rows = [];
for (const r of records) {
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
