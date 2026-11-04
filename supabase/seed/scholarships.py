"""Starter scholarship list for ScholarTasks (Georgia + national).

Run: python3 supabase/seed/scholarships.py  -> writes scholarships.sql next to it.
Every entry starts as 'pending' (shown to families as "Not yet verified") until
a team member checks it against the sponsor's site at /admin/scholarships.
Exact deadlines are left empty on purpose: they change every year, and the
AI checker fills them in for a person to approve.
"""
import json

S = []
def add(**k):
    S.append(k)

# ---------- Georgia ----------
add(name="HOPE Scholarship", sponsor="Georgia Student Finance Commission", url="https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/hope-scholarship/",
    summary="Georgia's merit scholarship for students who graduate from high school with a 3.0 HOPE GPA. It pays part of tuition at Georgia public colleges, or a set amount at eligible private Georgia colleges.",
    how_to_apply="No separate application: complete the FAFSA (or Georgia's GSFAPP) during senior year. Your HOPE GPA is calculated by the state.",
    amount_text="Part of tuition at Georgia public colleges (set amount at private Georgia colleges)", scope="GA", grades=[12],
    min_gpa=3.0, gpa_kind="hope", automatic=True, college_type="four_year", deadline_text="Complete the FAFSA or GSFAPP in senior year")
add(name="Zell Miller Scholarship", sponsor="Georgia Student Finance Commission", url="https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/zell-miller-scholarship/",
    summary="Georgia's top merit scholarship. Covers full tuition at Georgia public colleges for students with a 3.7 HOPE GPA and a qualifying SAT or ACT score (valedictorians and salutatorians also qualify). Keep it in college with a 3.3 college GPA.",
    how_to_apply="No separate application: complete the FAFSA or GSFAPP. Send your SAT or ACT score to your college.",
    amount_text="Full tuition at Georgia public colleges", scope="GA", grades=[12],
    min_gpa=3.7, gpa_kind="hope", min_sat=1200, min_act=25, automatic=True, college_type="four_year", deadline_text="Complete the FAFSA or GSFAPP in senior year")
add(kind="grant", name="HOPE Grant", sponsor="Georgia Student Finance Commission", url="https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-grants/hope-grant/",
    summary="Helps Georgia residents pay for a certificate or diploma program at a Georgia technical college. There is no high school GPA requirement to start.",
    how_to_apply="Complete the FAFSA or GSFAPP and enroll in an eligible technical college program.",
    amount_text="Part of tuition for technical college certificate and diploma programs", scope="GA", grades=[12],
    automatic=True, college_type="technical", deadline_text="Before your first technical college term")
add(kind="grant", name="Georgia Tuition Equalization Grant", sponsor="Georgia Student Finance Commission", url="https://www.gafutures.org/hope-state-aid-programs/grants/georgia-tuition-equalization-grant/",
    summary="A yearly grant for Georgia residents who attend an eligible private college in Georgia full time. Not based on grades or income.",
    how_to_apply="Usually requested through the private college's financial aid office (GSFAPP or the college's form).",
    amount_text="A yearly grant toward private Georgia college costs (amount set each year)", scope="GA", grades=[12],
    college_type="four_year", deadline_text="Ask the private college's aid office")
add(name="REACH Georgia Scholarship", sponsor="Georgia Student Finance Commission", url="https://www.gafutures.org/hope-state-aid-programs/scholarships/reach-georgia-scholarship/",
    summary="A needs-based mentoring and scholarship program. Schools select students in 7th or 8th grade; students who keep their grades up, stay out of trouble and meet with a mentor through high school earn college money.",
    how_to_apply="Ask your middle school counselor whether your school takes part and how students are chosen.",
    amount_text="Up to $10,000 (some partner colleges add more)", amount_max=10000, scope="GA", grades=[8],
    need_based=True, deadline_text="Chosen by participating schools in 7th or 8th grade")

# ---------- National ----------
add(name="Coca-Cola Scholars Program", sponsor="Coca-Cola Scholars Foundation", url="https://www.coca-colascholarsfoundation.org/apply/",
    summary="Awards 150 seniors each year for leadership and service in their school and community. Not based on financial need.",
    how_to_apply="Online application in late summer of senior year, then semifinalist essays and interviews.",
    amount_text="$20,000", amount_max=20000, grades=[12], min_gpa=3.0, gpa_kind="unweighted", citizen_required=True,
    interests=None, deadline_text="Usually September 30 of senior year")
add(name="The Gates Scholarship", sponsor="Gates Foundation", url="https://www.thegatesscholarship.org/scholarship",
    summary="Covers the full cost of college not paid by other aid for outstanding minority seniors from low-income families who show leadership.",
    how_to_apply="Online application in summer of senior year. Must be Pell Grant eligible.",
    amount_text="Full cost of attendance not covered by other aid", grades=[12], min_gpa=3.3, gpa_kind="weighted",
    need_based=True, citizen_required=True,
    groups=["Black or African American", "Hispanic or Latino", "American Indian or Alaska Native", "Asian American or Pacific Islander"],
    deadline_text="Usually mid-September of senior year")
add(name="Jack Kent Cooke Foundation College Scholarship", sponsor="Jack Kent Cooke Foundation", url="https://www.jkcf.org/our-scholarships/college-scholarship-program/",
    summary="One of the largest scholarships for high-achieving seniors with financial need, plus advising throughout college.",
    how_to_apply="Online application in fall of senior year with essays, transcript and recommendations.",
    amount_text="Up to $55,000 per year", amount_max=55000, grades=[12], min_gpa=3.5, gpa_kind="unweighted", max_income=95000,
    deadline_text="Usually mid-November of senior year")
add(name="QuestBridge National College Match", sponsor="QuestBridge", url="https://www.questbridge.org/high-school-students/national-college-match",
    summary="Matches high-achieving seniors from low-income families with full four-year scholarships at partner colleges.",
    how_to_apply="Online application in late summer and early fall of senior year. Most finalists come from families earning under about $65,000 for a family of four, but there is no strict cutoff.",
    amount_text="Full four-year scholarship at a partner college", grades=[12], need_based=True, college_type="four_year",
    deadline_text="Usually late September of senior year")
add(name="Elks Most Valuable Student", sponsor="Elks National Foundation", url="https://www.elks.org/scholars/scholarships/mvs.cfm",
    summary="Judged on scholarship, leadership and financial need. 500 awards each year, plus local Elks lodge awards.",
    how_to_apply="Online application in fall of senior year, judged first by your local Elks lodge.",
    amount_text="$4,000 to $50,000 over four years", amount_max=50000, grades=[12], citizen_required=True, need_based=True,
    deadline_text="Usually mid-November of senior year")
add(name="Burger King Scholars", sponsor="Burger King Foundation", url="https://burgerkingfoundation.org/programs/burger-king-scholars",
    summary="Awards for students with good grades who work part time, volunteer or take part in activities.",
    how_to_apply="Online application, usually open October to December.",
    amount_text="$1,000 to $60,000", amount_max=60000, grades=[12], min_gpa=2.5, gpa_kind="unweighted",
    deadline_text="Usually mid-December")
add(name="Dell Scholars Program", sponsor="Michael & Susan Dell Foundation", url="https://www.dellscholars.org/scholarship/",
    summary="For Pell-eligible students who have pushed through challenges to stay on track for college. Includes a laptop, textbook money and coaching.",
    how_to_apply="Online application in winter of senior year. Must be Pell Grant eligible.",
    amount_text="$20,000 plus a laptop and support", amount_max=20000, grades=[12], min_gpa=2.4, gpa_kind="unweighted", need_based=True,
    citizen_required=True, deadline_text="Usually December 1")
add(name="Horatio Alger National Scholarship", sponsor="Horatio Alger Association", url="https://scholars.horatioalger.org/about-our-scholarship-programs/",
    summary="For students who have faced and overcome great obstacles and have critical financial need. There are also state awards, including Georgia.",
    how_to_apply="Online application in fall of senior year.",
    amount_text="$25,000 national award (state awards are smaller)", amount_max=25000, grades=[12], min_gpa=2.0, gpa_kind="unweighted",
    max_income=65000, citizen_required=True, deadline_text="Usually late October")
add(name="Ron Brown Scholar Program", sponsor="Ron Brown Scholar Fund", url="https://ronbrown.org/section/apply/",
    summary="For Black high school seniors who excel in school and want to make a difference in their community.",
    how_to_apply="Online application with essays and recommendations.",
    amount_text="$40,000 ($10,000 a year)", amount_max=40000, grades=[12], citizen_required=True,
    groups=["Black or African American"], interests=["Community service", "Leadership"], deadline_text="Usually early January (earlier for the first round)")
add(name="Hispanic Scholarship Fund", sponsor="Hispanic Scholarship Fund", url="https://www.hsf.net/scholarship",
    summary="Scholarships and support for students of Hispanic heritage heading to a four-year college.",
    how_to_apply="Online application, usually open January to mid-February. Requires the FAFSA.",
    amount_text="$500 to $5,000", amount_max=5000, grades=[12], min_gpa=3.0, gpa_kind="unweighted",
    groups=["Hispanic or Latino"], college_type="four_year", deadline_text="Usually mid-February")
add(name="National Merit Scholarship Program", sponsor="National Merit Scholarship Corporation", url="https://www.nationalmerit.org/s/1758/interior.aspx?sid=1758&gid=2&pgid=424",
    summary="Students enter by taking the PSAT/NMSQT in 11th grade. Top scorers in each state can become Semifinalists and compete for National Merit, corporate and college-sponsored awards.",
    how_to_apply="Take the PSAT/NMSQT at your school in October of 11th grade. Practicing in 10th grade helps.",
    amount_text="$2,500 National Merit Scholarships, plus corporate and college awards", grades=[11], citizen_required=True,
    deadline_text="PSAT/NMSQT in October of 11th grade")
add(name="Regeneron Science Talent Search", sponsor="Society for Science", url="https://www.societyforscience.org/regeneron-sts/",
    summary="The oldest science and math research competition for high school seniors. Finalists present original research.",
    how_to_apply="Online application with a full research report, usually due in November of senior year.",
    amount_text="Awards from $2,000 to $250,000", amount_max=250000, grades=[12], interests=["STEM"],
    deadline_text="Usually mid-November of senior year")
add(name="Cameron Impact Scholarship", sponsor="Bryan Cameron Education Foundation", url="https://www.bryancameroneducationfoundation.org/cameron-impact-scholarship",
    summary="Full-tuition, four-year scholarship for seniors with strong grades and a record of leadership and service.",
    how_to_apply="Online application in late summer of senior year.",
    amount_text="Full tuition for four years", grades=[12], min_gpa=3.7, gpa_kind="unweighted", citizen_required=True,
    interests=["Community service", "Leadership"], college_type="four_year", deadline_text="Usually September of senior year")
add(name="Taco Bell Live Más Scholarship", sponsor="Taco Bell Foundation", url="https://www.tacobellfoundation.org/live-mas-scholarship/",
    summary="Not based on grades or test scores: students make a short video about their passion and how they'll pursue it.",
    how_to_apply="Submit a short original video online. Open to ages 16 to 26.",
    amount_text="$5,000 to $25,000", amount_max=25000, grades=[11, 12], deadline_text="Usually January")
add(name="Equitable Excellence Scholarship", sponsor="Equitable Foundation", url="https://equitable.com/foundation/equitable-excellence-scholarship",
    summary="For seniors who show ambition and drive, judged on an essay about making a difference.",
    how_to_apply="Online application in fall of senior year.",
    amount_text="$2,500 to $25,000", amount_max=25000, grades=[12], citizen_required=True, deadline_text="Usually mid-December")
add(name="United States Senate Youth Program", sponsor="The Hearst Foundations", url="https://www.ussenateyouth.org/",
    summary="Two students per state who serve in elected student government spend a week in Washington and receive a college scholarship.",
    how_to_apply="Chosen through the Georgia Department of Education; ask your school counselor. Open to juniors and seniors in student government.",
    amount_text="$10,000 plus a week in Washington, D.C.", amount_max=10000, grades=[11, 12], citizen_required=True,
    interests=["Government", "Leadership"], deadline_text="Usually early fall (set by the state)")
add(name="Scholastic Art & Writing Awards", sponsor="Alliance for Young Artists & Writers", url="https://www.artandwriting.org/",
    summary="The longest-running recognition program for creative teens in grades 7 to 12. Top national winners can earn scholarships.",
    how_to_apply="Submit art or writing through your region, usually December to January.",
    amount_text="Recognition, plus scholarships up to $12,500 for top seniors", amount_max=12500, grades=[8, 9, 10, 11, 12],
    interests=["Arts", "Writing"], deadline_text="Usually December to January")
add(name="Davidson Fellows Scholarship", sponsor="Davidson Institute", url="https://www.davidsongifted.org/gifted-programs/fellows-scholarship/",
    summary="For students 18 or younger who have completed a significant piece of work in science, technology, engineering, math, literature, music or philosophy.",
    how_to_apply="Online application with the project and supporting materials.",
    amount_text="$10,000, $25,000 or $50,000", amount_max=50000, grades=[8, 9, 10, 11, 12], citizen_required=True,
    interests=["STEM", "Writing", "Music"], deadline_text="Usually February")

# Researched entries (one JSON file per area), checked against official sites.
import glob, os
FIELDS = None
for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "scholarships", "*.json"))):
    for e in json.load(open(f)):
        S.append(e)

COLS = ["kind", "name", "sponsor", "url", "summary", "how_to_apply", "amount_text", "amount_max", "deadline_text", "scope", "grades",
        "min_gpa", "gpa_kind", "min_sat", "min_act", "max_income", "need_based", "citizen_required", "interests", "groups",
        "college_type", "college", "other_requirements", "automatic"]

def lit(v, col):
    if v is None:
        return {"amount_max": "null::int", "min_gpa": "null::numeric", "min_sat": "null::int", "min_act": "null::int",
                "max_income": "null::int", "interests": "null::text[]", "groups": "null::text[]"}.get(col, "null")
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        if all(isinstance(x, int) for x in v):
            return "'{" + ",".join(map(str, v)) + "}'::int[]"
        return "array[" + ",".join(q(x) for x in v) + "]::text[]"
    return q(v)

def q(s):
    assert "$s$" not in s
    return "$s$" + s + "$s$"

DEFAULTS = {"kind": "scholarship", "scope": "US", "need_based": False, "citizen_required": False, "college_type": "any", "automatic": False}
rows, seen = [], set()
for e in S:
    if e["name"].lower() in seen:
        continue
    seen.add(e["name"].lower())
    assert e["url"].startswith("https://"), e["name"]
    vals = [lit(e.get(c, DEFAULTS.get(c)), c) for c in COLS]
    rows.append("  (" + ", ".join(vals) + ")")

out = [
    "-- ScholarTasks starter scholarships (Georgia + national), written for ScholarTasks.",
    "-- Safe to run twice: scholarships already in the list are skipped. All start as NOT YET VERIFIED",
    "-- until a team member checks them at /admin/scholarships.",
    f"insert into scholarships ({', '.join(COLS)}, status)",
    f"select {', '.join('v.' + c for c in COLS)}, 'pending' from (values",
    ",\n".join(rows),
    f") as v({', '.join(COLS)})",
    "where not exists (select 1 from scholarships s where s.name = v.name);",
]
open(__file__.replace(".py", ".sql"), "w").write("\n".join(out) + "\n")
print(len(rows))
