# Writes practice_questions_more.sql: the big practice bank for every common
# US middle and high school class (math, sciences, social studies, English,
# world languages, electives). Data lives in practice_more/*.py:
#   base files: SUBJECT/MC/WRITTEN or SUBJECTS = {name: {"mc": [...], "written": [...]}}
#     mc = (topic, question, [correct first, wrong...], explanation)  -> level 2 (Core)
#     written = (topic, question, model answer)                         -> level 2
#   challenge_*.py: CHALLENGE = {name: [(level 3-5, topic, question, [correct first, ...], explanation)]}
# Answer order is shuffled here with a fixed seed (and again on screen).
# Everything loads as WAITING for teacher review at /admin/questions.
import glob, importlib.util, json, os, random

HERE = os.path.dirname(os.path.abspath(__file__))
rng = random.Random(20261108)

def load(path):
    spec = importlib.util.spec_from_file_location(os.path.basename(path)[:-3], path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

def q(s):
    assert '$q$' not in s
    return '$q$' + s + '$q$'

bank = {}  # subject -> list of (level, kind, topic, question, options, answer, model, explanation)
for path in sorted(glob.glob(os.path.join(HERE, "practice_more", "*.py"))):
    mod = load(path)
    if hasattr(mod, "CHALLENGE"):
        for subject, items in mod.CHALLENGE.items():
            for level, topic, question, options, expl in items:
                assert level in (3, 4, 5), question
                bank.setdefault(subject, []).append((level, "mc", topic, question, options, None, expl))
        continue
    subjects = getattr(mod, "SUBJECTS", None) or {mod.SUBJECT: {"mc": mod.MC, "written": mod.WRITTEN}}
    for subject, parts in subjects.items():
        for item in parts["mc"]:
            topic, question, options, expl = item[:4]
            level = item[4] if len(item) > 4 else 2
            bank.setdefault(subject, []).append((level, "mc", topic, question, options, None, expl))
        for topic, question, model in parts["written"]:
            bank.setdefault(subject, []).append((2, "written", topic, question, None, model, None))

rows, seen = [], set()
counts = {}
for subject in sorted(bank):
    assert len(subject) <= 60, subject
    for level, kind, topic, question, options, model, expl in bank[subject]:
        assert 2 <= len(topic) <= 60, topic
        key = (subject, question.strip().lower())
        assert key not in seen, f"duplicate in {subject}: {question}"
        seen.add(key)
        if kind == "mc":
            assert len(options) == 4 and len(set(options)) == 4, question
            right = options[0]
            opts = options[:]
            rng.shuffle(opts)
            ans = opts.index(right)
            rows.append(f"  ({q(subject)}, {q(topic)}, 'mc', {level}, {q(question)}, {q(json.dumps(opts, ensure_ascii=False))}::jsonb, {ans}, null, {q(expl)})")
        else:
            rows.append(f"  ({q(subject)}, {q(topic)}, 'written', {level}, {q(question)}, null, null, {q(model)}, null)")
        counts[subject] = counts.get(subject, 0) + 1

out = ["-- ScholarTasks practice bank for every common class, grades 6-12, written for ScholarTasks.",
"-- Levels: 1 Foundation, 2 Core, 3 Strong, 4 Advanced, 5 Expert.",
"-- Safe to run twice: questions already in the bank are skipped. All start as WAITING for teacher review at /admin/questions.",
"insert into practice_questions (subject, topic, kind, level, question, options, answer_index, model_answer, explanation, status)",
"select v.subject, v.topic, v.kind, v.level, v.question, v.options, v.answer_index, v.model_answer, v.explanation, 'pending' from (values",
",\n".join(rows),
") as v(subject, topic, kind, level, question, options, answer_index, model_answer, explanation)",
"where not exists (select 1 from practice_questions p where p.subject = v.subject and p.question = v.question);"]
open(os.path.join(HERE, "practice_questions_more.sql"), "w").write("\n".join(out) + "\n")
for s, n in counts.items(): print(f"{n:4} {s}")
print(len(rows), "questions in", len(counts), "subjects")
