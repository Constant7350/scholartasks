// Copies the college and majors data into the website's public folder at build
// time, so the team's "Load college data" page (/admin/college-data) can load
// it into the database with one tap. The data is public federal data.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "apps", "web", "public", "data");
mkdirSync(out, { recursive: true });
for (const f of ["colleges.json", "college_programs.json"]) copyFileSync(join(root, "supabase", "seed", f), join(out, f));
console.log("copied college data to apps/web/public/data");
