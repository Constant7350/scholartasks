# More original ACT Reading passages (batch 2, part A), written for ScholarTasks.
# Each passage: (passage text, [(topic, question, [correct, wrong, wrong, wrong], explanation), ...])
FIC = "\n\n(Passage written for ScholarTasks practice.)"

P1 = """Every Saturday morning, Dad and I drove to the flea market on the edge of town, where he searched for broken radios. He never bought one that worked. "Where's the fun in that?" he would say, turning a cracked plastic case over in his hands as if it were a seashell.

At home, the radios lined the shelves of his workbench in the garage, waiting. I was twelve before I understood that he didn't just collect them. One night I found him bent over a small brown radio from the 1950s, a magnifying lamp throwing a circle of white light onto its insides. He was replacing a part no bigger than a grain of rice.

"Hand me the tweezers," he said, without looking up. I did, and then I stayed. He showed me how to test each part, how to read the tiny colored bands that told you what a resistor was, how to heat the solder just enough. Around midnight he flipped the switch. For a moment there was nothing. Then a hiss, and then, faint and warm, a man's voice reading the late-night weather.

Dad leaned back and grinned like he'd caught a fish. I realized then that the radios were never the point. The point was the moment a silent thing began to speak.

I'm older now, and my own workbench holds a row of broken things. When my daughter asks why I don't just buy new ones, I hand her the tweezers.""" + FIC
Q1 = [
 ("Main idea", "The passage is mainly about:", ["how the narrator came to share and pass on a father's love of repairing radios", "how to build a radio from new parts", "a family's move to a new town", "the history of the flea market"], "The narrator learns repair from Dad, finds its meaning, and now passes it to a daughter."),
 ("Details", "According to the passage, the father bought radios at the flea market only if they:", ["did not work", "were made in the 1950s", "came with their original cases", "were inexpensive"], "\"He never bought one that worked.\""),
 ("Figurative language", "The comparison of Dad grinning \"like he'd caught a fish\" mainly suggests that he felt:", ["proud and delighted at his success", "tired after a long night", "worried about the radio", "bored with the work"], "Catching a fish is a happy reward after patient effort."),
 ("Inferences", "The last sentence, in which the narrator hands the daughter the tweezers, suggests that the narrator:", ["wants to share the same experience the father once shared", "wants the daughter to stop asking questions", "has given up repairing things", "thinks new things are better than old ones"], "It echoes \"Hand me the tweezers\": the narrator is inviting the daughter in, as Dad did."),
]

P2 = """The term "food desert" describes a neighborhood where residents have limited access to fresh, affordable food, usually because no full-service grocery store is nearby. In the United States, the Department of Agriculture has used measures such as distance to the nearest supermarket and household income to identify these areas. In a city, a neighborhood might qualify if many residents live more than a mile from a supermarket; in rural areas, the distance used is often ten miles.

For years, the standard solution seemed simple: open a supermarket. Several cities offered tax breaks to grocery chains willing to build in underserved neighborhoods. The results were mixed. Some studies found that when a new supermarket opened, residents' diets changed less than expected. Many families continued to shop where they had before, and the healthiest foods were not always the ones people could afford or had time to cook.

These findings pushed researchers and community groups to look beyond distance. Price, transportation, cooking time, and familiarity with foods all shape what families eat. In response, some communities have tried a mix of approaches: farmers markets that accept food assistance benefits, corner stores stocked with fresh produce, cooking classes, and bus routes that stop at grocery stores.

None of these efforts alone solves the problem. But together they reflect a broader understanding: access to healthy food depends not only on where a store is but on whether people can realistically use it."""
Q2 = [
 ("Main idea", "The main purpose of the passage is to:", ["explain why solving food deserts has required more than building supermarkets", "argue that supermarkets should receive more tax breaks", "describe how the Department of Agriculture was founded", "compare diets in rural and urban areas"], "The passage moves from the simple fix (a supermarket) to why it fell short and what else communities try."),
 ("Details", "According to the passage, in rural areas the distance used to identify a food desert is often:", ["ten miles", "one mile", "five miles", "twenty miles"], "Paragraph 1: \"in rural areas, the distance used is often ten miles.\""),
 ("Inferences", "The passage suggests that some families did not change their diets after a supermarket opened mainly because:", ["factors such as price and cooking time still limited their choices", "the supermarkets closed soon after opening", "they did not know the stores had opened", "the supermarkets sold no fresh food"], "Paragraphs 2 and 3 point to cost, time and habit, not just distance."),
 ("Structure", "The last paragraph mainly serves to:", ["state the broader lesson the passage has been building toward", "introduce a new problem unrelated to food", "describe one study in detail", "argue that the problem cannot be solved"], "It sums up: access depends on whether people can realistically use a store."),
]

P3 = """Most people know Benjamin Franklin as a printer, inventor and diplomat. Fewer know that he also designed a musical instrument. In 1761, after hearing musicians play tunes by rubbing wet fingers around the rims of water-filled wine glasses, Franklin set out to improve the idea. His "glass armonica" stacked dozens of glass bowls of different sizes on a spinning iron rod. A player turned the rod with a foot pedal and touched the wet rims with fingertips, producing clear, ringing tones.

The instrument became remarkably popular. Wolfgang Amadeus Mozart and Ludwig van Beethoven both wrote music for it, and performers toured Europe playing it for audiences who had never heard anything like it. Franklin himself said it gave him more personal satisfaction than almost anything else he had invented.

Within a few decades, however, the armonica had nearly vanished. Rumors spread that its eerie sound caused nervousness or even illness in players and listeners. Historians today doubt these claims and point to more ordinary causes: the glass bowls were fragile and expensive, the instrument was hard to play loudly enough for larger concert halls, and musical taste was shifting toward instruments like the piano.

In recent years, a small number of musicians and glassmakers have revived the armonica. Their performances remind audiences that some inventions fade not because they fail, but because the world around them changes."""
Q3 = [
 ("Main idea", "The passage is mainly about:", ["the invention, popularity and decline of Franklin's glass armonica", "Mozart's career as a composer", "how glass is made", "Franklin's work as a diplomat"], "The passage traces the armonica from invention to fading and revival."),
 ("Details", "According to the passage, the armonica produced sound when a player:", ["touched the wet rims of spinning glass bowls", "struck glass bowls with small hammers", "blew air across the top of the bowls", "pressed keys connected to strings"], "Paragraph 1: the player touched wet rims while the rod spun."),
 ("Author's view", "The author's view of the rumors that the armonica caused illness is best described as:", ["skeptical, favoring more practical explanations", "fully convinced that they were true", "uninterested in them", "angry at Franklin for ignoring them"], "\"Historians today doubt these claims and point to more ordinary causes.\""),
 ("Reasoning", "Which reason for the armonica's decline is NOT given in the passage?", ["Franklin stopped promoting it.", "The glass bowls were fragile and expensive.", "It was hard to play loudly in large halls.", "Musical taste shifted toward the piano."], "All the others are listed in paragraph 3; Franklin's promotion isn't mentioned."),
]

P4 = """Tides rise and fall along most coastlines about twice a day, and the main cause is the Moon. Gravity pulls on everything, but its strength weakens with distance. The side of Earth facing the Moon is pulled slightly more strongly than Earth's center, and Earth's center is pulled more strongly than the far side. These differences stretch Earth's oceans into two bulges: one facing the Moon and one on the opposite side. As Earth rotates through both bulges each day, most places experience two high tides and two low tides.

The Sun also affects tides, though less than the Moon does. The Sun is far more massive, but it is also much farther away, and the difference in its pull from one side of Earth to the other is smaller. When the Sun, Moon and Earth line up, at new moon and full moon, their effects combine to produce especially large "spring tides." (The name has nothing to do with the season.) When the Sun and Moon are at right angles to each other, during the quarter moons, their effects partly cancel, producing smaller "neap tides."

Local geography matters too. The shape of a bay or the slope of the sea floor can make tides much larger in some places than others. In a few narrow bays, the difference between high and low tide can exceed ten meters, while some enclosed seas have tides of only a few centimeters."""
Q4 = [
 ("Details", "According to the passage, most places experience two high tides a day because:", ["Earth rotates through two bulges of ocean water", "the Moon orbits Earth twice a day", "the Sun and Moon take turns pulling on the ocean", "winds push water toward the shore twice daily"], "Paragraph 1: Earth rotates through both bulges each day."),
 ("Vocabulary in context", "As used in the passage, \"spring tides\" are:", ["larger tides that occur when the Sun, Moon and Earth line up", "tides that happen only in the spring season", "small tides during the quarter moons", "tides caused only by the Sun"], "Spring tides happen at new and full moon, and \"the name has nothing to do with the season.\""),
 ("Reasoning", "Based on the passage, the Sun has a smaller effect on tides than the Moon mainly because:", ["the Sun is much farther away, so its pull differs less across Earth", "the Sun is less massive than the Moon", "the Sun's gravity does not reach Earth's oceans", "the Sun pulls only on land, not water"], "Paragraph 2: the Sun is more massive but much farther away, so the difference in its pull is smaller."),
 ("Structure", "The last paragraph mainly serves to:", ["show that local features can strongly change tide sizes", "explain why the Moon causes tides", "define neap tides", "argue that tides are dangerous"], "It adds that bays and sea floor shape tide size."),
]

P5 = """Grandma Ruth did not believe in recipes. "A recipe," she told me the first summer I stayed with her, "is just somebody else's guess." She cooked by smell and by the sound of the pan, and when I asked how much flour went into her biscuits, she held up her hand, cupped, as though the answer were obvious.

I was fifteen and had come to her farmhouse in south Georgia because my parents were moving across the country and needed me out of the way for two months. I had expected to be bored. Instead I was put to work. By the second week I could tell, from across the kitchen, when the onions had gone from soft to sweet.

Near the end of the summer I decided to write her biscuits down. I followed her around the kitchen with a notebook and a set of measuring cups, catching handfuls of flour before they reached the bowl. She let me, though she rolled her eyes. When I finished, I baked a batch from my notes. They were fine. They were not hers.

"You measured everything," she said, tasting one, "except the part that matters." I asked what that was. She thought for a while. "Paying attention," she said.

I still have the notebook. The recipe is in it, every cup and spoon. In the margin, in my fifteen-year-old handwriting, I wrote one more line after she said that: Listen to the pan.""" + FIC
Q5 = [
 ("Main idea", "The passage is mainly about:", ["a teenager learning from her grandmother that good cooking depends on attention, not just measurements", "a family's move across the country", "a grandmother's plan to sell her farm", "a contest to bake the best biscuits"], "The narrator measures the recipe but learns the missing piece is paying attention."),
 ("Details", "The narrator went to stay with Grandma Ruth because:", ["her parents were moving and needed her out of the way", "she wanted to learn to cook", "her grandmother was sick", "she had a summer job on the farm"], "Paragraph 2 gives the reason."),
 ("Inferences", "When the narrator says her biscuits \"were fine. They were not hers,\" she most nearly means that:", ["her biscuits lacked something that made Grandma Ruth's special", "she had used the wrong ingredients", "she did not like biscuits", "Grandma Ruth refused to taste them"], "Fine but not as good: something beyond the measurements was missing."),
 ("Character", "Grandma Ruth's attitude toward the narrator's note-taking is best described as:", ["amused tolerance", "strong anger", "deep worry", "complete indifference"], "\"She let me, though she rolled her eyes.\""),
]

P6 = """In the 1930s, during the Great Depression, the U.S. government hired thousands of out-of-work writers through a program called the Federal Writers' Project. Among their assignments was one that historians now consider priceless: interviewing elderly Americans who had been born into slavery.

Between 1936 and 1938, interviewers recorded the memories of more than two thousand formerly enslaved people across seventeen states. The interviewees described daily work, family life, punishment, escape, and the moment they learned they were free. Many were children when the Civil War ended, so their accounts reflect a child's view of slavery and its end.

Historians use these narratives carefully. Most interviewers were white, and in the segregated South, some interviewees may not have spoken freely to them. Interviewers sometimes wrote down speech in exaggerated dialect, and some edited the stories they collected. The interviews also took place some seventy years after emancipation, and memories change over time.

Even with these limits, the collection remains one of the largest sources of firsthand testimony from people who lived through slavery. It preserves voices that were rarely included in official records, and it has shaped how scholars and the public understand that history. Today the narratives are held by the Library of Congress, and many can be read online."""
Q6 = [
 ("Main idea", "The main purpose of the passage is to:", ["describe a collection of interviews with formerly enslaved people, including its value and its limits", "explain how the Great Depression began", "argue that the Federal Writers' Project wasted money", "list the states where slavery was legal"], "The passage explains what the narratives are, why they matter, and how historians use them carefully."),
 ("Details", "According to the passage, the interviews were recorded between:", ["1936 and 1938", "1861 and 1865", "1929 and 1933", "1950 and 1955"], "Paragraph 2 gives the dates."),
 ("Reasoning", "Which of the following is NOT presented as a limitation of the narratives?", ["Most interviewees refused to answer questions.", "Some interviewees may not have spoken freely to white interviewers.", "Some interviewers edited the stories.", "Memories may have changed over seventy years."], "Paragraph 3 lists the others; it never says most interviewees refused."),
 ("Author's view", "The author's overall view of the narratives is that they are:", ["valuable despite their limitations", "too flawed to be useful", "completely accurate", "less important than official records"], "\"Even with these limits, the collection remains one of the largest sources...\""),
]

P7 = """Some of the world's most important crops depend on an animal most people never think about: the bat. In tropical and desert regions, many plants are pollinated by bats that feed on nectar. The agave plant, used to make a number of products in Mexico, is pollinated largely by nectar-feeding bats, and so are wild varieties of bananas and the durian fruit of Southeast Asia.

Bats also protect crops in another way: by eating insects. A single small bat can eat a large share of its body weight in insects in one night. In farming regions of the United States, insect-eating bats feed on moths whose caterpillars damage corn and cotton. Researchers who have tried to estimate the value of this "pest control" have concluded that bats save farmers billions of dollars a year by reducing crop damage and the need for pesticides.

Despite their usefulness, many bat populations are in trouble. In North America, a fungal disease called white-nose syndrome has killed millions of hibernating bats since it was first found in New York in 2006. Habitat loss and wind turbines, which can kill bats that fly near the spinning blades, add to the pressure.

Scientists are testing ways to help: treatments for the fungus, protecting caves where bats hibernate, and adjusting when wind turbines spin on nights when bats are most active. Their work suggests that protecting bats is not only good for wildlife but also for the farms that feed people."""
Q7 = [
 ("Main idea", "The passage mainly argues that bats:", ["are valuable to agriculture and face serious threats", "are dangerous to farm animals", "should be removed from farming regions", "are found only in tropical areas"], "It describes bats' value (pollination, pest control), then their threats and efforts to help."),
 ("Details", "According to the passage, white-nose syndrome was first found in:", ["New York in 2006", "Mexico in 1996", "Southeast Asia in 2010", "Texas in 2016"], "Paragraph 3 gives the place and year."),
 ("Details", "According to the passage, insect-eating bats help corn and cotton farmers by:", ["eating moths whose caterpillars damage crops", "pollinating corn and cotton flowers", "spreading seeds across fields", "eating weeds that compete with crops"], "Paragraph 2: they eat moths whose caterpillars damage these crops."),
 ("Structure", "The last paragraph mainly serves to:", ["describe efforts to protect bats and connect them to the passage's main point", "introduce a new threat to bats", "explain how bats find insects", "argue that wind turbines should be banned"], "It lists solutions and ties bat protection to farming."),
]

P8 = """The architect Julia Morgan designed more than seven hundred buildings in a career that lasted nearly fifty years, yet for much of the twentieth century her name was barely known outside California. Born in San Francisco in 1872, she studied civil engineering at the University of California, Berkeley, and then became the first woman admitted to the architecture program at the École des Beaux-Arts in Paris, one of the most respected design schools in the world.

Back in California, Morgan built a practice that ranged from small homes to churches, schools and community buildings. After the 1906 San Francisco earthquake, her use of reinforced concrete, which had helped one of her buildings survive the disaster, brought her more work. Her most famous project was Hearst Castle, a vast estate on the California coast that she designed and oversaw for nearly thirty years for the newspaper publisher William Randolph Hearst.

Morgan avoided publicity. She rarely gave interviews and is often quoted as saying that her buildings would speak for her. Some historians believe this choice, along with the fact that she was a woman in a field dominated by men, explains why she was long overlooked.

That has changed. In 2014, the American Institute of Architects awarded Morgan its highest honor, the AIA Gold Medal, making her the first woman to receive it. She had died in 1957."""
Q8 = [
 ("Main idea", "The passage is mainly about:", ["an accomplished architect who was long overlooked and later honored", "the history of the École des Beaux-Arts", "the 1906 San Francisco earthquake", "how Hearst Castle was paid for"], "It covers Morgan's career, why she was overlooked, and her later recognition."),
 ("Details", "According to the passage, one reason Morgan received more work after the 1906 earthquake was that:", ["one of her reinforced-concrete buildings had survived it", "she had predicted the earthquake", "she lowered her prices", "she moved her office to Paris"], "Paragraph 2: reinforced concrete helped one of her buildings survive."),
 ("Inferences", "The passage suggests that Morgan's lack of fame during her life was partly due to:", ["her own wish to avoid publicity", "the poor quality of her buildings", "her small number of projects", "her refusal to work for wealthy clients"], "Paragraph 3: she avoided publicity, and historians link that to being overlooked."),
 ("Details", "The last paragraph points out that Morgan's AIA Gold Medal was awarded:", ["after her death", "when she was a student", "for her work in Paris", "before she designed Hearst Castle"], "She received it in 2014; she had died in 1957."),
]

P9 = """When ice forms on a pond in winter, it forms on top, and that simple fact makes life in the pond possible. Most substances become denser when they freeze; solid wax sinks in melted wax. Water is unusual. As water cools, it becomes denser until it reaches about 4°C. Below that temperature, it begins to expand, and when it freezes, ice is about nine percent less dense than liquid water. So ice floats.

This property shapes what happens in a lake as winter arrives. Surface water cools and, being denser, sinks, while warmer water rises to take its place. This mixing continues until the entire lake reaches about 4°C. After that, further cooling makes surface water lighter, not heavier, so it stays on top, gets colder, and eventually freezes. The ice then acts as a lid, insulating the water below, which often stays near 4°C all winter.

If ice sank, lakes would freeze from the bottom up. In cold climates, many would freeze solid, and fish and other organisms would have nowhere to survive. Instead, beneath a layer of ice, life continues slowly through the winter.

The reason for water's odd behavior lies in its molecules. As water freezes, hydrogen bonds lock the molecules into an open, six-sided pattern that takes up more space than the jumbled arrangement of the liquid."""
Q9 = [
 ("Details", "According to the passage, liquid water is densest at about:", ["4°C", "0°C", "−4°C", "9°C"], "\"It becomes denser until it reaches about 4°C.\""),
 ("Reasoning", "Based on the passage, once a lake has cooled to about 4°C throughout, further cooling causes surface water to:", ["stay at the top and eventually freeze", "sink to the bottom", "mix with deeper water", "warm up"], "Below 4°C, surface water gets lighter, so it stays on top and freezes."),
 ("Purpose", "The example of solid wax sinking in melted wax is included mainly to:", ["show how most substances behave, in contrast to water", "explain how candles are made", "prove that wax is denser than water", "describe what happens in a frozen lake"], "It sets up \"Water is unusual.\""),
 ("Inferences", "The passage suggests that if ice were denser than liquid water, many lakes in cold climates would:", ["freeze solid and be unable to support fish", "stay warmer all winter", "never freeze at all", "freeze only on the surface"], "Paragraph 3: lakes would freeze from the bottom up, many freezing solid."),
]

P10 = """Marcus had run the 800 meters in every meet that season, and in every meet he had finished third. Third was respectable. Third got you a ribbon and a nod from Coach Lin. But third, Marcus had decided, was also a habit, and he wanted to break it.

The problem, according to Coach, was the second lap. "You run the first lap like you're scared of it," she said, "and the second like you're angry at it." Marcus didn't see it that way. He thought he was being smart, saving energy. Coach handed him a stopwatch and told him to time the leaders' first laps at the next meet instead of running.

He sat in the bleachers, annoyed, clicking the watch. The winner ran the first lap only a second faster than Marcus usually did. But she didn't slow down in the second. She didn't speed up, either. She just kept going, as steady as a metronome, while the others faded and then sprinted wildly at the end.

At practice that week, Marcus ran laps with the watch in his hand, trying to make the two halves match. It felt wrong at first, too fast early and too easy late. At the last meet of the season he ran the plan anyway. He finished second, by a hand's width, behind a runner who had beaten him by three seconds a month before. Coach Lin said nothing, which from her was a compliment. He kept the stopwatch.""" + FIC
Q10 = [
 ("Main idea", "The passage is mainly about:", ["a runner who improves by learning to pace his race evenly", "a coach who is unfair to her runners", "a runner who decides to quit track", "the rules of the 800-meter race"], "Marcus learns steady pacing from watching the winner and improves."),
 ("Details", "Coach Lin asks Marcus to time the leaders at the next meet because she wants him to:", ["see how successful runners pace themselves", "rest an injury", "learn to use a stopwatch for a class", "keep him from racing a stronger runner"], "Timing the winner shows him even pacing."),
 ("Figurative language", "The comparison of the winner to a metronome mainly emphasizes that she ran:", ["at a steady, even pace", "louder than the others", "with a strong final sprint", "slower than everyone else"], "A metronome keeps a perfectly regular beat."),
 ("Inferences", "The detail that Coach Lin \"said nothing, which from her was a compliment\" suggests that she:", ["rarely gives open praise", "was disappointed in Marcus", "did not watch the race", "wanted Marcus to finish first"], "Silence counting as a compliment means she seldom praises out loud."),
]

P11 = """For most of history, people told time by the Sun. Each town set its clocks so that noon came when the Sun was highest in the sky, which meant that clocks in towns a few dozen miles apart could differ by several minutes. For travelers on foot or horseback, this hardly mattered.

Railroads changed that. By the mid-1800s, trains in the United States connected hundreds of towns, each with its own local time. Railroad companies kept their own schedules based on the time in their headquarters cities, so a single station might display several clocks showing different times for different lines. Missed connections, and even collisions, were blamed on the confusion.

On November 18, 1883, the major U.S. and Canadian railroads adopted a system of standard time zones. The continent was divided into broad bands, and every clock within a band was set to the same time. In many cities, local clocks were reset at noon that day, and some people called it "the day of two noons."

The railroads' system was not federal law at first. Many towns adopted it quickly, but others resisted, preferring to keep their own sun time. It was not until 1918 that Congress passed the Standard Time Act, officially establishing time zones in the United States. A change started by private companies for their own convenience had become the way an entire nation organized its days."""
Q11 = [
 ("Main idea", "The passage is mainly about:", ["how railroads led to the adoption of standard time zones", "how sundials work", "a famous train collision in 1883", "why some towns refused to build railroads"], "It traces the shift from local sun time to railroad time zones to federal law."),
 ("Details", "According to the passage, U.S. time zones became federal law in:", ["1918", "1883", "1850", "1900"], "Paragraph 4: Congress passed the Standard Time Act in 1918."),
 ("Vocabulary in context", "The phrase \"the day of two noons\" refers to the fact that:", ["some clocks were reset at noon, so noon occurred twice in those places", "trains ran twice as often that day", "the Sun appeared to rise twice", "people worked two shifts"], "Clocks reset at noon meant some towns lived through noon twice."),
 ("Reasoning", "The passage suggests that local sun time became a problem mainly because:", ["faster travel by train made small time differences matter", "towns could not agree on when the Sun was highest", "clocks of the time were inaccurate", "Congress required all clocks to match"], "\"For travelers on foot or horseback, this hardly mattered. Railroads changed that.\""),
]

ACT_READING_MORE_A = [(P1, Q1), (P2, Q2), (P3, Q3), (P4, Q4), (P5, Q5), (P6, Q6), (P7, Q7), (P8, Q8), (P9, Q9), (P10, Q10), (P11, Q11)]
