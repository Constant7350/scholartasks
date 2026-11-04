"""Checks and cleans researched scholarship JSON before it goes in the seed.

Usage: python3 -I normalize.py IN.json OUT.json
Drops fields the database doesn't have, enforces types and allowed values,
and prints anything it had to fix or skip so a person can look.
"""
import json, re, sys

INTERESTS = {"STEM", "Health", "Business", "Education", "Arts", "Music", "Writing", "Sports",
             "Community service", "Leadership", "Government", "Trades", "Agriculture and animals"}
GROUPS = {"Black or African American", "Hispanic or Latino", "American Indian or Alaska Native",
          "Asian American or Pacific Islander", "Woman", "First-generation college student",
          "Military family", "Student with a disability", "Foster care experience"}
KEEP = ["kind", "name", "sponsor", "url", "summary", "how_to_apply", "amount_text", "amount_max", "deadline",
        "deadline_text", "scope", "grades", "min_gpa", "gpa_kind", "min_sat", "min_act", "max_income", "need_based",
        "citizen_required", "interests", "groups", "college_type", "college", "other_requirements", "automatic"]

def clean(e, notes):
    n = e.get("name", "?")
    out = {k: e.get(k) for k in KEEP}
    if out["kind"] not in ("scholarship", "grant"): out["kind"] = "scholarship"
    for k in ("name", "sponsor", "summary", "amount_text"):
        if not isinstance(out[k], str) or len(out[k].strip()) < 2:
            notes.append(f"SKIP {n}: missing {k}"); return None
        out[k] = out[k].strip()
    if not (isinstance(out["url"], str) and out["url"].startswith("https://")):
        notes.append(f"SKIP {n}: url not https"); return None
    out["summary"] = out["summary"][:1500]
    for k in ("how_to_apply", "other_requirements"):
        if out[k] is not None: out[k] = str(out[k]).strip()[:1000] or None
    if out["deadline_text"] is not None: out["deadline_text"] = str(out["deadline_text"])[:200]
    if out["amount_text"]: out["amount_text"] = out["amount_text"][:200]
    if out["deadline"] is not None and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(out["deadline"])):
        notes.append(f"fix {n}: bad deadline {out['deadline']}"); out["deadline"] = None
    if out["scope"] not in ("US", "GA"): out["scope"] = "US"
    g = out["grades"] if isinstance(out["grades"], list) else [12]
    g = sorted({int(x) for x in g if isinstance(x, (int, float)) and 6 <= int(x) <= 12}) or [12]
    out["grades"] = g
    for k, lo, hi in (("amount_max", 0, 1000000), ("min_sat", 400, 1600), ("min_act", 1, 36), ("max_income", 1, 10**7)):
        v = out[k]
        if v is not None and not (isinstance(v, (int, float)) and lo <= v <= hi):
            notes.append(f"fix {n}: {k}={v} dropped"); v = None
        out[k] = int(v) if v is not None else None
    if out["min_gpa"] is not None and not (isinstance(out["min_gpa"], (int, float)) and 0 < out["min_gpa"] <= 5):
        notes.append(f"fix {n}: min_gpa dropped"); out["min_gpa"] = None
    if out["gpa_kind"] not in ("hope", "unweighted", "weighted"): out["gpa_kind"] = None
    for k in ("need_based", "citizen_required", "automatic"): out[k] = bool(out[k])
    for k, allowed in (("interests", INTERESTS), ("groups", GROUPS)):
        v = [x for x in (out[k] or []) if x in allowed]
        bad = [x for x in (out[k] or []) if x not in allowed]
        if bad: notes.append(f"fix {n}: dropped {k} {bad}")
        out[k] = v or None
    if out["college_type"] not in ("any", "four_year", "technical"): out["college_type"] = "any"
    if out["college"] is not None: out["college"] = str(out["college"])[:200] or None
    return out

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    notes, seen, rows = [], set(), []
    for e in json.load(open(src)):
        c = clean(e, notes)
        if c and c["name"].lower() not in seen:
            seen.add(c["name"].lower()); rows.append(c)
    json.dump(rows, open(dst, "w"), indent=1, ensure_ascii=False)
    print(f"{src}: kept {len(rows)}")
    for x in notes: print("  ", x)
