// Every class in the practice bank, grouped the way a US school catalog groups
// them. Students pick the ones they take ("My classes"); grades say who
// usually takes the class, so the picker can show the right ones first.
export interface Course { name: string; group: GroupId; from: number; to: number }
export type GroupId = "math" | "science" | "social" | "english" | "languages" | "electives";

export const GROUPS: { id: GroupId; label: string; icon: string }[] = [
  { id: "math", label: "Math", icon: "➗" },
  { id: "science", label: "Science", icon: "🔬" },
  { id: "social", label: "History and social studies", icon: "🌎" },
  { id: "english", label: "English", icon: "📖" },
  { id: "languages", label: "World languages", icon: "🗣️" },
  { id: "electives", label: "Electives", icon: "💡" },
];

export const COURSES: Course[] = [
  { name: "Math (grades 6-8)", group: "math", from: 6, to: 8 },
  { name: "Algebra I", group: "math", from: 8, to: 10 },
  { name: "Geometry", group: "math", from: 9, to: 11 },
  { name: "Algebra II", group: "math", from: 10, to: 12 },
  { name: "Precalculus", group: "math", from: 11, to: 12 },
  { name: "Calculus", group: "math", from: 11, to: 12 },
  { name: "Statistics", group: "math", from: 10, to: 12 },
  { name: "Science (grades 6-8)", group: "science", from: 6, to: 8 },
  { name: "Biology", group: "science", from: 9, to: 10 },
  { name: "Physical Science and Chemistry", group: "science", from: 9, to: 12 },
  { name: "Physics", group: "science", from: 11, to: 12 },
  { name: "Earth and Environmental Science", group: "science", from: 9, to: 12 },
  { name: "Anatomy and Physiology", group: "science", from: 11, to: 12 },
  { name: "U.S. History", group: "social", from: 8, to: 11 },
  { name: "World History", group: "social", from: 6, to: 10 },
  { name: "Geography", group: "social", from: 6, to: 9 },
  { name: "American Government", group: "social", from: 11, to: 12 },
  { name: "Economics", group: "social", from: 11, to: 12 },
  { name: "Psychology", group: "social", from: 11, to: 12 },
  { name: "English Language Arts", group: "english", from: 6, to: 12 },
  { name: "Spanish 1", group: "languages", from: 7, to: 12 },
  { name: "Spanish 2", group: "languages", from: 8, to: 12 },
  { name: "French 1", group: "languages", from: 7, to: 12 },
  { name: "French 2", group: "languages", from: 8, to: 12 },
  { name: "German 1", group: "languages", from: 8, to: 12 },
  { name: "Chinese 1", group: "languages", from: 8, to: 12 },
  { name: "Latin 1", group: "languages", from: 8, to: 12 },
  { name: "Japanese 1", group: "languages", from: 8, to: 12 },
  { name: "Computer Science", group: "electives", from: 8, to: 12 },
  { name: "Health", group: "electives", from: 6, to: 12 },
  { name: "Personal Finance", group: "electives", from: 9, to: 12 },
];

/** A subject in the bank that isn't in the list above still shows, under Electives. */
export const courseOf = (name: string): Course => COURSES.find((c) => c.name === name) ?? { name, group: "electives", from: 6, to: 12 };

/** Classes a student in this grade usually takes, for a first guess in the picker. */
export const usualFor = (grade: number | null | undefined) =>
  COURSES.filter((c) => grade != null && grade >= c.from && grade <= c.to && c.group !== "languages" && c.group !== "electives").map((c) => c.name);
