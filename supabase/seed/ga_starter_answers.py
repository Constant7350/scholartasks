# Writes ga_starter_answers.sql: Georgia FAQs rewritten in our own words, loaded into the answer library as pending for staff review.
faqs = [
("What is the HOPE Scholarship?",
"""The HOPE Scholarship is Georgia's merit scholarship, paid for by the Georgia Lottery. It covers part of tuition at Georgia public colleges, and a fixed amount per term at eligible private Georgia colleges.

To qualify out of high school you need:
- A 3.0 HOPE GPA, which the state (GSFC) calculates from your core classes
- 4 academic rigor courses
- Georgia residency, and U.S. citizenship or eligible non-citizen status

It pays toward tuition only, not fees or books. Award amounts change every year, so check the current rates on GAfutures.org.

Sources: [GSFC HOPE program summary](https://gsfc.georgia.gov/document/document/fy22hope-program-summarydigitalpdf/download), [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs)"""),
("What is the Zell Miller Scholarship?",
"""Zell Miller is Georgia's top merit scholarship. At Georgia public colleges it pays full standard tuition, while HOPE pays only part.

To qualify out of high school you need:
- A 3.7 HOPE GPA, as calculated by GSFC
- A 1200 SAT in a single sitting, or the required ACT score
- The same 4 rigor courses as HOPE

Valedictorians and salutatorians can also qualify. You can receive HOPE or Zell, but not both at the same time.

The required ACT score has been listed as 25 or 26 in different years, so confirm the current number on GAfutures.org.

Sources: [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs), [GSFC HOPE program summary](https://gsfc.georgia.gov/document/document/fy22hope-program-summarydigitalpdf/download)"""),
("How is the HOPE GPA calculated?",
"""The state, not your high school, calculates the HOPE GPA. It is often different from the GPA on a report card.

- Only core classes count: English, math, science, social studies and world languages
- Only 9th through 12th grade count. High school credit classes taken in middle school are left out.
- Your school's own weighting is removed. Grades go on a 4.0 scale, where A = 4, B = 3, C = 2, D = 1 and F = 0.
- AP, IB and dual enrollment core classes get 0.5 added to grades of B, C, D or F. An A stays at 4.0.
- Honors classes get no extra points.

The GPA is only calculated once the rigor requirement is met. You can see your official HOPE GPA in your GAfutures.org account.

Source: [GAfutures: HOPE GPA calculation](https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/hope-scholarship/eligibility/hope-gpa-calculation)"""),
("What are the HOPE rigor requirements?",
"""To be eligible for HOPE or Zell Miller, students must earn 4 full credits from the state's academic rigor list. The categories are:
- Advanced math
- Advanced science
- Foreign language
- AP courses in core subjects
- IB courses in core subjects
- Degree-level dual enrollment courses in core subjects

Each school publishes which of its courses count, so ask the school counselor for your school's rigor course list.

Source: [GSFC HOPE program summary](https://gsfc.georgia.gov/document/document/fy22hope-program-summarydigitalpdf/download)"""),
("Do I have to apply for the HOPE Scholarship?",
"""Yes. Georgia students apply for HOPE and Zell Miller in one of two ways:
- Filing the FAFSA, which also covers federal aid such as Pell Grants and student loans
- Filing the GSFAPP (Georgia Student Financial Aid Application) on GAfutures.org

The GSFAPP is usually filed just once and stays good for years. The FAFSA must be filed every year if you want federal aid.

Many colleges suggest filing both. File early: if it isn't done by the last day of the term, HOPE won't pay for that term.

Sources: [UGA: Georgia Scholarship/Grant Application](https://osfa.uga.edu/resources/policies/georgia-scholarship-grant-application/), [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq)"""),
("What is the difference between the FAFSA and the GSFAPP?",
"""- **FAFSA** is the federal form. It's used for Pell Grants, federal work-study, federal student loans and many college scholarships, and it also counts for HOPE. It must be filed every year, and students and parents each need a StudentAid.gov account (FSA ID).
- **GSFAPP** is Georgia's own form on GAfutures.org. It covers state aid such as HOPE and Zell Miller only, and it is usually a one-time application.

If you might qualify for any federal aid, file the FAFSA. Some families file both so HOPE is in place quickly.

Sources: [UGA: Georgia Scholarship/Grant Application](https://osfa.uga.edu/resources/policies/georgia-scholarship-grant-application/), [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq)"""),
("Who has to fill out the FAFSA with the student?",
"""The FAFSA calls these people "contributors."
- For a dependent student, that's the student and a parent. With divorced or separated parents, it's the parent who provides more financial support. If that parent has remarried, the stepparent is a contributor too.
- Grandparents, legal guardians, foster parents and other relatives are not contributors.

Each contributor needs their own StudentAid.gov account (FSA ID), with their own email or phone number. Each one must also give consent for their tax information to be used. Without that consent, the student can't get federal aid. Being a contributor does not make someone responsible for paying for college.

Never share your FSA ID password with anyone, including ScholarTasks.

Source: [Marquette University: Filing the 2027-28 FAFSA](https://www.marquette.edu/central/financial-aid/applying-for-aid/fafsa-changes-2027-28.php)"""),
("Which year's taxes does the FAFSA use?",
"""The FAFSA uses tax information from two years before the school year. For example, the 2027-28 FAFSA uses 2025 federal tax information. That information is transferred from the IRS once you give consent, so most families don't need to type in tax numbers.

If you weren't required to file taxes, you still need to give consent on the form.

Source: [Marquette University: Filing the 2027-28 FAFSA](https://www.marquette.edu/central/financial-aid/applying-for-aid/fafsa-changes-2027-28.php)"""),
("Do I have to keep my grades up in college to keep HOPE?",
"""Yes. In college you need to keep a 3.0 HOPE GPA for HOPE, or a 3.3 for Zell Miller. Your college HOPE GPA can differ from your regular college GPA, because it counts every class you attempt, including repeated and transfer courses.

Your GPA is checked:
- At the end of every spring semester
- When you reach 30, 60 and 90 attempted credit hours

If you lose HOPE, you can earn it back only once, and only at the 30, 60 or 90 hour checkpoint. Approved STEM courses add 0.5 to B, C and D grades.

Sources: [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs), [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq)"""),
("How long can I receive HOPE?",
"""HOPE stops at whichever comes first:
- 127 attempted semester hours
- 127 hours paid by HOPE, Zell Miller and the HOPE Grant combined
- Your first bachelor's degree
- The time limit after high school graduation, currently up to 10 years for recent graduates

Hours you attempt count even if HOPE didn't pay for them. That includes drops after the drop/add period and withdrawals. Skipping HOPE for a term doesn't save hours.

Sources: [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs), [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq)"""),
("Does HOPE pay for books and fees?",
"""No. HOPE and Zell Miller pay toward tuition only, and they haven't covered fees or books since 2011.
- HOPE pays a set amount per credit hour, up to 15 hours a semester, and less for fewer hours.
- Zell Miller pays full standard tuition at Georgia public colleges.

Plan for fees, books, housing and meals from other aid or savings.

Sources: [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs), [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq)"""),
("Can I use HOPE for summer classes?",
"""Usually yes. If you're still eligible after the spring checkpoint, HOPE can pay for summer classes at a HOPE-eligible Georgia college. Summer hours count toward the 127-hour limit. Check with your college's financial aid office before you register.

Sources: [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq), [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs)"""),
("Can I earn HOPE in college if I didn't qualify in high school?",
"""Yes. If you didn't qualify for HOPE out of high school, your college can check you at 30 attempted hours. If you have a 3.0 college HOPE GPA then, you can start getting HOPE. If not, you're checked again at 60 and 90 hours.

Sources: [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq), [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs)"""),
("Do out-of-state or new Georgia residents qualify for HOPE?",
"""Possibly. You must be a legal Georgia resident. Usually that means 12 months in a row of Georgia residency before your first day of college classes. If you weren't a Georgia resident when you graduated high school, it's usually 24 months.

Students who graduated outside Georgia or were homeschooled send their transcripts and test scores to GSFC to be evaluated. If you aren't eligible as a freshman, you can be checked again at 30 attempted hours.

Sources: [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq), [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs)"""),
("Can I appeal if I was denied HOPE?",
"""Yes, there are two routes:
- **Administrative review:** if you think a rule was applied wrongly, send a written request to the Georgia Student Finance Commission (GSFC) within 45 days of the denial.
- **Exception:** for serious circumstances beyond your control, you can ask GSFC for an exception.

If you think you qualify but HOPE isn't on your award, contact your college's financial aid office before the semester ends.

Source: [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq)"""),
("What is dual enrollment in Georgia?",
"""Dual enrollment lets high school students take college classes and earn credit for both high school and college. Georgia's program pays tuition for approved courses at participating colleges, including all 26 University System of Georgia schools and the technical colleges, up to 15 hours a term. Students may still pay some course fees and supplies.

To start:
1. Meet with a parent and the high school counselor.
2. Pick courses from the Dual Enrollment Course Directory.
3. Apply to the college.
4. Complete the funding application on GAfutures.org.

Dual enrollment core classes also count as HOPE rigor courses. In the HOPE GPA they get 0.5 added to grades of B, C, D or F.

Sources: [USG Dual Enrollment FAQ](https://usg.edu/student_affairs/prospective_students/dual_enrollment_faqs), [GSFC HOPE program summary](https://gsfc.georgia.gov/document/document/fy22hope-program-summarydigitalpdf/download)"""),
("Is dual enrollment free in Georgia?",
"""Mostly. Georgia's dual enrollment funding pays tuition for approved courses, up to 15 semester hours a term, and the money goes straight to the college. Students may still pay course-related fees and supplies, optional costs like parking, and charges for lost or damaged books. Courses that aren't in the Dual Enrollment Course Directory aren't covered.

There's also a limit on the total hours the state will fund, so check the current cap on GAfutures.org.

Source: [USG Dual Enrollment FAQ](https://usg.edu/student_affairs/prospective_students/dual_enrollment_faqs)"""),
("What is the difference between Early Action and Regular Decision?",
"""- **Early Action (EA):** you apply by an earlier deadline, often in October or November, and hear back sooner. It is not binding at most schools, so you can still compare offers. At some colleges, such as UGA, a student denied in EA can't apply again that year in Regular Decision.
- **Regular Decision (RD):** you apply by a later deadline, usually January. This gives you time to add senior fall grades or new test scores.
- **Early Decision (ED)** is different: it's binding, so you agree to attend if admitted.

Check each college's own rules and dates.

Source: [UGA Admissions: Early Action FAQ](https://admissions.uga.edu/blog/2024-early-action-faq)"""),
("What does it mean to be deferred?",
"""A deferral is not a denial and not a waitlist. The college has paused its early decision on you and will review your application again with the regular applicant pool.

While you wait, you can usually send updates through the applicant portal, such as senior fall grades, new test scores, or new activities and leadership roles. Keep your grades up, because they're often looked at again.

Source: [UGA Admissions: Early Action FAQ](https://admissions.uga.edu/blog/2024-early-action-faq)"""),
("Does UGA require the SAT or ACT?",
"""In recent cycles, yes. UGA has required either an SAT or an ACT score, has had no preference between them, and will superscore repeated tests. Colleges change testing rules, so confirm the current policy for your entry year on admissions.uga.edu.

Source: [UGA Admissions: Early Action FAQ](https://admissions.uga.edu/blog/2024-early-action-faq)"""),
("What is superscoring?",
"""Superscoring means the college takes your best section scores from different test dates and combines them. For example, your best SAT Math from March and your best Reading and Writing from June together make your superscore. Many colleges, including UGA, superscore.

For Zell Miller, though, Georgia has required the 1200 SAT to come from a single sitting, so a superscore may not count. Check GAfutures.org for the current rule.

Sources: [UGA Admissions: Early Action FAQ](https://admissions.uga.edu/blog/2024-early-action-faq), [GSFC HOPE program summary](https://gsfc.georgia.gov/document/document/fy22hope-program-summarydigitalpdf/download)"""),
("What is the HOPE Grant?",
"""The HOPE Grant is for students in a certificate or diploma program at a Georgia technical college or eligible public college. It has no high school GPA requirement. It pays part of tuition, up to 15 credit hours a term. To keep it, you need a 2.0 HOPE GPA at 30 and 60 paid hours. The Zell Miller Grant is a higher award for students who keep a 3.5.

Source: [GSFC HOPE program summary](https://gsfc.georgia.gov/document/document/fy22hope-program-summarydigitalpdf/download)"""),
("Can I get both HOPE and Zell Miller?",
"""No. You can receive HOPE or Zell Miller, but not both at the same time. If your college GPA falls below the 3.3 needed for Zell, you can drop to HOPE as long as you still have a 3.0.

Sources: [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs), [GSFC HOPE program summary](https://gsfc.georgia.gov/document/document/fy22hope-program-summarydigitalpdf/download)"""),
("Do I need to be a full-time student to get HOPE?",
"""No. At Georgia public colleges there's no minimum number of hours. HOPE pays for up to 15 hours a semester, and less if you take fewer hours. Every attempted hour counts toward the 127-hour limit.

Sources: [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq), [Georgia Tech HOPE and Zell FAQ](https://finaid.gatech.edu/undergraduate-types-aid/hope-zell-faqs)"""),
("Does dropping a class affect HOPE?",
"""It depends on when you drop it.
- **During drop/add:** the hours don't count, and HOPE is adjusted to match your new schedule.
- **After drop/add:** the hours count as attempted and paid hours, even though you dropped the class.
- **Withdrawing from every class:** this can mean paying some HOPE money back.

Talk to financial aid before you drop.

Source: [Georgia College HOPE FAQ](https://www.gcsu.edu/financialaid/hopescholarshipfaq)"""),
("Where can I check my official HOPE GPA?",
"""Sign in to your GAfutures.org account.
- **High school students:** your school sends grades to GSFC, and your HOPE GPA and rigor progress show in your account.
- **College students:** use "My College HOPE Profile" on GAfutures.org to see your college HOPE GPA and attempted hours.

ScholarTasks shows an estimate. GAfutures has the official numbers.

Sources: [GAfutures: My College HOPE Profile](https://gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/how-to-track-your-hope-academic-eligibility/my-college-hope-profile/), [GAfutures: HOPE GPA calculation](https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/hope-scholarship/eligibility/hope-gpa-calculation)"""),
("Do honors classes count extra for HOPE?",
"""No. For the HOPE GPA, honors classes count the same as standard classes, with no extra points. Only AP, IB and dual enrollment core classes get a boost: 0.5 added to grades of B, C, D or F. Your school may still weight honors classes in its own GPA, so the report card number can be higher than your HOPE GPA.

Source: [GAfutures: HOPE GPA calculation](https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/hope-scholarship/eligibility/hope-gpa-calculation)"""),
("Do 8th grade classes count toward HOPE?",
"""No. The HOPE GPA counts core classes from 9th through 12th grade only. High school credit classes taken in middle school, like 8th grade Algebra I, aren't counted in the HOPE GPA. They usually still appear on the high school transcript and can count toward the school's own GPA.

Sources: [GAfutures: HOPE GPA calculation](https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/hope-scholarship/eligibility/hope-gpa-calculation), [Example Georgia district policy](https://ga01000549.schoolwires.net/Page/93079)"""),
]
import json

def q(s):
    assert '$faq$' not in s
    return '$faq$' + s + '$faq$'
out = ["-- ScholarTasks database update 8: starter answer library (Georgia FAQs, rewritten in our own words).",
"-- Run once in Supabase > SQL Editor (paste everything, click Run). Safe to run twice: questions already in the library are skipped.",
"-- Every answer lands as WAITING. Review and approve each one at https://scholartasks.vercel.app/admin/answers before families see it.",
"",
"insert into answer_bank (state, question, answer, status)",
"select 'GA', v.question, v.answer, 'pending' from (values"]
rows=[]
for qq,a in faqs:
    assert 20 <= len(a) <= 6000, qq
    rows.append(f"  ({q(qq)}, {q(a)})")
out.append(",\n".join(rows))
out.append(") as v(question, answer)\nwhere not exists (select 1 from answer_bank b where b.state = 'GA' and lower(b.question) = lower(v.question));")
open(__file__.replace('.py', '.sql'),'w').write("\n".join(out)+"\n")
print(len(faqs))
