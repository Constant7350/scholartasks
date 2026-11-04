# Writes test_prep_questions.sql: original SAT- and ACT-style practice
# questions written for ScholarTasks (not copied from College Board or ACT
# materials). Loaded as WAITING for teacher review at /admin/questions.
# Each item: (topic, passage or None, question, [correct answer first, then wrong answers], explanation)
# Options are shuffled into a fixed order by the script. If the first option is
# "NO CHANGE" (ACT English style), use (topic, passage, question, options, answer_index, explanation)
# and the order is kept.
import json, random

COMPLETE = "Which choice completes the text with the most logical and precise word or phrase?"
CONVENTIONS = "Which choice completes the text so that it conforms to the conventions of Standard English?"
TRANSITION = "Which choice completes the text with the most logical transition?"
LOGICAL = "Which choice most logically completes the text?"
BEST = "Which choice is best?"

SAT_RW = [
 ("Words in context", "The botanist's notes on the orchid were remarkably ______: every leaf, root and petal was described in exact detail, down to fractions of a millimeter.", COMPLETE,
  ["meticulous", "hurried", "ambiguous", "sparse"], "\"Exact detail, down to fractions of a millimeter\" describes very careful, precise work, which is what meticulous means."),
 ("Words in context", "Although the town council expected the new bike lanes to be controversial, residents' response was largely ______: at the public meeting, most speakers praised the plan and only a few raised concerns.", COMPLETE,
  ["favorable", "hostile", "indifferent", "confused"], "Most speakers praised the plan, so the response was positive (favorable). \"Although\" signals the contrast with the expected controversy."),
 ("Words in context", "Early critics dismissed the novelist's first book as derivative, but later scholars found it strikingly ______, noting that it used storytelling techniques no earlier writer had tried.", COMPLETE,
  ["original", "conventional", "repetitive", "obscure"], "\"But\" signals the opposite of derivative (copied), and \"techniques no earlier writer had tried\" points to original."),
 ("Words in context", "The engineer's proposal was ______: it used only materials the company already had in stock and could be finished within the existing budget.", COMPLETE,
  ["practical", "extravagant", "theoretical", "reckless"], "Using materials on hand and staying on budget describe a sensible, workable plan: practical."),
 ("Words in context", "The documentary's narrator speaks in a calm, ______ tone, letting the dramatic footage of the storm speak for itself rather than adding excitement with her voice.", COMPLETE,
  ["restrained", "frantic", "boastful", "sarcastic"], "She avoids adding excitement, so her tone holds back: restrained. \"Calm\" supports this."),
 ("Text structure and purpose", "Many people assume that octopuses, being solitary, have little need for complex communication. Yet researchers filming a site off the coast of Australia recorded octopuses changing skin color and posture in response to one another, sometimes in ways that seemed to prevent fights. The findings suggest that octopus social life may be richer than once believed.",
  "Which choice best describes the overall structure of the text?",
  ["It presents a common assumption, describes evidence that challenges it, and states a conclusion drawn from that evidence.", "It describes an experiment, explains its flaws, and proposes a better method.", "It compares two species of octopus and explains why one is more social.", "It summarizes a debate between two researchers and declares one of them correct."],
  "Sentence 1 is the assumption, \"Yet\" introduces the challenging evidence, and the last sentence draws the conclusion."),
 ("Text structure and purpose", "Mae Jemison, the first African American woman to travel to space, trained as a physician and served as a medical officer in Sierra Leone and Liberia before joining NASA. After leaving NASA, she founded a technology company and has led efforts to encourage students, especially girls, to pursue science.",
  "Which choice best states the main purpose of the text?",
  ["To describe the range of one person's accomplishments in medicine, space exploration and education", "To explain how NASA selects its astronauts", "To argue that doctors make the best astronauts", "To compare Jemison's career with the careers of other astronauts"],
  "The text lists her work as a doctor, an astronaut and a leader in science education. It doesn't explain selection, argue, or compare."),
 ("Text structure and purpose", "The city's oldest library was nearly torn down in the 1970s. Local volunteers raised money for repairs and held readings on its steps to draw attention to the building. Today it is one of the busiest branches in the system.",
  "Which choice best describes the function of the second sentence in the text?",
  ["It explains how the library avoided the fate mentioned in the first sentence.", "It gives the reason the library was nearly torn down.", "It describes how the library is used today.", "It questions whether the library should have been saved."],
  "The first sentence says the library was almost torn down; the second tells what people did to save it."),
 ("Cross-text connections", "Text 1: Some nutrition researchers argue that eating breakfast is essential for students' concentration, pointing to studies in which students who ate breakfast scored higher on morning tests.\nText 2: Other researchers note that students who eat breakfast also tend to sleep more and have more regular routines. Without accounting for these differences, they argue, it is impossible to say whether breakfast itself improves concentration.",
  "Based on the texts, how would the researchers in Text 2 most likely respond to the studies described in Text 1?",
  ["They would say the studies do not rule out other explanations for the higher scores.", "They would say the studies prove that sleep matters more than breakfast.", "They would agree that breakfast is the main cause of better concentration.", "They would argue that morning tests are an unfair way to measure learning."],
  "Text 2's point is that sleep and routines could explain the scores, so the studies don't show breakfast is the cause. They don't claim to prove sleep matters more."),
 ("Central ideas", "When the river flooded in the spring of 1927, farmers in the valley lost crops, homes and livestock. In the years that followed, however, many of them formed cooperatives, pooling equipment and sharing labor so that no family had to rebuild alone. Historians credit these cooperatives with helping the valley recover faster than neighboring regions.",
  "Which choice best states the main idea of the text?",
  ["Farmers who worked together after a flood helped their region recover relatively quickly.", "The flood of 1927 was the worst disaster in the region's history.", "Historians disagree about what caused the 1927 flood.", "Farm cooperatives were common in the valley before 1927."],
  "The text moves from the flood's damage to the cooperatives and credits them with a faster recovery. The other choices aren't stated."),
 ("Command of evidence", "\"Harbor Morning\" is a poem written for this practice set. A student claims that the speaker of the poem sees the sea as both comforting and threatening.",
  "Which quotation from the poem most effectively illustrates the student's claim?",
  ["\"The tide rocks me like a cradle, then pulls at my feet like a thief.\"", "\"The gulls cry out above the gray stones.\"", "\"Each morning the fishing boats leave the harbor.\"", "\"The water is colder in March than in May.\""],
  "\"Like a cradle\" is comforting and \"like a thief\" is threatening, so this line shows both sides of the claim."),
 ("Command of evidence", "A student surveyed 200 students at her school about how they usually get to school. Walk: 30. Bus: 90. Car: 60. Bike: 20. The student concludes that the bus is the most common way to get to school, used by nearly half of those surveyed.",
  "Which choice most effectively uses data from the survey to support the student's conclusion?",
  ["90 of the 200 students said they ride the bus, more than for any other choice.", "60 students said they ride in a car, which is more than the number who walk.", "Only 20 students said they bike to school.", "Walking and biking together account for 50 students."],
  "The conclusion is about the bus being most common and near half: 90 of 200 is 45%, the largest group."),
 ("Command of evidence", "Average daily water use per household in a town (gallons): 2015: 310. 2018: 285. 2021: 260. 2024: 240.",
  "Which choice most accurately describes the data?",
  ["Average daily water use fell in each period shown, from 310 gallons in 2015 to 240 gallons in 2024.", "Average daily water use rose between 2018 and 2021.", "Average daily water use was the same in 2015 and 2024.", "Average daily water use dropped by more than half between 2015 and 2024."],
  "Each number is lower than the one before. A drop from 310 to 240 is 70 gallons, far less than half."),
 ("Inferences", "Bees that visit a patch of flowers seem to remember which flowers recently offered nectar. In one experiment, researchers refilled some artificial flowers with sugar water every few minutes and left others empty. Over time, bees visited the refilled flowers far more often than the empty ones. This suggests that ______",
  LOGICAL,
  ["bees can learn and use information about which food sources are likely to be rewarding.", "bees prefer artificial flowers to real ones.", "sugar water is more nutritious for bees than natural nectar.", "bees visit flowers in a random order."],
  "Bees shifted toward the flowers that kept rewarding them, which shows learning. Real flowers and nutrition weren't compared."),
 ("Inferences", "In a study of city parks, researchers found that parks with more tree cover had lower afternoon temperatures than parks with little tree cover, even when the parks were the same size and in the same neighborhood. Because size and location were held constant, the researchers concluded that ______",
  LOGICAL,
  ["tree cover, rather than park size or neighborhood, likely explains the temperature difference.", "larger parks are always cooler than smaller parks.", "neighborhoods with parks are cooler than neighborhoods without parks.", "afternoon temperatures do not vary from park to park."],
  "Holding size and location the same rules them out, leaving tree cover as the likely cause."),
 ("Boundaries", "The marine biologist spent six months studying coral reefs off the coast of ______ she found that warmer water caused several species to lose their color.",
  CONVENTIONS, ["Belize, and", "Belize,", "Belize", "Belize and,"],
  "Two complete sentences joined with \"and\" need a comma before \"and.\" A comma alone is a comma splice; nothing at all is a run-on."),
 ("Boundaries", "The recipe calls for only three ______ flour, water and salt.",
  CONVENTIONS, ["ingredients:", "ingredients;", "ingredients, and", "ingredients that"],
  "A colon introduces a list after a complete sentence. A semicolon must join two complete sentences, and the list isn't one."),
 ("Boundaries", "The storm knocked out power across the ______ crews worked through the night to restore it.",
  CONVENTIONS, ["county;", "county,", "county", "county, and,"],
  "Both sides are complete sentences, so a semicolon can join them. A comma alone would be a comma splice."),
 ("Form, structure and sense", "The collection of handwritten letters, which spans more than forty years of the family's history, ______ now on display at the county museum.",
  CONVENTIONS, ["is", "are", "were", "have been"],
  "The subject is \"collection\" (singular), not \"letters,\" so the verb is \"is.\" Skip the phrases between subject and verb."),
 ("Form, structure and sense", "When the two companies merged, the new board asked each department to review ______ budget and suggest savings.",
  CONVENTIONS, ["its", "it's", "their", "they're"],
  "\"Each department\" is singular and owns the budget, so the possessive \"its\" fits. \"It's\" means \"it is.\""),
 ("Form, structure and sense", "By the time the rescue team reached the summit last night, the climbers ______ there for more than six hours.",
  CONVENTIONS, ["had been waiting", "have been waiting", "will have waited", "are waiting"],
  "The waiting happened before another past event (the team reaching them), so use the past perfect: \"had been waiting.\""),
 ("Form, structure and sense", "The three ______ science projects were displayed in the main hallway, where visitors could vote for a favorite.",
  CONVENTIONS, ["students'", "student's", "students", "students's"],
  "Three students own the projects: plural possessive, \"students'.\""),
 ("Form, structure and sense", "Walking through the museum's newest exhibit, ______",
  CONVENTIONS, ["visitors can see fossils that are more than 100 million years old.", "fossils more than 100 million years old can be seen by visitors.", "the fossils are more than 100 million years old.", "more than 100 million years is the age of the fossils."],
  "The opening phrase describes who is walking, so \"visitors\" must come right after the comma. Otherwise the fossils seem to be walking."),
 ("Transitions", "Solar panels can lower a household's electricity bills. ______ installing them can cost thousands of dollars up front, which is a barrier for many families.",
  TRANSITION, ["However,", "Therefore,", "For example,", "Similarly,"],
  "The second sentence gives a drawback that contrasts with the benefit, so \"However\" fits."),
 ("Transitions", "Hummingbirds have extremely fast metabolisms. ______ they must eat often throughout the day, sometimes visiting hundreds of flowers.",
  TRANSITION, ["As a result,", "In contrast,", "Nevertheless,", "For instance,"],
  "Eating often is a consequence of the fast metabolism: cause and effect, \"As a result.\""),
 ("Transitions", "The first draft of the report was nearly fifty pages long. ______ the final version, after careful editing, was only twelve pages.",
  TRANSITION, ["By contrast,", "Similarly,", "Thus,", "In addition,"],
  "Fifty pages versus twelve is a contrast."),
 ("Rhetorical synthesis", "While researching a topic, a student has taken these notes:\n• The Okefenokee Swamp is in southeastern Georgia and northern Florida.\n• It covers about 438,000 acres.\n• It is one of the largest blackwater swamps in North America.\n• Much of it is protected as a national wildlife refuge.",
  "The student wants to emphasize the size of the Okefenokee Swamp. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
  ["Covering about 438,000 acres, the Okefenokee Swamp is one of the largest blackwater swamps in North America.", "The Okefenokee Swamp is in southeastern Georgia and northern Florida.", "Much of the Okefenokee Swamp is protected as a national wildlife refuge.", "The Okefenokee Swamp, in Georgia and Florida, is a protected area."],
  "Only this choice uses the size details (acres and \"one of the largest\"). Match the goal, not just the facts."),
 ("Rhetorical synthesis", "While researching a topic, a student has taken these notes:\n• Katherine Johnson was a mathematician at NASA.\n• She calculated flight paths for early space missions.\n• Before his 1962 orbital flight, astronaut John Glenn asked that she personally check the computer's calculations.\n• She received the Presidential Medal of Freedom in 2015.",
  "The student wants to show how much astronauts trusted Johnson's work. Which choice most effectively uses relevant information from the notes to accomplish this goal?",
  ["Before his 1962 orbital flight, John Glenn asked that Katherine Johnson personally check the computer's calculations.", "Katherine Johnson, a NASA mathematician, received the Presidential Medal of Freedom in 2015.", "Katherine Johnson calculated flight paths for early space missions.", "Katherine Johnson was a mathematician who worked at NASA."],
  "An astronaut asking for her to double-check the computer shows trust. The other choices are true but don't show trust."),
]

SAT_MATH = [
 ("Linear equations", None, "If 4x − 9 = 19, what is the value of 2x?", ["14", "7", "28", "5"], "Add 9: 4x = 28, so x = 7 and 2x = 14. Read what the question asks for: 2x, not x."),
 ("Linear functions", None, "A phone plan costs $25 a month plus $0.10 for each text message over 500. Which function gives the monthly cost C, in dollars, for t text messages, where t > 500?",
  ["C = 25 + 0.10(t − 500)", "C = 25 + 0.10t", "C = 25t + 0.10", "C = 0.10(t + 500) + 25"], "Only messages over 500 cost extra, so the extra count is t − 500, times $0.10, plus the $25 base."),
 ("Linear equations", None, "Line ℓ passes through the points (0, 3) and (2, 11). Which equation represents line ℓ?", ["y = 4x + 3", "y = 3x + 4", "y = 8x + 3", "y = 4x + 11"], "Slope = (11 − 3) / (2 − 0) = 4. The line crosses the y-axis at (0, 3), so b = 3."),
 ("Systems of equations", None, "If x + y = 10 and x − y = 4, what is the value of xy?", ["21", "24", "7", "40"], "Add the equations: 2x = 14, so x = 7 and y = 3. Then xy = 21."),
 ("Linear inequalities", None, "Maria has $60 to spend on an $18 ticket and snacks that cost $3.50 each. Which inequality represents the number of snacks, s, she can buy?",
  ["18 + 3.5s ≤ 60", "18s + 3.5 ≤ 60", "18 + 3.5s ≥ 60", "3.5s ≤ 18 + 60"], "Ticket plus snacks must be at most $60: 18 + 3.5s ≤ 60."),
 ("Systems of equations", None, "For what value of k does the system 2x + 3y = 7 and 4x + ky = 5 have no solution?", ["6", "3", "−6", "14"],
  "No solution means parallel lines: same slope, different intercept. Doubling the first equation gives 4x + 6y = 14, so k = 6 makes the left sides match while 14 ≠ 5."),
 ("Quadratics", None, "What are the solutions of x² − 5x − 14 = 0?", ["x = 7 and x = −2", "x = −7 and x = 2", "x = 14 and x = −1", "x = 5 and x = −14"], "Factor: (x − 7)(x + 2) = 0, so x = 7 or x = −2. Check: 7 × −2 = −14 and 7 + (−2) = 5."),
 ("Functions", None, "If f(x) = x² − 3x + 2, what is f(−2)?", ["12", "0", "4", "−8"], "(−2)² − 3(−2) + 2 = 4 + 6 + 2 = 12. Watch the signs: minus a negative is plus."),
 ("Exponential models", None, "A town's population of 8,000 grows by 3% each year. Which expression gives the population after t years?", ["8,000(1.03)^t", "8,000(0.03)^t", "8,000 + 1.03t", "8,000(1.3)^t"], "Growing by 3% means multiplying by 1 + 0.03 = 1.03 each year."),
 ("Equivalent expressions", None, "Which expression is equivalent to (x + 4)²?", ["x² + 8x + 16", "x² + 16", "x² + 4x + 16", "x² + 8x + 8"], "(x + 4)(x + 4) = x² + 4x + 4x + 16 = x² + 8x + 16. Don't forget the middle term."),
 ("Exponents", None, "If 3^(x + 1) = 81, what is the value of x?", ["3", "4", "2", "27"], "81 = 3⁴, so x + 1 = 4 and x = 3."),
 ("Exponents", None, "The function g is defined by g(x) = 2^x. What is the value of g(5) − g(3)?", ["24", "4", "2", "16"], "g(5) = 32 and g(3) = 8, so the difference is 24. It isn't 2^(5 − 3)."),
 ("Quadratics", None, "The graph of a quadratic function is a parabola with its vertex at (2, −5) that opens upward. What is the minimum value of the function?", ["−5", "2", "5", "−2"], "An upward parabola's lowest point is its vertex. The minimum value is the y-coordinate: −5."),
 ("Equivalent expressions", None, "Which expression is equivalent to (6x³ − 9x²) / (3x), for x ≠ 0?", ["2x² − 3x", "2x² − 9x²", "2x³ − 3x²", "3x² − 6x"], "Divide each term by 3x: 6x³ / 3x = 2x² and 9x² / 3x = 3x."),
 ("Radical equations", None, "If √(x + 5) = 4, what is the value of x?", ["11", "21", "−1", "3"], "Square both sides: x + 5 = 16, so x = 11. Check: √16 = 4."),
 ("Ratios and rates", None, "A recipe uses 3 cups of flour for every 2 cups of sugar. How many cups of sugar are needed with 12 cups of flour?", ["8", "18", "6", "4"], "12 is 4 times 3, so use 4 times 2 = 8 cups of sugar."),
 ("Percentages", None, "A jacket that normally costs $80 is on sale for 25% off. What is the sale price?", ["$60", "$55", "$20", "$75"], "25% of $80 is $20, and $80 − $20 = $60. ($20 is the discount, not the price.)"),
 ("Statistics", None, "The mean of five numbers is 12. Four of the numbers are 10, 14, 9 and 15. What is the fifth number?", ["12", "10", "48", "13"], "The five numbers add to 5 × 12 = 60. The four given add to 48, so the fifth is 12."),
 ("Statistics", None, "What is the median of the data set 2, 4, 6, 9, 10, 13?", ["7.5", "6", "9", "About 7.3"], "With six numbers, the median is the average of the middle two: (6 + 9) / 2 = 7.5. About 7.3 is the mean."),
 ("Sampling", None, "In a random sample of 400 voters in a city, 240 support building a new park. Based on the sample, which is the best estimate of how many of the city's 50,000 voters support the park?",
  ["30,000", "24,000", "240", "20,000"], "240 / 400 = 60%, and 60% of 50,000 is 30,000."),
 ("Probability", None, "A bag holds 5 red, 3 blue and 2 green marbles. One marble is drawn at random. What is the probability that it is not red?", ["1/2", "1/5", "3/10", "2/5"], "5 of the 10 marbles are not red (3 blue + 2 green), so 5/10 = 1/2."),
 ("Ratios and rates", None, "A car travels 150 miles in 2.5 hours at a constant speed. At this speed, how far will it travel in 4 hours?", ["240 miles", "200 miles", "375 miles", "160 miles"], "Speed = 150 / 2.5 = 60 miles per hour, and 60 × 4 = 240 miles."),
 ("Area and perimeter", None, "A rectangle has a perimeter of 30 and a length of 9. What is its area?", ["54", "21", "270", "45"], "2(9) + 2w = 30, so w = 6. Area = 9 × 6 = 54."),
 ("Right triangle trigonometry", None, "In a right triangle, one acute angle measures 35°. Which expression is equal to sin(55°)?", ["cos(35°)", "sin(35°)", "tan(35°)", "1 − sin(35°)"], "The two acute angles add to 90°. The sine of one acute angle equals the cosine of the other."),
 ("Circles", None, "A circle in the xy-plane has the equation (x − 3)² + (y + 2)² = 25. What are its center and radius?",
  ["Center (3, −2), radius 5", "Center (−3, 2), radius 5", "Center (3, −2), radius 25", "Center (−3, 2), radius 25"], "In (x − h)² + (y − k)² = r², the center is (h, k) = (3, −2) and r² = 25, so r = 5."),
 ("Similar figures", None, "Two similar triangles have corresponding sides of length 4 and 10. If the smaller triangle's area is 12, what is the larger triangle's area?", ["75", "30", "60", "150"], "The side ratio is 10/4 = 2.5, so the area ratio is 2.5² = 6.25. 12 × 6.25 = 75."),
 ("Volume", None, "A cylinder has a radius of 3 and a height of 10. What is its volume?", ["90π", "30π", "60π", "900π"], "V = πr²h = π × 9 × 10 = 90π."),
 ("Right triangle trigonometry", None, "A right triangle has legs of length 5 and 12. What is the cosine of the angle opposite the side of length 5?", ["12/13", "5/13", "5/12", "13/12"], "The hypotenuse is 13 (5-12-13). For the angle opposite 5, the adjacent leg is 12, so cos = 12/13."),
]

NC = "NO CHANGE"
ACT_ENGLISH = [
 ("Verb tense", "My grandmother kept a garden behind her house in Macon. Every summer [[she grows]] tomatoes, peppers and okra.", BEST, [NC, "she grew", "she will grow", "she has been growing"], 1, "The paragraph is in the past (\"kept\"), so use the past tense: \"she grew.\""),
 ("Punctuation", "The garden was small, [[but it]] produced enough vegetables to feed our whole family.", BEST, [NC, "but, it", "it", "but it,"], 0, "Comma plus \"but\" correctly joins two complete sentences. The other choices add a wrong comma or create a comma splice."),
 ("Punctuation", "We spent hours [[picking, washing and, sorting]] the vegetables.", BEST, [NC, "picking, washing, and sorting", "picking washing, and sorting", "picking; washing; and sorting"], 1, "Separate items in a list with commas, and don't put a comma after \"and.\""),
 ("Agreement", "Each of the volunteers [[were given]] a map of the trail.", BEST, [NC, "was given", "were giving", "have been given"], 1, "The subject is \"Each\" (singular), so the verb is \"was given.\""),
 ("Concision", "At 5 a.m. [[in the early morning]], the bakers begin mixing dough.", BEST, [NC, "early in the morning", "in the morning hours", "DELETE the underlined portion."], 3, "\"5 a.m.\" already says it's early morning, so the phrase is redundant. Delete it."),
 ("Usage", "The company updated [[it's]] website last week.", BEST, [NC, "its", "its'", "their"], 1, "The website belongs to the company: possessive \"its.\" \"It's\" means \"it is,\" and \"its'\" is never correct."),
 ("Sentence structure", "The storm knocked out power across the [[county, crews]] worked through the night to restore it.", BEST, [NC, "county; crews", "county crews", "county, and, crews"], 1, "Two complete sentences can be joined with a semicolon. A comma alone is a comma splice."),
 ("Transitions", "Our team practiced every afternoon for a month. [[Nevertheless,]] we won the regional tournament.", BEST, [NC, "As a result,", "In contrast,", "Otherwise,"], 1, "Winning follows from practicing, so a cause-and-effect transition fits. \"Nevertheless\" signals a surprise."),
 ("Concision", "The new law [[will have an effect on and impact]] how schools plan their budgets.", BEST, [NC, "will affect", "will effect", "will have affect on"], 1, "\"Will affect\" says the same thing in two words. \"Affect\" is the verb; \"effect\" is usually the noun."),
 ("Writing strategy", "The Georgia Aquarium in Atlanta opened in 2005. It houses thousands of animals, including whale sharks. The writer is considering adding this sentence: \"My cousin got a job at a pizza place near the aquarium last year.\"",
  "Should the writer make this addition?", ["No, because it is unrelated to the paragraph's focus on the aquarium.", "Yes, because it shows that the aquarium is in a busy area.", "Yes, because it adds a personal detail that keeps readers interested.", "No, because it repeats information given earlier."], None, "The paragraph is about the aquarium and its animals. A cousin's pizza job is off topic."),
 ("Usage", "The band members tuned [[there]] instruments before the concert.", BEST, [NC, "their", "they're", "its"], 1, "The instruments belong to the band members: \"their.\" \"There\" is a place; \"they're\" means \"they are.\""),
 ("Usage", "Of the two routes, the river trail is the [[most scenic]].", BEST, [NC, "more scenic", "scenicest", "most scenic of all"], 1, "Comparing two things uses \"more\"; \"most\" is for three or more."),
 ("Modifiers", "Covered in mud, [[the dog ran]] into the kitchen after the storm.", BEST, [NC, "the kitchen saw the dog run", "running happened by the dog", "the dog's running went"], 0, "\"Covered in mud\" describes the dog, so \"the dog\" must come right after the comma. The original is correct."),
 ("Usage", "The coach, [[who]] had played in college, knew every drill.", BEST, [NC, "whom", "which", "whose"], 0, "\"Who\" is the subject of \"had played,\" so \"who\" is correct. Use \"which\" for things, not people."),
 ("Punctuation", "Both of my [[sister's]] cars need new tires.", BEST, [NC, "sisters'", "sisters", "sisters's"], 1, "\"Both\" means two sisters, so use the plural possessive: \"sisters'.\""),
 ("Sentence structure", "On weekends she likes hiking, swimming and [[to ride]] her bike.", BEST, [NC, "riding", "she rides", "ride"], 1, "Items in a list should match: hiking, swimming and riding."),
 ("Writing strategy", "By 8 a.m. the farmers market was [[busy]]. The writer wants to add a detail that best shows how crowded the market was.", "Which choice best accomplishes this goal?", [NC, "so packed that shoppers had to turn sideways to pass between the stalls", "open for business", "a place that many people like to visit"], 1, "Turning sideways to squeeze between stalls is a specific picture of a crowd. The others are vague or off goal."),
 ("Agreement", "Neither the coach nor the players [[was]] ready for the rain.", BEST, [NC, "were", "is", "has been"], 1, "With \"neither... nor,\" the verb agrees with the nearer subject, \"players\" (plural): \"were.\""),
 ("Punctuation", "She packed everything she needed for the [[trip: a]] tent, a stove and a sleeping bag.", BEST, [NC, "trip; a", "trip, which was a", "trip. A"], 0, "A colon after a complete sentence introduces a list. The original is correct."),
 ("Concision", "The reason the meeting was canceled [[is because]] the speaker was sick.", BEST, [NC, "is that", "is due to the fact that because", "was on account of because"], 1, "\"The reason... is because\" repeats itself. \"The reason... is that\" is correct and clear."),
 ("Transitions", "Cats are often thought of as independent. [[For example,]] many cats form strong bonds with their owners.", BEST, [NC, "However,", "Therefore,", "Similarly,"], 1, "Strong bonds contrast with being independent, so use \"However.\""),
 ("Usage", "The choir sang [[beautiful]] at the ceremony.", BEST, [NC, "beautifully", "more beautiful", "beauty"], 1, "\"Sang\" is a verb, so it needs an adverb: \"beautifully.\""),
]

ACT_MATH = [
 ("Percentages", None, "What is 15% of 240?", ["36", "24", "16", "160"], "0.15 × 240 = 36. (10% is 24 and 5% is 12; 24 + 12 = 36.)"),
 ("Linear equations", None, "If 5x + 3 = 2x − 12, what is the value of x?", ["−5", "−3", "5", "3"], "Subtract 2x: 3x + 3 = −12. Subtract 3: 3x = −15, so x = −5."),
 ("Lines", None, "What is the slope of the line 6x − 2y = 8?", ["3", "−3", "6", "−4"], "Solve for y: −2y = −6x + 8, so y = 3x − 4. The slope is 3."),
 ("Ratios", None, "The ratio of boys to girls in a club is 3:5. If the club has 40 members, how many are girls?", ["25", "15", "24", "8"], "3 + 5 = 8 parts, so each part is 40 / 8 = 5 members. Girls: 5 × 5 = 25."),
 ("Number sense", None, "What is the value of |−7| − |3 − 10|?", ["0", "14", "−14", "4"], "|−7| = 7 and |3 − 10| = |−7| = 7, so 7 − 7 = 0."),
 ("Exponents", None, "Which expression is equivalent to (2x²y)³?", ["8x⁶y³", "6x⁶y³", "2x⁶y³", "8x⁵y³"], "Cube each factor: 2³ = 8, (x²)³ = x⁶, y³. Multiply the exponents when raising a power to a power."),
 ("Area", None, "What is the area of a triangle with a base of 14 and a height of 9?", ["63", "126", "23", "31.5"], "Area = ½ × base × height = ½ × 14 × 9 = 63."),
 ("Coordinate geometry", None, "What is the midpoint of the segment with endpoints (−2, 5) and (6, −1)?", ["(2, 2)", "(4, 4)", "(4, −3)", "(2, 3)"], "Average the coordinates: ((−2 + 6) / 2, (5 + (−1)) / 2) = (2, 2)."),
 ("Coordinate geometry", None, "What is the distance between the points (1, 2) and (4, 6)?", ["5", "7", "25", "√7"], "The differences are 3 and 4, and √(3² + 4²) = √25 = 5."),
 ("Logarithms", None, "If log₂(x) = 5, what is the value of x?", ["32", "10", "25", "7"], "log₂(x) = 5 means 2⁵ = x, so x = 32."),
 ("Quadratics", None, "What is the sum of the solutions of x² − 9x + 20 = 0?", ["9", "20", "−9", "4"], "Factor: (x − 4)(x − 5) = 0, so x = 4 or 5, and 4 + 5 = 9."),
 ("Trigonometry", None, "In right triangle ABC, angle C is 90°, AC = 8 and BC = 6. What is tan A?", ["3/4", "4/3", "3/5", "4/5"], "tan A = opposite / adjacent. The side opposite A is BC = 6 and the side next to A is AC = 8, so 6/8 = 3/4."),
 ("Sequences", None, "What is the next term in the sequence 3, 6, 12, 24, ...?", ["48", "30", "36", "27"], "Each term is double the one before, so 24 × 2 = 48."),
 ("Functions", None, "If f(x) = 3x − 1 and g(x) = x², what is f(g(2))?", ["11", "25", "5", "12"], "Work inside out: g(2) = 4, then f(4) = 3(4) − 1 = 11. (25 is g(f(2)).)"),
 ("Percentages", None, "The price of a shirt went from $40 to $50. By what percent did the price increase?", ["25%", "20%", "10%", "50%"], "Percent change = change / original = 10 / 40 = 25%. Divide by the original price, not the new one."),
 ("Number sense", None, "What is the least common multiple of 6, 8 and 12?", ["24", "48", "96", "12"], "24 is the smallest number that 6, 8 and 12 all divide into evenly."),
 ("Inequalities", None, "Which describes all solutions of 2(x − 3) ≥ 10?", ["x ≥ 8", "x ≥ 6.5", "x ≤ 8", "x ≥ 2"], "Divide by 2: x − 3 ≥ 5. Add 3: x ≥ 8. (The sign only flips when you multiply or divide by a negative.)"),
 ("Complex numbers", None, "If i = √−1, what is the value of i² + i⁴?", ["0", "2", "−2", "2i"], "i² = −1 and i⁴ = (i²)² = 1, so the sum is 0."),
 ("Circles", None, "A circle has a circumference of 12π. What is its area?", ["36π", "144π", "12π", "6π"], "C = 2πr = 12π, so r = 6. Area = πr² = 36π."),
 ("Counting", None, "How many different 3-letter codes can be made from the letters A, B, C, D and E if no letter may repeat?", ["60", "125", "10", "15"], "5 choices for the first letter, 4 for the second and 3 for the third: 5 × 4 × 3 = 60."),
 ("Trigonometry", None, "What is the period of the function y = sin(2x)?", ["π", "2π", "4π", "π/2"], "The period of sin(bx) is 2π / b = 2π / 2 = π."),
 ("Statistics", None, "The average of x, 2x and 3x is 18. What is the value of x?", ["9", "3", "6", "18"], "(x + 2x + 3x) / 3 = 2x = 18, so x = 9."),
]

R_FARM = """The bus to Aunt Celia's farm left at six, and Nadia was the only passenger who had brought a book. She had chosen it carefully: a thick paperback with a cracked spine, the kind of book that promised to last the whole summer. By the time the bus turned off the highway onto a gravel road, she had not read a single page. Instead she had watched the pine trees thin out into fields, the fields into pastures, and the pastures into a long, unhurried creek that seemed to follow the bus like a dog.

Aunt Celia was waiting at the end of the road in a truck older than Nadia's mother. "You'll be bored by Thursday," she said, not unkindly, as she lifted the suitcase into the truck bed. "Everyone is. Then on Friday you'll find something to do, and you won't want to leave."

Nadia doubted it. At home there were friends, a library with air conditioning, and a phone signal that did not disappear behind hills. Here there were chickens and a horse named Biscuit who regarded her with what seemed like suspicion.

But on Wednesday, a day ahead of schedule, Aunt Celia handed her a pair of work gloves and pointed toward the barn. The fence along the north pasture had come down in a storm, and Biscuit had been wandering into the neighbor's corn. Mending it took the whole afternoon. Nadia's hands ached, and she had splinters even through the gloves. That evening, as she sat on the porch watching Biscuit graze safely inside the new rails, she realized she had not thought about her phone once.

The paperback stayed on the nightstand all summer. She told herself she would read it on the bus home.

(Passage written for ScholarTasks practice.)"""

R_LIBRARY = """Between 1883 and 1919, the industrialist Andrew Carnegie paid for the construction of more than 1,600 public library buildings in the United States. Today many Americans take the neighborhood library for granted, but in the late nineteenth century, free public libraries were rare outside large cities. Many collections belonged to private clubs or subscription libraries that charged members a fee.

Carnegie's gifts came with conditions. A town that wanted a library had to provide the land and promise to spend a set amount each year, usually about ten percent of the building grant, on books, staff and upkeep. Carnegie believed that a community should invest in its own library rather than simply receive one. Critics at the time complained that the requirement was a burden for small towns, and some communities turned the money down. Others objected to accepting money from a man whose steel company had been involved in bitter labor disputes.

Still, the program reshaped American towns. Because Carnegie paid for buildings rather than collections, local residents decided what the shelves would hold, and many libraries became gathering places for lectures, clubs and classes. Some historians argue that the libraries also helped turn librarianship into a profession, since towns needed trained staff to meet their yearly commitments.

Not every community benefited equally. In the segregated South, many Carnegie libraries were closed to Black residents, and only a small number of separate branches were built to serve them. The program's legacy, then, reflects both the promise of free public learning and the limits on who was allowed to share in it."""

R_MONARCH = """Each fall, millions of monarch butterflies in eastern North America begin a journey that can stretch nearly 3,000 miles, ending in the mountain forests of central Mexico. What makes the migration remarkable is not only its distance but the fact that none of the butterflies making the trip has ever made it before.

Monarchs born in early summer typically live only a few weeks. They mate, lay eggs on milkweed plants and die, and their offspring do the same. But the generation that emerges in late summer is different. These butterflies delay reproduction and can live for eight months or more, long enough to fly south, spend the winter clustered on fir trees, and begin the return trip in spring. In some cases it is their great-grandchildren that finally reach the northern edge of the range the following summer.

How do first-time travelers find their way? Researchers have found that monarchs use the position of the sun as a compass. Because the sun moves across the sky during the day, a sun compass works only if the animal can account for the time. Experiments suggest that monarchs rely on an internal clock, and some of that timekeeping happens in their antennae. In one study, butterflies whose antennae were painted black, blocking light, lost their sense of direction, while those whose antennae were coated with clear paint flew normally.

Scientists are still working to understand how monarchs find the same small patches of forest year after year. Some suspect that the butterflies also sense Earth's magnetic field, especially on cloudy days when the sun is hidden."""

ACT_READING = [
 ("Main idea", R_FARM, "The passage is mainly about:", ["a girl who comes to value a summer on her aunt's farm after expecting to be bored", "a girl's struggle to finish a difficult book", "an aunt who is planning to sell her farm", "a horse that escapes during a storm and is never found"], "Nadia expects boredom, then finds meaning in farm work. The book and the fence are details that support that change."),
 ("Details", R_FARM, "Aunt Celia's prediction that Nadia will \"be bored by Thursday\" turns out to be:", ["not quite accurate, because Nadia is busy with farm work even sooner than Celia expected", "completely accurate, because Nadia is bored all summer", "wrong, because Nadia spends the summer reading", "wrong, because Nadia leaves the farm early"], "Celia predicted boredom until Friday, but Nadia is fixing the fence on Wednesday, \"a day ahead of schedule.\""),
 ("Figurative language", R_FARM, "The comparison of the creek to a dog in the first paragraph mainly suggests that the creek:", ["seemed to stay close beside the bus as it traveled", "was dangerous to cross", "was full of animals", "made loud sounds"], "A dog that follows you stays nearby, so the creek ran alongside the road."),
 ("Inferences", R_FARM, "The detail that the paperback \"stayed on the nightstand all summer\" mainly suggests that Nadia:", ["was busy and engaged enough with farm life that she didn't need the book to pass the time", "disliked the book after reading the first chapter", "had forgotten how to read without a phone", "planned to give the book to her aunt"], "She brought the book to fight boredom; never opening it shows she wasn't bored."),
 ("Main idea", R_LIBRARY, "The main purpose of the passage is to:", ["describe Carnegie's library program, including its conditions, its effects and its limits", "argue that Carnegie was the most generous American in history", "explain how a town can apply for a library grant today", "compare subscription libraries with university libraries"], "Each paragraph covers one part: the program, its conditions, its effects and who was left out."),
 ("Details", R_LIBRARY, "According to the passage, a town that accepted a Carnegie grant had to:", ["provide the land and fund the library each year", "name the library after Carnegie", "buy books that Carnegie chose", "charge residents a membership fee"], "Paragraph 2: towns had to \"provide the land and promise to spend a set amount each year.\""),
 ("Inferences", R_LIBRARY, "The passage suggests that Carnegie required a yearly commitment from towns mainly because he believed that:", ["communities should invest in their own libraries", "small towns could not be trusted with money", "the federal government should pay librarians", "libraries should be run as private clubs"], "\"Carnegie believed that a community should invest in its own library rather than simply receive one.\""),
 ("Author's view", R_LIBRARY, "In the last paragraph, the author's attitude toward the program's legacy is best described as:", ["balanced, recognizing both its benefits and its unfairness", "entirely approving", "entirely critical", "uninterested"], "\"Both the promise of free public learning and the limits\" shows the author weighs both sides."),
 ("Details", R_MONARCH, "According to the passage, the generation of monarchs that migrates south differs from earlier summer generations because it:", ["delays reproduction and lives much longer", "feeds only on fir trees", "has already made the trip once before", "travels only on cloudy days"], "Paragraph 2: the late-summer generation delays reproduction and can live eight months or more."),
 ("Experiments", R_MONARCH, "In the antenna study, the group with clear paint was most likely included to:", ["show that the paint itself was not what disrupted navigation", "make the butterflies easier to see", "test whether butterflies prefer clear skies", "measure how far butterflies can fly"], "The clear-paint group got paint but still received light. Since they flew normally, blocked light, not paint, caused the problem. This is a control group."),
 ("Reasoning", R_MONARCH, "Based on the passage, a sun compass requires an internal clock because:", ["the sun's position in the sky changes over the course of the day", "butterflies fly only in the morning", "the sun is hidden during most of the migration", "clocks help butterflies find milkweed"], "\"Because the sun moves across the sky during the day,\" the butterfly must know the time to use the sun for direction."),
 ("Structure", R_MONARCH, "The last paragraph mainly serves to:", ["point out a question that scientists have not fully answered", "summarize the results of the antenna study", "argue that monarchs do not use the sun", "describe how monarchs choose mates"], "\"Scientists are still working to understand\" introduces an open question."),
]

S_SUGAR = """Students tested how water temperature affects how quickly sugar dissolves. In each trial, they stirred 10 g of sugar into 200 mL of water at a set temperature and timed how long it took for the sugar to dissolve completely.

Table 1
Water temperature (°C) | Time to dissolve (s)
10 | 150
25 | 95
40 | 60
55 | 38
70 | 25"""

S_LIGHT = """Botanists grew 3 groups of 20 bean seedlings for 14 days. Each group grew under the same light brightness but a different light color. All groups got the same amount of water and the same soil.

Table 1
Light color | Average height (cm) | Average number of leaves
Red | 18.2 | 6
Blue | 14.5 | 8
Green | 9.1 | 4"""

S_LEAVES = """Two scientists explain why some tree leaves turn red in autumn.

Scientist 1: The red color comes from pigments that are in the leaf all summer but are hidden by green chlorophyll. When chlorophyll breaks down in the fall, the red pigments are revealed.

Scientist 2: In most of these trees, red pigments (anthocyanins) are not present in summer leaves. As chlorophyll breaks down in the fall, the tree makes red pigments new. These pigments may shield the leaf from strong light while the tree pulls nutrients out of the leaf before it drops."""

ACT_SCIENCE = [
 ("Reading data", S_SUGAR, "According to Table 1, as water temperature increased, the time for the sugar to dissolve:", ["decreased only", "increased only", "increased, then decreased", "stayed about the same"], "Each higher temperature has a shorter time: 150, 95, 60, 38, 25."),
 ("Interpolation", S_SUGAR, "Based on Table 1, if the students had run a trial at 50°C, the time to dissolve would most likely have been closest to:", ["45 s", "65 s", "30 s", "20 s"], "50°C is between 40°C (60 s) and 55°C (38 s), so the time should be between 38 and 60 s. 45 s fits."),
 ("Experimental design", S_SUGAR, "Which variable did the students intentionally change from trial to trial?", ["Water temperature", "Mass of sugar", "Volume of water", "Time to dissolve"], "Temperature was set differently in each trial (the independent variable). Time was what they measured."),
 ("Experimental design", S_SUGAR, "Which of the following was held constant in every trial?", ["The mass of sugar", "The water temperature", "The time to dissolve", "Nothing was held constant"], "Every trial used 10 g of sugar (and 200 mL of water)."),
 ("Reading data", S_LIGHT, "Which light color produced the tallest seedlings on average?", ["Red", "Blue", "Green", "All three were the same height"], "Red: 18.2 cm, the largest average height."),
 ("Comparing results", S_LIGHT, "Which statement is supported by the results?", ["Blue light produced more leaves but shorter plants than red light.", "Green light produced the most leaves.", "Red light produced the most leaves.", "Height and leaf count ranked the colors in the same order."], "Blue: 8 leaves and 14.5 cm. Red: 6 leaves and 18.2 cm. So blue had more leaves but shorter plants."),
 ("Experimental design", S_LIGHT, "Why did the botanists give every group the same water and soil?", ["So that differences between groups could be linked to light color", "So the plants would grow as tall as possible", "To use less water", "Because water changes the color of light"], "Keeping everything else the same is what lets you say light color caused the differences."),
 ("Evaluating claims", S_LIGHT, "A student predicts that seedlings grown under white light would be shorter than seedlings grown under green light. Do the results support this prediction?", ["No; white light was not tested, so the results can't directly support it.", "Yes; green light produced the tallest plants.", "Yes; white light contains green light.", "No; white light produced the shortest plants."], "Only red, blue and green were tested. Don't use data the experiment doesn't have."),
 ("Comparing viewpoints", S_LEAVES, "Both scientists would most likely agree that:", ["chlorophyll breaks down in the fall", "red pigments are present in leaves all summer", "red pigments protect leaves from strong light", "leaves never contain red pigment"], "Both mention chlorophyll breaking down in fall. The other choices fit only one scientist, or neither."),
 ("Evaluating evidence", S_LEAVES, "Which finding would most strongly support Scientist 2?", ["Tests find almost no red pigment in maple leaves in July but large amounts in October.", "Tests find the same amount of red pigment in July and October.", "Green leaves contain chlorophyll.", "Some trees lose their leaves in winter."], "Scientist 2 says red pigment is made new in fall, so little in July and a lot in October supports that. Equal amounts would support Scientist 1."),
 ("Applying a viewpoint", S_LEAVES, "According to Scientist 1, if the chlorophyll were removed from a summer leaf of a tree whose leaves turn red in fall, the leaf would most likely look:", ["red", "green", "white", "blue"], "Scientist 1 says the red pigment is there all summer, only hidden by chlorophyll. Remove the chlorophyll and the red shows."),
 ("Understanding viewpoints", S_LEAVES, "Scientist 2 suggests that red pigments may help the tree by:", ["shielding the leaf from strong light while nutrients are moved out of it", "attracting insects to pollinate the tree", "making the leaf fall sooner", "helping the leaf absorb water"], "\"These pigments may shield the leaf from strong light while the tree pulls nutrients out of the leaf.\""),
]

# Batch 2 (grows each section to about 100 questions).
from test_prep_more_sat_rw import SAT_RW_MORE
from test_prep_more_sat_math import SAT_MATH_MORE
from test_prep_more_act_english import ACT_ENGLISH_MORE
from test_prep_more_act_math import ACT_MATH_MORE
from test_prep_more_act_reading_a import ACT_READING_MORE_A
from test_prep_more_act_reading_b import ACT_READING_MORE_B
from test_prep_more_act_science import ACT_SCIENCE_MORE

def passage_sets(sets):
    return [(topic, passage, question, options, expl) for passage, qs in sets for topic, question, options, expl in qs]

SAT_RW += SAT_RW_MORE
SAT_MATH += SAT_MATH_MORE
ACT_ENGLISH += ACT_ENGLISH_MORE
ACT_MATH += ACT_MATH_MORE
ACT_READING += passage_sets(ACT_READING_MORE_A + ACT_READING_MORE_B)
ACT_SCIENCE += passage_sets(ACT_SCIENCE_MORE)

SETS = [
 ("SAT", "SAT Reading and Writing", SAT_RW),
 ("SAT", "SAT Math", SAT_MATH),
 ("ACT", "ACT English", ACT_ENGLISH),
 ("ACT", "ACT Math", ACT_MATH),
 ("ACT", "ACT Reading", ACT_READING),
 ("ACT", "ACT Science", ACT_SCIENCE),
]

def q(s):
    if s is None:
        return "null"
    assert '$q$' not in s
    return '$q$' + s + '$q$'

def num(s):
    try:
        return float(s.replace("−", "-").replace(",", "").replace("$", "").replace("%", ""))
    except ValueError:
        return None

rows = []
for exam, subject, items in SETS:
    seen = set()
    for item in items:
        if len(item) == 6:
            topic, passage, question, options, ans, expl = item
            if ans is None:  # written correct-first, shuffle
                ans = 0
                fixed = False
            else:
                fixed = True
        else:
            topic, passage, question, options, expl = item
            ans, fixed = 0, False
        assert len(options) == 4 and len(set(options)) == 4, question
        key = (question, passage)
        assert key not in seen, question
        seen.add(key)
        assert len(question) <= 1000 and (passage is None or len(passage) <= 3000) and len(expl) <= 1000, question
        if fixed and options[0] == NC:
            # Mix the order of the other choices (DELETE stays last, like the real test).
            correct = options[ans]
            rest = [o for o in options[1:] if not o.startswith("DELETE")]
            random.Random(question + (passage or "")).shuffle(rest)
            options = [NC] + rest + [o for o in options[1:] if o.startswith("DELETE")]
            ans = options.index(correct)
        if not fixed:
            correct = options[ans]
            nums = [num(o) for o in options]
            if all(n is not None for n in nums):
                options = sorted(options, key=num)  # number answers in order, like the real tests
            else:
                options = options[:]
                random.Random(question + (passage or "")).shuffle(options)
            ans = options.index(correct)
        rows.append(f"  ('{exam}', {q(subject)}, {q(topic)}, 'mc', {q(passage)}, {q(question)}, {q(json.dumps(options, ensure_ascii=False))}::jsonb, {ans}, {q(expl)})")

out = ["-- ScholarTasks SAT and ACT practice questions, written for ScholarTasks (not taken from College Board or ACT materials).",
"-- Safe to run twice: questions already in the bank are skipped. All start as WAITING for teacher review at /admin/questions.",
"insert into practice_questions (exam, subject, topic, kind, passage, question, options, answer_index, explanation, status)",
"select v.exam, v.subject, v.topic, v.kind, v.passage, v.question, v.options, v.answer_index, v.explanation, 'pending' from (values",
",\n".join(rows),
") as v(exam, subject, topic, kind, passage, question, options, answer_index, explanation)",
"where not exists (select 1 from practice_questions p where p.subject = v.subject and p.question = v.question and coalesce(p.passage, '') = coalesce(v.passage, ''));"]
open(__file__.replace('.py', '.sql'), 'w').write("\n".join(out) + "\n")
print(len(rows), {sub: len(items) for _, sub, items in SETS})
