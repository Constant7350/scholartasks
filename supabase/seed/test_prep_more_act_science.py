# More original ACT Science data sets (batch 2), written for ScholarTasks.
# Experiments and data are invented for practice.
# Each set: (passage, [(topic, question, [correct, wrong, wrong, wrong], explanation), ...])

S1 = """A student measured how far a toy car rolled after leaving ramps of different heights. Each trial used the same car and the same floor.

Table 1
Ramp height (cm) | Distance rolled (cm)
10 | 52
20 | 101
30 | 149
40 | 203
50 | 248"""
Q1 = [
 ("Reading data", "According to Table 1, when the ramp height was 30 cm, the car rolled:", ["149 cm", "101 cm", "203 cm", "30 cm"], "Read across the 30 cm row."),
 ("Trends", "Based on Table 1, as ramp height increased, distance rolled:", ["increased", "decreased", "stayed the same", "increased, then decreased"], "Each larger height gives a longer distance."),
 ("Extrapolation", "If the trend continued, a ramp height of 60 cm would most likely give a distance closest to:", ["300 cm", "250 cm", "350 cm", "200 cm"], "Distance rises about 50 cm per 10 cm of height, so 60 cm → about 300 cm."),
 ("Experimental design", "Which variable was held constant?", ["The car used", "Ramp height", "Distance rolled", "Nothing was held constant"], "The same car and floor were used in every trial."),
]

S2 = """Figure 1 (described in text): The average temperature in a city each month of one year.
Jan 6°C, Feb 8°C, Mar 12°C, Apr 17°C, May 21°C, Jun 26°C, Jul 28°C, Aug 27°C, Sep 23°C, Oct 17°C, Nov 10°C, Dec 7°C."""
Q2 = [
 ("Reading data", "Which month had the highest average temperature?", ["July", "June", "August", "September"], "July: 28°C is the highest value."),
 ("Comparing data", "Which two months had the same average temperature?", ["April and October", "March and November", "May and September", "January and December"], "Both April and October were 17°C."),
 ("Calculations", "The difference between the warmest and coldest monthly averages was:", ["22°C", "20°C", "28°C", "34°C"], "28 − 6 = 22°C."),
 ("Trends", "Between which two consecutive months did the average temperature fall the most?", ["October to November", "September to October", "November to December", "August to September"], "Falls: Aug→Sep 4, Sep→Oct 6, Oct→Nov 7, Nov→Dec 3. The largest is October to November."),
]

S3 = """Experiment 1: Students placed 5 g of each of four powders into 100 mL of water at 25°C, stirred for 2 minutes, and recorded whether all of the powder dissolved.
Powder A: all dissolved. Powder B: some remained. Powder C: all dissolved. Powder D: most remained.

Experiment 2: The students repeated Experiment 1 with water at 60°C.
Powder A: all dissolved. Powder B: all dissolved. Powder C: all dissolved. Powder D: some remained."""
Q3 = [
 ("Comparing results", "Which powder did NOT fully dissolve in either experiment?", ["Powder D", "Powder A", "Powder B", "Powder C"], "D had some or most remaining in both experiments."),
 ("Comparing results", "Which powder fully dissolved only at the higher temperature?", ["Powder B", "Powder A", "Powder C", "Powder D"], "B had some remaining at 25°C but all dissolved at 60°C."),
 ("Experimental design", "The variable that changed between Experiment 1 and Experiment 2 was:", ["water temperature", "the mass of powder", "the volume of water", "the stirring time"], "Only the water temperature changed (25°C to 60°C)."),
 ("Conclusions", "The results support which statement?", ["For these powders, warmer water dissolved as much or more powder than cooler water.", "Warmer water dissolved less of every powder.", "Temperature had no effect on any powder.", "All four powders dissolved fully at 25°C."], "B and D did better at 60°C; A and C dissolved fully at both."),
]

S4 = """A biologist counted the number of frogs heard calling at a pond on 6 evenings and recorded the air temperature.

Table 1
Evening | Temperature (°C) | Frogs calling
1 | 12 | 4
2 | 15 | 9
3 | 18 | 15
4 | 21 | 22
5 | 24 | 26
6 | 27 | 27"""
Q4 = [
 ("Trends", "Based on Table 1, as temperature increased, the number of frogs calling:", ["increased", "decreased", "stayed constant", "decreased, then increased"], "The count rises every evening."),
 ("Trends", "Between which two evenings did the number of frogs calling increase the LEAST?", ["Evenings 5 and 6", "Evenings 1 and 2", "Evenings 3 and 4", "Evenings 2 and 3"], "Increases: 5, 6, 7, 4, 1. The smallest is from evening 5 to 6."),
 ("Interpolation", "At 20°C, the number of frogs calling would most likely be about:", ["20", "12", "26", "9"], "20°C is between 18°C (15) and 21°C (22), closer to 21°C: about 20."),
 ("Evaluating claims", "A student claims that warmer temperatures cause frogs to call. Is this claim fully supported?", ["No; the data show a pattern, but other factors that change with temperature were not controlled.", "Yes; the number of frogs rose with temperature.", "Yes; the biologist controlled every other factor.", "No; fewer frogs called on warmer evenings."], "An observational pattern doesn't prove cause when other factors (time of year, humidity) weren't controlled."),
]

S5 = """Two students discuss why a metal spoon feels colder than a wooden spoon, even though both have been in the same room for hours.

Student 1: The metal spoon really is colder than the wooden spoon. Metal objects stay at a lower temperature than wooden objects in the same room.

Student 2: Both spoons are at the same temperature as the room. Metal feels colder because it conducts heat away from your hand much faster than wood does, so your skin cools more quickly when you touch it."""
Q5 = [
 ("Comparing viewpoints", "The students disagree about whether:", ["the two spoons are actually at different temperatures", "the spoons are in the same room", "metal is a different material from wood", "your hand can feel temperature"], "Student 1 says the metal is colder; Student 2 says both are at room temperature."),
 ("Evaluating evidence", "A thermometer shows that both spoons are 22°C. This result supports:", ["Student 2 only", "Student 1 only", "both students", "neither student"], "Equal temperatures contradict Student 1 and match Student 2."),
 ("Understanding viewpoints", "According to Student 2, metal feels colder because it:", ["conducts heat away from the hand faster", "is heavier than wood", "absorbs cold from the air", "has a lower temperature than wood"], "Student 2's explanation is about heat conduction."),
 ("Applying a viewpoint", "Based on Student 2's explanation, which would most likely feel coldest to touch in the same room?", ["A stone countertop", "A wool blanket", "A foam cup", "A cotton towel"], "Stone conducts heat away from skin faster than wool, foam or cotton."),
]

S6 = """Researchers tested how the amount of fertilizer affects the mass of tomatoes produced. Five groups of 10 plants each received a different amount of fertilizer per week. All other conditions were the same.

Table 1
Fertilizer (g/week) | Average tomato mass per plant (kg)
0 | 1.2
5 | 2.0
10 | 2.6
15 | 2.7
20 | 2.3"""
Q6 = [
 ("Reading data", "Which fertilizer amount produced the greatest average tomato mass?", ["15 g/week", "10 g/week", "20 g/week", "5 g/week"], "2.7 kg at 15 g/week is the highest."),
 ("Trends", "Based on Table 1, as fertilizer increased from 0 to 20 g/week, tomato mass:", ["increased, then decreased", "increased only", "decreased only", "stayed the same"], "Mass rose up to 15 g/week, then fell at 20."),
 ("Calculations", "How much more tomato mass did plants with 10 g/week produce than plants with no fertilizer?", ["1.4 kg", "2.6 kg", "1.2 kg", "0.6 kg"], "2.6 − 1.2 = 1.4 kg."),
 ("Experimental design", "What was the purpose of the group that received 0 g/week?", ["To serve as a control for comparison", "To test the most fertilizer", "To measure soil temperature", "To speed up growth"], "The no-fertilizer group shows what happens without the treatment."),
]

S7 = """Study 1: A scientist dropped a ball from a height of 2.0 m onto four different surfaces and measured how high it bounced.
Concrete: 1.5 m. Wood: 1.2 m. Carpet: 0.6 m. Sand: 0.1 m.

Study 2: The scientist dropped the same ball onto concrete from different heights.
1.0 m drop: 0.75 m bounce. 2.0 m drop: 1.5 m bounce. 3.0 m drop: 2.25 m bounce."""
Q7 = [
 ("Comparing results", "In Study 1, which surface produced the lowest bounce?", ["Sand", "Carpet", "Wood", "Concrete"], "Sand: 0.1 m."),
 ("Patterns", "In Study 2, the bounce height was always what fraction of the drop height?", ["3/4", "1/2", "2/3", "1/4"], "0.75 / 1.0 = 1.5 / 2.0 = 2.25 / 3.0 = 0.75."),
 ("Prediction", "Based on Study 2, a 4.0 m drop onto concrete would most likely produce a bounce of:", ["3.0 m", "2.5 m", "4.0 m", "3.5 m"], "3/4 of 4.0 m is 3.0 m."),
 ("Experimental design", "Which variable was changed in Study 2 but kept the same in Study 1?", ["Drop height", "Surface", "The ball", "Bounce height"], "Study 1 always used 2.0 m; Study 2 changed the height."),
]

S8 = """Two hypotheses explain why the population of a lake's small fish dropped sharply over five years.

Hypothesis 1: A larger predatory fish, introduced to the lake six years ago, has been eating the small fish faster than they can reproduce.

Hypothesis 2: Fertilizer runoff from nearby farms caused large algae blooms. When the algae die and decay, they use up oxygen in the water, and the small fish die from lack of oxygen."""
Q8 = [
 ("Evaluating evidence", "Which finding would most strongly support Hypothesis 1?", ["Stomachs of the predatory fish contain many small fish.", "Oxygen levels in the lake have dropped.", "Algae blooms have become more common.", "Nearby farms use more fertilizer than before."], "Evidence that predators eat the small fish supports Hypothesis 1."),
 ("Evaluating evidence", "Which finding would most strongly support Hypothesis 2?", ["Dead small fish are found mostly after algae blooms, when oxygen is low.", "The predatory fish population has grown.", "Small fish are found in predators' stomachs.", "The lake's temperature has not changed."], "Deaths tied to low oxygen after blooms support Hypothesis 2."),
 ("Comparing viewpoints", "The two hypotheses agree that:", ["the small-fish population has declined", "farms are the cause of the decline", "predators are the cause of the decline", "oxygen levels are normal"], "Both start from the drop in small fish."),
 ("Evaluating evidence", "If oxygen levels in the lake were measured and found to be normal throughout the five years, this would weaken:", ["Hypothesis 2 only", "Hypothesis 1 only", "both hypotheses", "neither hypothesis"], "Hypothesis 2 depends on low oxygen; Hypothesis 1 doesn't."),
]

S9 = """Students measured the time for a pendulum to complete 10 swings, using different string lengths. The mass of the weight stayed the same.

Table 1
String length (cm) | Time for 10 swings (s)
25 | 10.0
50 | 14.2
100 | 20.1
200 | 28.4"""
Q9 = [
 ("Trends", "Based on Table 1, as string length increased, the time for 10 swings:", ["increased", "decreased", "stayed the same", "increased, then decreased"], "Each longer string took more time."),
 ("Patterns", "When the string length was multiplied by 4 (from 25 cm to 100 cm), the time for 10 swings was about:", ["doubled", "the same", "multiplied by 4", "cut in half"], "10.0 s became about 20.1 s, roughly double."),
 ("Calculations", "For the 100 cm string, the time for ONE swing was about:", ["2.0 s", "20.1 s", "10.0 s", "0.2 s"], "20.1 s / 10 swings ≈ 2.0 s."),
 ("Experimental design", "Why did the students time 10 swings instead of 1?", ["To reduce the effect of timing errors on the result", "Because one swing takes too long", "To change the mass of the weight", "To make the pendulum swing faster"], "Timing many swings spreads small reaction-time errors over a longer total."),
]

S10 = """A scientist tested how salt concentration affects the boiling point of water. Each solution was 500 mL.

Table 1
Salt added (g) | Boiling point (°C)
0 | 100.0
20 | 100.7
40 | 101.4
60 | 102.1
80 | 102.8"""
Q10 = [
 ("Patterns", "According to Table 1, each additional 20 g of salt raised the boiling point by:", ["0.7°C", "1.4°C", "0.2°C", "2.0°C"], "100.0 → 100.7 → 101.4: +0.7 each time."),
 ("Extrapolation", "Based on the pattern, 100 g of salt would most likely give a boiling point of:", ["103.5°C", "103.0°C", "104.2°C", "102.8°C"], "102.8 + 0.7 = 103.5°C."),
 ("Interpolation", "A solution with 30 g of salt would most likely boil at about:", ["101.05°C", "100.7°C", "101.4°C", "100.3°C"], "Halfway between 20 g (100.7) and 40 g (101.4) is about 101.05°C."),
 ("Experimental design", "Which of the following was held constant?", ["The volume of each solution", "The amount of salt", "The boiling point", "Nothing was held constant"], "Each solution was 500 mL."),
]

S11 = """Researchers counted bird species at five sites with different amounts of tree cover.

Table 1
Site | Tree cover (%) | Bird species counted
V | 10 | 6
W | 30 | 11
X | 50 | 17
Y | 70 | 21
Z | 90 | 24"""
Q11 = [
 ("Reading data", "Which site had 17 bird species?", ["Site X", "Site W", "Site Y", "Site V"], "Site X: 50% tree cover, 17 species."),
 ("Trends", "Based on Table 1, sites with more tree cover tended to have:", ["more bird species", "fewer bird species", "the same number of species", "no birds"], "Species counts rise with tree cover."),
 ("Interpolation", "A site with 60% tree cover would most likely have about:", ["19 species", "15 species", "23 species", "12 species"], "Between X (17) and Y (21): about 19."),
 ("Calculations", "How many more species were counted at Site Z than at Site V?", ["18", "24", "6", "14"], "24 − 6 = 18."),
]

S12 = """Two students explain why a cut apple turns brown.

Student 1: The brown color forms when a substance released from the apple's damaged cells reacts with oxygen in the air. Without oxygen, the apple would not brown.

Student 2: Apples turn brown because they dry out. When the cut surface loses water, the color changes, whether or not air is present."""
Q12 = [
 ("Evaluating evidence", "A cut apple sealed in a container with no oxygen, but which still dries out, stays white. This result supports:", ["Student 1 only", "Student 2 only", "both students", "neither student"], "No oxygen, no browning, even with drying: supports Student 1 and contradicts Student 2."),
 ("Applying a viewpoint", "According to Student 1, coating a cut apple with lemon juice to keep air off its surface would most likely:", ["slow or prevent browning", "speed up browning", "have no effect", "make the apple dry out faster"], "Student 1 says oxygen causes browning, so blocking air should slow it."),
 ("Understanding viewpoints", "According to Student 2, the main cause of browning is:", ["loss of water", "reaction with oxygen", "bacteria", "sunlight"], "Student 2 says browning happens because the apple dries out."),
 ("Comparing viewpoints", "Both students would agree that:", ["a cut apple's surface can turn brown", "oxygen is needed for browning", "drying alone causes browning", "apples never turn brown"], "Both are explaining why a cut apple turns brown."),
]

S13 = """A student tested how the number of batteries affects the brightness of a bulb, measured in lumens, using identical batteries and the same bulb.

Table 1
Number of batteries | Brightness (lumens)
1 | 15
2 | 58
3 | 132
4 | 230"""
Q13 = [
 ("Trends", "As the number of batteries increased, brightness:", ["increased by larger amounts each time", "increased by the same amount each time", "decreased", "stayed the same"], "Increases: 43, 74, 98, so each step adds more."),
 ("Calculations", "How much brighter was the bulb with 4 batteries than with 2?", ["172 lumens", "115 lumens", "230 lumens", "58 lumens"], "230 − 58 = 172."),
 ("Prediction", "With 5 batteries (if the bulb did not burn out), brightness would most likely be:", ["greater than 230 lumens", "about 200 lumens", "about 15 lumens", "exactly 230 lumens"], "The trend is rising, so more batteries should give more than 230."),
 ("Experimental design", "Why did the student use identical batteries and the same bulb?", ["So that changes in brightness could be linked to the number of batteries", "To make the bulb last longer", "Because different bulbs are always brighter", "To reduce the brightness"], "Controlling other variables isolates the effect of battery number."),
]

S14 = """Experiment: Students placed identical ice cubes in four cups made of different materials and measured how long each took to melt completely in the same room.

Plastic cup: 42 min. Glass cup: 35 min. Foam cup: 68 min. Metal cup: 24 min."""
Q14 = [
 ("Reading data", "In which cup did the ice melt fastest?", ["Metal", "Glass", "Plastic", "Foam"], "24 minutes in metal is the shortest time."),
 ("Ordering", "Which list orders the cups from slowest melting to fastest melting?", ["Foam, plastic, glass, metal", "Metal, glass, plastic, foam", "Plastic, foam, metal, glass", "Glass, metal, foam, plastic"], "68, 42, 35, 24 minutes."),
 ("Conclusions", "The results suggest that the best insulator of the four materials was:", ["foam", "metal", "glass", "plastic"], "The ice lasted longest in foam, so foam slowed heat flow the most."),
 ("Experimental design", "Which change would most improve the reliability of the results?", ["Repeat the test several times with each cup", "Use a different-size ice cube in each cup", "Put each cup in a different room", "Test only the metal cup"], "Repeated trials reduce the effect of chance."),
]

S15 = """Scientists measured the concentration of carbon dioxide (CO₂) in the air at a monitoring station in May of several years.

Table 1
Year | CO₂ (parts per million)
2000 | 371
2005 | 382
2010 | 393
2015 | 404
2020 | 417"""
Q15 = [
 ("Trends", "According to Table 1, CO₂ concentration from 2000 to 2020:", ["increased", "decreased", "stayed the same", "increased, then decreased"], "Each value is higher than the one before."),
 ("Calculations", "By how much did CO₂ increase from 2000 to 2020?", ["46 ppm", "417 ppm", "11 ppm", "36 ppm"], "417 − 371 = 46."),
 ("Interpolation", "The CO₂ concentration in 2012 was most likely closest to:", ["397 ppm", "393 ppm", "404 ppm", "385 ppm"], "Between 393 (2010) and 404 (2015), about 2/5 of the way: about 397."),
 ("Comparing data", "During which 5-year period did CO₂ increase the most?", ["2015 to 2020", "2000 to 2005", "2005 to 2010", "2010 to 2015"], "Increases: 11, 11, 11, 13. The largest is 2015 to 2020."),
]

S16 = """Study: A researcher tested how quickly an enzyme breaks down starch at different pH levels. Higher reaction rate means faster breakdown.

pH 3: rate 2. pH 5: rate 9. pH 7: rate 15. pH 9: rate 6. pH 11: rate 1."""
Q16 = [
 ("Reading data", "At which pH was the enzyme most active?", ["pH 7", "pH 5", "pH 9", "pH 3"], "Rate 15 at pH 7 is the highest."),
 ("Trends", "As pH increased from 3 to 11, the reaction rate:", ["increased, then decreased", "increased only", "decreased only", "stayed the same"], "Rate rose to pH 7 and then fell."),
 ("Interpolation", "At pH 8, the rate would most likely be between:", ["6 and 15", "1 and 2", "15 and 20", "2 and 6"], "pH 8 is between pH 7 (15) and pH 9 (6)."),
 ("Conclusions", "Which statement is supported by the study?", ["The enzyme works best in a neutral pH range and poorly in strong acids or bases.", "The enzyme works equally well at every pH.", "The enzyme works best in strong acid.", "The enzyme does not break down starch."], "Activity peaks near pH 7 and is low at pH 3 and 11."),
]

S17 = """Two scientists explain why a large meteor crater on a planet's surface has very little erosion.

Scientist 1: The crater is young. It formed recently enough that wind and water have not had time to wear it down.

Scientist 2: The crater may be very old. The planet has had almost no wind or liquid water for billions of years, so even old craters stay sharp."""
Q17 = [
 ("Comparing viewpoints", "The scientists disagree mainly about:", ["the age of the crater", "whether the crater exists", "whether craters can erode", "the size of the crater"], "Scientist 1 says young; Scientist 2 says it may be old."),
 ("Evaluating evidence", "Evidence that the planet has had flowing water and strong winds in the past million years would weaken:", ["Scientist 2's explanation", "Scientist 1's explanation", "both explanations", "neither explanation"], "Scientist 2 depends on there being almost no wind or water for billions of years."),
 ("Evaluating evidence", "If many other craters on the planet known to be billions of years old are also sharp and uneroded, this would support:", ["Scientist 2", "Scientist 1", "both scientists", "neither scientist"], "Old craters staying sharp shows erosion is slow there, matching Scientist 2."),
 ("Comparing viewpoints", "Both scientists would likely agree that:", ["erosion by wind and water wears down craters over time", "the crater is billions of years old", "the planet has lots of liquid water", "the crater formed last year"], "Both explanations assume wind and water erode craters."),
]

S18 = """Students recorded how many seeds sprouted out of 50 planted at different soil temperatures over 10 days.

Table 1
Soil temperature (°C) | Seeds sprouted (of 50)
10 | 6
15 | 18
20 | 37
25 | 45
30 | 41
35 | 22"""
Q18 = [
 ("Reading data", "At which temperature did the most seeds sprout?", ["25°C", "20°C", "30°C", "35°C"], "45 seeds at 25°C is the highest."),
 ("Calculations", "What percent of seeds sprouted at 20°C?", ["74%", "37%", "50%", "90%"], "37 / 50 = 0.74 = 74%."),
 ("Trends", "Based on Table 1, sprouting was lowest at:", ["10°C", "35°C", "15°C", "30°C"], "Only 6 seeds sprouted at 10°C."),
 ("Conclusions", "The results suggest that for these seeds:", ["there is a best temperature range for sprouting, and both colder and hotter soil reduce it", "hotter soil always increases sprouting", "colder soil always increases sprouting", "temperature has no effect on sprouting"], "Sprouting peaked at 25°C and fell on both sides."),
]

S19 = """Experiment 1: A student measured the speed of sound in air at different temperatures.
0°C: 331 m/s. 10°C: 337 m/s. 20°C: 343 m/s. 30°C: 349 m/s.

Experiment 2: The student looked up the speed of sound in different materials at 20°C.
Air: 343 m/s. Water: 1,480 m/s. Steel: 5,960 m/s."""
Q19 = [
 ("Patterns", "According to Experiment 1, each 10°C increase in air temperature increased the speed of sound by about:", ["6 m/s", "10 m/s", "3 m/s", "12 m/s"], "331 → 337 → 343 → 349: +6 each time."),
 ("Extrapolation", "Based on Experiment 1, the speed of sound in air at 40°C would most likely be about:", ["355 m/s", "349 m/s", "361 m/s", "343 m/s"], "349 + 6 = 355 m/s."),
 ("Comparing data", "According to Experiment 2, sound travels fastest through:", ["steel", "water", "air", "all three equally"], "5,960 m/s in steel is the fastest."),
 ("Calculations", "About how many times faster is sound in water than in air at 20°C?", ["About 4 times", "About 2 times", "About 10 times", "About 17 times"], "1,480 / 343 ≈ 4.3."),
]

S20 = """Two students explain why a balloon shrinks when it is put in a freezer.

Student 1: The cold air in the freezer squeezes the balloon from the outside, pressing it smaller.

Student 2: The gas inside the balloon cools, and its particles move more slowly. They push on the inside of the balloon less, so the balloon contracts. When the balloon warms up again, it will return to its original size."""
Q20 = [
 ("Evaluating evidence", "A balloon taken out of the freezer returns to its original size as it warms. This observation is directly predicted by:", ["Student 2 only", "Student 1 only", "both students", "neither student"], "Student 2 explicitly predicts the balloon returns to its size when warmed."),
 ("Understanding viewpoints", "According to Student 2, the balloon shrinks because:", ["the gas particles inside move more slowly when cooled", "cold air squeezes it from outside", "gas leaks out of the balloon", "the rubber gets thicker"], "Student 2 explains it with slower particle motion."),
 ("Applying a viewpoint", "Based on Student 2's explanation, placing the balloon in a hot car would most likely make it:", ["expand", "shrink", "stay the same size", "pop immediately"], "Warmer gas particles move faster and push outward more."),
 ("Evaluating evidence", "A sealed, rigid metal container placed in the freezer does not change size, but the pressure of the gas inside drops. This finding is most consistent with:", ["Student 2", "Student 1", "both students", "neither student"], "Lower inside pressure when cooled matches Student 2's idea that cooled gas pushes less."),
]

S21 = """A scientist measured the population of rabbits and foxes in a region over 6 years.

Table 1
Year | Rabbits | Foxes
1 | 800 | 40
2 | 1,100 | 45
3 | 900 | 70
4 | 600 | 60
5 | 750 | 42
6 | 1,000 | 48"""
Q21 = [
 ("Reading data", "In which year was the fox population largest?", ["Year 3", "Year 4", "Year 2", "Year 6"], "70 foxes in Year 3."),
 ("Patterns", "The fox population peaked about one year after the rabbit population peaked. Which years show this?", ["Rabbits peaked in Year 2; foxes peaked in Year 3.", "Rabbits peaked in Year 1; foxes peaked in Year 2.", "Rabbits peaked in Year 3; foxes peaked in Year 4.", "Both peaked in Year 6."], "Rabbits: 1,100 in Year 2. Foxes: 70 in Year 3."),
 ("Reasoning", "Which explanation best fits the pattern in Table 1?", ["More rabbits provide more food for foxes, and more foxes then reduce the rabbit population.", "Foxes and rabbits do not affect each other.", "Rabbits eat foxes.", "Fox numbers always rise every year."], "This is a typical predator-prey cycle."),
 ("Calculations", "By how many did the rabbit population change from Year 2 to Year 4?", ["Decreased by 500", "Increased by 500", "Decreased by 300", "Decreased by 200"], "1,100 − 600 = 500 fewer."),
]

S22 = """Researchers tested three sunscreen lotions. They covered equal areas of UV-sensitive paper with each lotion, placed the paper in sunlight for 30 minutes, and measured how much the paper changed color on a scale of 0 (no change) to 10 (complete change).

No lotion: 10. Lotion P: 7. Lotion Q: 2. Lotion R: 4."""
Q22 = [
 ("Reading data", "Which lotion blocked the most UV light?", ["Lotion Q", "Lotion R", "Lotion P", "No lotion"], "Lotion Q had the least color change (2)."),
 ("Ordering", "Which list orders the lotions from most to least protective?", ["Q, R, P", "P, R, Q", "R, Q, P", "Q, P, R"], "Color change: Q 2, R 4, P 7. Less change means more protection."),
 ("Experimental design", "What was the purpose of the paper with no lotion?", ["To show the color change with no protection, for comparison", "To test a fourth lotion", "To measure sunlight temperature", "To keep the paper dry"], "It's the control."),
 ("Evaluating claims", "A student claims Lotion Q will protect skin best. What is the main limitation of this conclusion?", ["The test used paper, not skin, and may not reflect how the lotions work on people.", "Lotion Q had the most color change.", "No control was used.", "The paper was in sunlight for too short a time to change at all."], "Results on UV paper may not match results on human skin."),
]

ACT_SCIENCE_MORE = [(S1, Q1), (S2, Q2), (S3, Q3), (S4, Q4), (S5, Q5), (S6, Q6), (S7, Q7), (S8, Q8), (S9, Q9), (S10, Q10), (S11, Q11), (S12, Q12), (S13, Q13), (S14, Q14), (S15, Q15), (S16, Q16), (S17, Q17), (S18, Q18), (S19, Q19), (S20, Q20), (S21, Q21), (S22, Q22)]
