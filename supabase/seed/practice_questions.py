# Writes practice_questions.sql: starter practice questions for core subjects
# (grades 8-12), loaded as WAITING for teacher review at /admin/questions.
# mc = (topic, question, [options], correct index, explanation)
# written = (topic, question, model answer)
BANK = {
 "Algebra I": {
  "mc": [
   ("Linear equations", "Solve 3x + 7 = 22.", ["x = 3", "x = 5", "x = 7", "x = 29/3"], 1, "Subtract 7 from both sides to get 3x = 15, then divide by 3: x = 5."),
   ("Slope", "What is the slope of the line through (2, 3) and (6, 11)?", ["2", "4", "1/2", "8"], 0, "Slope = change in y / change in x = (11 - 3) / (6 - 2) = 8 / 4 = 2."),
   ("Expressions", "Simplify 2(x + 4) - 3x.", ["-x + 8", "5x + 8", "-x + 4", "x + 8"], 0, "Distribute: 2x + 8 - 3x. Combine like terms: -x + 8."),
   ("Quadratics", "Which values of x solve x² = 49?", ["7 only", "-7 and 7", "49", "24.5"], 1, "Both 7 × 7 and (-7) × (-7) equal 49, so there are two solutions."),
   ("Functions", "If f(x) = 2x² - 1, what is f(3)?", ["17", "35", "11", "5"], 0, "f(3) = 2(3²) - 1 = 2(9) - 1 = 17. Square first, then multiply."),
   ("Slope-intercept form", "What is the y-intercept of y = -4x + 9?", ["9", "-4", "4", "-9"], 0, "In y = mx + b, b is the y-intercept. Here b = 9, so the line crosses the y-axis at (0, 9)."),
  ],
  "written": [("Systems of equations", "Solve the system y = 2x + 1 and y = -x + 7. Explain your steps.", "Set the right sides equal: 2x + 1 = -x + 7, so 3x = 6 and x = 2. Substitute: y = 2(2) + 1 = 5. The solution is (2, 5). Check in the second equation: -2 + 7 = 5.")],
 },
 "Geometry": {
  "mc": [
   ("Triangles", "Two angles of a triangle are 50° and 60°. What is the third angle?", ["70°", "80°", "90°", "110°"], 0, "The angles of a triangle add to 180°: 180 - 50 - 60 = 70°."),
   ("Pythagorean theorem", "A right triangle has legs of 6 and 8. How long is the hypotenuse?", ["10", "14", "48", "12"], 0, "a² + b² = c²: 36 + 64 = 100, and √100 = 10."),
   ("Circles", "What is the area of a circle with radius 3?", ["9π", "6π", "3π", "18π"], 0, "Area = πr² = π × 3² = 9π. (6π is the circumference.)"),
   ("Polygons", "What is the sum of the interior angles of a hexagon?", ["720°", "540°", "360°", "1080°"], 0, "Sum = (n - 2) × 180° = (6 - 2) × 180° = 720°."),
   ("Angle relationships", "Two angles are supplementary. One is 115°. What is the other?", ["65°", "75°", "25°", "245°"], 0, "Supplementary angles add to 180°: 180 - 115 = 65°."),
   ("Volume", "What is the volume of a rectangular box that is 2 by 3 by 5 units?", ["30 cubic units", "10 cubic units", "31 cubic units", "60 cubic units"], 0, "Volume = length × width × height = 2 × 3 × 5 = 30."),
  ],
  "written": [("Triangles", "Explain why the two acute angles in a right triangle must add up to 90°.", "The three angles of any triangle add to 180°. A right triangle has one 90° angle, so the other two angles must share the remaining 180 - 90 = 90°.")],
 },
 "Biology": {
  "mc": [
   ("Cells", "Which organelle makes most of a cell's usable energy (ATP)?", ["Mitochondria", "Ribosome", "Nucleus", "Golgi apparatus"], 0, "Mitochondria carry out cellular respiration, which releases energy stored in glucose as ATP."),
   ("Photosynthesis", "What does photosynthesis produce?", ["Glucose and oxygen", "Carbon dioxide and water", "Only oxygen", "Proteins"], 0, "Plants use light, carbon dioxide and water to make glucose, releasing oxygen."),
   ("DNA", "In DNA, which base pairs with adenine (A)?", ["Thymine (T)", "Guanine (G)", "Cytosine (C)", "Uracil (U)"], 0, "In DNA, A pairs with T and C pairs with G. Uracil replaces thymine only in RNA."),
   ("Genetics", "Two parents are both Bb. What fraction of offspring are expected to be bb?", ["1/4", "1/2", "3/4", "0"], 0, "A Punnett square gives BB, Bb, Bb, bb, so 1 out of 4 is bb."),
   ("Evolution", "Which statement best describes natural selection?", ["Individuals with helpful traits survive and reproduce more, passing those traits on", "Individuals change their own genes during life to adapt", "All individuals in a population are identical", "Traits gained during life, like big muscles, are inherited"], 0, "Natural selection works on inherited variation: helpful inherited traits become more common over generations."),
   ("Cell division", "Which type of cell division makes sex cells (gametes)?", ["Meiosis", "Mitosis", "Binary fission", "Osmosis"], 0, "Meiosis makes four genetically different cells with half the chromosomes. Mitosis makes identical body cells."),
  ],
  "written": [("Cell division", "Explain two differences between mitosis and meiosis.", "Mitosis makes 2 genetically identical cells with the full set of chromosomes, for growth and repair. Meiosis has two divisions and makes 4 genetically different cells with half the chromosomes (gametes) for sexual reproduction.")],
 },
 "Physical Science and Chemistry": {
  "mc": [
   ("Atoms", "What does an element's atomic number tell you?", ["The number of protons", "The number of neutrons", "Protons plus neutrons", "The number of electron shells"], 0, "The atomic number is the number of protons, which defines the element."),
   ("Acids and bases", "A solution has a pH of 3. It is:", ["Acidic", "Basic", "Neutral", "A pure metal"], 0, "pH below 7 is acidic, 7 is neutral, and above 7 is basic."),
   ("Chemical equations", "Complete the balanced equation: 2H₂ + O₂ → ?", ["2H₂O", "H₂O", "H₂O₂", "2H₂O₂"], 0, "4 hydrogen atoms and 2 oxygen atoms on the left make 2 water molecules on the right."),
   ("Motion", "An object travels 20 meters in 4 seconds. What is its average speed?", ["5 m/s", "80 m/s", "24 m/s", "16 m/s"], 0, "Speed = distance / time = 20 m / 4 s = 5 m/s."),
   ("Forces", "Which equation is Newton's second law?", ["F = ma", "Every action has an equal and opposite reaction", "An object at rest stays at rest unless acted on", "E = mc²"], 0, "Newton's second law: net force equals mass times acceleration."),
   ("Matter", "Which of these is a chemical change?", ["Iron rusting", "Ice melting", "Sugar dissolving in water", "Glass breaking"], 0, "Rusting makes a new substance (iron oxide). The others change form but not the substance."),
  ],
  "written": [("Forces", "A 2 kg cart speeds up at 3 m/s². What net force acts on it? Show your work.", "F = ma = 2 kg × 3 m/s² = 6 N (newtons).")],
 },
 "U.S. History": {
  "mc": [
   ("Founding", "Which document announced the colonies' independence in 1776?", ["The Declaration of Independence", "The Constitution", "The Bill of Rights", "The Articles of Confederation"], 0, "The Declaration of Independence was adopted on July 4, 1776. The Constitution came in 1787."),
   ("Reconstruction", "What did the 13th Amendment do?", ["Abolished slavery", "Gave women the right to vote", "Banned alcohol", "Created the income tax"], 0, "The 13th Amendment (1865) abolished slavery. Women's suffrage was the 19th."),
   ("Great Depression", "The New Deal was a response to:", ["The Great Depression", "World War I", "The Civil War", "The Cold War"], 0, "Franklin Roosevelt's New Deal programs in the 1930s aimed to bring relief and recovery from the Depression."),
   ("Civil rights", "What did Brown v. Board of Education (1954) decide?", ["Racial segregation in public schools is unconstitutional", "Courts can strike down laws (judicial review)", "\"Separate but equal\" is allowed", "Women have the right to vote"], 0, "Brown overturned \"separate but equal\" in public schools. Judicial review came from Marbury v. Madison."),
   ("Expansion", "Which 1803 purchase roughly doubled the size of the United States?", ["The Louisiana Purchase", "The Alaska Purchase", "The Gadsden Purchase", "The purchase of Florida"], 0, "The U.S. bought the Louisiana Territory from France in 1803."),
   ("Cold War", "Who were the main rivals in the Cold War?", ["The United States and the Soviet Union", "The United States and Germany", "Britain and France", "The United States and Japan"], 0, "The Cold War (about 1947-1991) was a rivalry between the U.S. and the Soviet Union."),
  ],
  "written": [("Civil War", "Describe two causes of the American Civil War.", "Disagreement over slavery and whether it could spread to new western territories; conflict over states' rights versus federal power; economic differences between North and South; and Lincoln's election in 1860, which led Southern states to secede. Two of these, explained, is a full answer.")],
 },
 "American Government": {
  "mc": [
   ("Constitution", "What are the three branches of the U.S. government?", ["Legislative, executive and judicial", "House, Senate and President", "Federal, state and local", "Army, Navy and Air Force"], 0, "Congress makes laws, the President carries them out, and the courts interpret them."),
   ("Congress", "How many U.S. senators does each state have?", ["2", "1", "It depends on population", "4"], 0, "Every state has 2 senators. Seats in the House depend on population."),
   ("Rights", "What are the first ten amendments to the Constitution called?", ["The Bill of Rights", "The Federalist Papers", "The Preamble", "The Articles of Confederation"], 0, "The Bill of Rights (1791) lists basic rights such as speech, religion and a fair trial."),
   ("Lawmaking", "Who can veto a bill passed by Congress?", ["The President", "The Supreme Court", "The Speaker of the House", "State governors"], 0, "The President can veto a bill; Congress can override with a two-thirds vote in both chambers."),
   ("Checks and balances", "What does \"checks and balances\" mean?", ["Each branch can limit the powers of the others", "States approve the federal budget", "Citizens vote on every law", "The President controls the courts"], 0, "Examples: the President's veto, Senate approval of judges, and courts ruling laws unconstitutional."),
   ("Rights", "Freedom of speech is protected by which amendment?", ["The First", "The Second", "The Fifth", "The Tenth"], 0, "The First Amendment protects speech, religion, press, assembly and petition."),
  ],
  "written": [("Lawmaking", "Explain how a bill becomes a federal law.", "A member of Congress introduces the bill (tax bills start in the House). A committee studies it, then the House and Senate each vote. Both must pass the same version. The President signs it into law or vetoes it; Congress can override a veto with a two-thirds vote in both chambers.")],
 },
 "English Language Arts": {
  "mc": [
   ("Sentences", "Which is a complete sentence?", ["Because the bus was late.", "Running down the hall.", "The bus was late, so we missed first period.", "After the game ended."], 2, "A complete sentence has a subject and verb and expresses a full thought. The others are fragments."),
   ("Literature", "The theme of a story is:", ["Its central message or insight about life", "The time and place it happens", "The main character", "The order of events"], 0, "Setting is time and place; plot is the order of events; theme is the message."),
   ("Figurative language", "\"The wind whispered through the trees\" is an example of:", ["Personification", "Simile", "Hyperbole", "Alliteration"], 0, "Giving a human action (whispering) to something non-human is personification."),
   ("Usage", "Which sentence is correct?", ["Their going to the game later.", "They're going to the game later.", "There going to the game later.", "Theyre going to the game later."], 1, "They're = they are. Their shows ownership; there is a place."),
   ("Writing", "A thesis statement is:", ["The main argument of an essay", "A quote from a source", "The last paragraph", "A list of sources"], 0, "The thesis states the main claim the essay will support, usually near the end of the introduction."),
   ("Figurative language", "\"Her backpack weighed a ton\" is an example of:", ["Hyperbole", "Simile", "Personification", "Onomatopoeia"], 0, "Hyperbole is deliberate exaggeration for effect."),
  ],
  "written": [("Sentences", "Fix this run-on sentence: \"I finished my homework I went to practice.\"", "Any correct fix works, for example: \"I finished my homework, and then I went to practice.\" or \"I finished my homework. Then I went to practice.\" or \"I finished my homework; I went to practice.\"")],
 },
 "Economics": {
  "mc": [
   ("Scarcity", "What is opportunity cost?", ["The value of the next best choice you give up", "The price you pay in money", "The total cost of everything you buy", "The cost of making a product"], 0, "Every choice has a trade-off; the opportunity cost is the best alternative you didn't choose."),
   ("Supply and demand", "If demand for a product rises and supply stays the same, the price usually:", ["Rises", "Falls", "Stays the same", "Drops to zero"], 0, "More buyers competing for the same supply pushes the price up."),
   ("Macroeconomics", "Inflation is:", ["A general rise in prices over time", "A fall in unemployment", "An increase in taxes", "Growth in the economy's output"], 0, "Inflation means money buys less than before because prices overall have gone up."),
   ("Money and banking", "What is the central bank of the United States?", ["The Federal Reserve", "The U.S. Treasury", "Congress", "The IRS"], 0, "The Federal Reserve sets monetary policy, including key interest rates."),
   ("Macroeconomics", "What does GDP measure?", ["The total value of final goods and services produced in a country in a period", "The government's debt", "The money in people's bank accounts", "Exports minus imports"], 0, "Gross domestic product is the market value of everything a country produces in a year (or quarter)."),
   ("Personal finance", "When a budget's spending is greater than its income, it has a:", ["Deficit", "Surplus", "Balance", "Dividend"], 0, "A deficit is spending more than you take in; a surplus is the opposite."),
  ],
  "written": [("Scarcity", "Explain opportunity cost using an example from your own week.", "Opportunity cost is the next best thing you give up when you choose. A good answer names a real choice and what was given up, for example: \"I worked a shift on Saturday, so my opportunity cost was the study time for my chemistry test.\"")],
 },
}

def q(s):
    assert '$q$' not in s
    return '$q$' + s + '$q$'

rows = []
for subject, parts in BANK.items():
    for topic, question, options, ans, expl in parts["mc"]:
        assert 0 <= ans < len(options) == 4, question
        import json
        rows.append(f"  ({q(subject)}, {q(topic)}, 'mc', {q(question)}, {q(json.dumps(options, ensure_ascii=False))}::jsonb, {ans}, null, {q(expl)})")
    for topic, question, model in parts["written"]:
        rows.append(f"  ({q(subject)}, {q(topic)}, 'written', {q(question)}, null, null, {q(model)}, null)")

out = ["-- ScholarTasks starter practice questions (core subjects, grades 8-12), written for ScholarTasks.",
"-- Safe to run twice: questions already in the bank are skipped. All start as WAITING for teacher review at /admin/questions.",
"insert into practice_questions (subject, topic, kind, question, options, answer_index, model_answer, explanation, status)",
"select v.subject, v.topic, v.kind, v.question, v.options, v.answer_index, v.model_answer, v.explanation, 'pending' from (values",
",\n".join(rows),
") as v(subject, topic, kind, question, options, answer_index, model_answer, explanation)",
"where not exists (select 1 from practice_questions p where p.subject = v.subject and p.question = v.question);"]
open(__file__.replace('.py', '.sql'), 'w').write("\n".join(out) + "\n")
print(len(rows))
