// The Spanish word list: English line -> Spanish, one file per part of the app.
// Lines come from lib/i18n/lines.json (scripts/i18n/extract.mjs). Keep every
// {name} and <1>tag</1> of the English in the Spanish.
import type { Dict } from "../core";
import site from "./site.json";
import shared from "./shared.json";
import start from "./start.json";
import aid from "./aid.json";
import scholarships from "./scholarships.json";
import plan from "./plan.json";
import grades from "./grades.json";
import study from "./study.json";
import activities from "./activities.json";
import colleges from "./colleges.json";
import more from "./more.json";
import help from "./help.json";
import school from "./school.json";
import careers from "./careers.json";
import jobs from "./jobs.json";
import consent from "./consent.json";
import parent from "./parent.json";
import challenge from "./challenge.json";

export const ES: Dict = { ...challenge, ...parent, ...consent, ...jobs, ...careers, ...help, ...site, ...more, ...school, ...study, ...activities, ...colleges, ...grades, ...plan, ...scholarships, ...aid, ...start, ...shared };
