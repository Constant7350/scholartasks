// Search topics for the AI scholarship finder. Browser-safe (no SDK imports), so the
// team page can list them; the finder itself lives in scholarship-finder.ts.

/** Where the finder looks. Rotated weekly by the cron job; the team can run any of them, or paste a page address. */
export const FINDER_TOPICS: { id: string; label: string; query: string }[] = [
  // Georgia, local
  { id: "ga-emc", label: "Georgia electric co-ops (EMCs)", query: "Georgia EMC electric membership cooperative scholarship high school seniors" },
  { id: "ga-farm-bureau", label: "Georgia Farm Bureau and county Farm Bureaus", query: "Georgia Farm Bureau county scholarship high school seniors" },
  { id: "ga-community-foundations", label: "Georgia community foundations", query: "Georgia community foundation scholarships high school seniors apply" },
  { id: "ga-atlanta", label: "Atlanta area foundations", query: "Atlanta foundation scholarship for high school seniors apply" },
  { id: "ga-savannah-coast", label: "Savannah and coastal Georgia", query: "Savannah coastal Georgia community foundation scholarship students" },
  { id: "ga-columbus-macon", label: "Columbus, Macon and middle Georgia", query: "Columbus Macon middle Georgia scholarship foundation high school" },
  { id: "ga-north", label: "North Georgia and the mountains", query: "North Georgia community foundation scholarships students" },
  { id: "ga-south", label: "South Georgia", query: "South Georgia scholarship foundation high school seniors Valdosta Albany Tifton" },
  { id: "ga-civic", label: "Rotary, Lions, Kiwanis and Elks in Georgia", query: "Georgia Rotary Lions Kiwanis Elks club scholarship high school senior" },
  { id: "ga-employers", label: "Georgia employers and utilities", query: "Georgia company employer utility scholarship program high school students" },
  { id: "ga-health", label: "Georgia nursing and health careers", query: "Georgia nursing health careers scholarship students" },
  { id: "ga-teaching", label: "Georgia future teachers", query: "Georgia future teacher education scholarship students" },
  { id: "ga-ag-youth", label: "Georgia FFA, 4-H and agriculture groups", query: "Georgia FFA 4-H agriculture association scholarship students" },
  { id: "ga-military", label: "Georgia military and first-responder families", query: "Georgia scholarship children of military veterans first responders" },
  { id: "ga-churches", label: "Georgia faith-based awards", query: "Georgia church denomination scholarship college students" },
  // National
  { id: "us-stem", label: "National STEM awards", query: "national STEM scholarship high school seniors official apply" },
  { id: "us-first-gen", label: "First-generation students", query: "first-generation college student scholarship national apply high school senior" },
  { id: "us-need", label: "Need-based national awards", query: "need-based scholarship national high school seniors low income apply" },
  { id: "us-hispanic", label: "Hispanic and Latino students", query: "Hispanic Latino student scholarship national apply official" },
  { id: "us-black", label: "Black and African American students", query: "scholarship for Black African American high school students national official" },
  { id: "us-asian-pi", label: "Asian American and Pacific Islander students", query: "Asian American Pacific Islander scholarship national official apply" },
  { id: "us-native", label: "American Indian and Alaska Native students", query: "American Indian Alaska Native scholarship college official apply" },
  { id: "us-women", label: "Young women", query: "scholarship for young women high school seniors national official" },
  { id: "us-disability", label: "Students with disabilities", query: "scholarship for students with disabilities national official apply" },
  { id: "us-military", label: "Military families (national)", query: "military family children scholarship national official apply" },
  { id: "us-service", label: "Community service and volunteering", query: "community service volunteer scholarship high school students national" },
  { id: "us-leadership", label: "Leadership", query: "leadership scholarship high school seniors national official" },
  { id: "us-arts", label: "Arts, music and writing", query: "art music writing scholarship high school students national official" },
  { id: "us-trades", label: "Skilled trades", query: "skilled trades scholarship welding electrician HVAC students national official" },
  { id: "us-health", label: "Health careers (national)", query: "nursing pre-med health careers scholarship national high school senior" },
  { id: "us-business", label: "Business and finance", query: "business finance accounting scholarship high school seniors national" },
  { id: "us-ag", label: "Agriculture (national)", query: "agriculture scholarship national FFA students official" },
  { id: "us-animals", label: "Animals and veterinary", query: "pre-veterinary animal science scholarship high school students" },
  { id: "us-environment", label: "Environment and ocean", query: "environmental marine science scholarship high school students national" },
  { id: "us-sports", label: "Sports and athletes (non-NCAA)", query: "scholarship student athletes high school seniors national foundation" },
  { id: "us-foster", label: "Foster care experience", query: "scholarship foster youth college national official" },
  { id: "us-rural", label: "Rural and small-town students", query: "rural small town student scholarship national official" },
  { id: "us-employer", label: "Big employers' scholarships", query: "corporate scholarship program high school seniors national official" },
  { id: "us-juniors", label: "Awards for juniors and younger", query: "scholarship competition high school juniors sophomores national official" },
  { id: "us-essay", label: "Essay and writing contests", query: "essay contest scholarship high school students national official" },
];

