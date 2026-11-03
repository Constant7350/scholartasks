import type { CourseGrade } from "@scholartasks/core";

/**
 * Common Georgia high school courses for the course picker, grouped by subject.
 * Core subjects count toward the HOPE GPA. Families can still type any course
 * that isn't listed.
 */
export interface Subject { name: string; core: boolean; courses: string[] }

export const SUBJECTS: Subject[] = [
  {
    name: "English",
    core: true,
    courses: [
      "9th Grade Literature and Composition", "10th Grade Literature and Composition", "American Literature and Composition",
      "British Literature and Composition", "Honors 9th Grade Literature", "Honors 10th Grade Literature", "Honors American Literature",
      "Honors British Literature", "AP English Language and Composition", "AP English Literature and Composition",
      "IB English A: Literature", "Dual Enrollment English Composition I", "Dual Enrollment English Composition II", "Journalism", "Creative Writing",
    ],
  },
  {
    name: "Math",
    core: true,
    courses: [
      "Algebra: Concepts and Connections", "Geometry: Concepts and Connections", "Advanced Algebra: Concepts and Connections",
      "Accelerated Algebra I / Geometry A", "Accelerated Geometry B / Algebra II", "Pre-Calculus", "Honors Pre-Calculus", "Statistical Reasoning",
      "Advanced Mathematical Decision Making", "Discrete Mathematics", "Calculus", "AP Precalculus", "AP Calculus AB", "AP Calculus BC", "AP Statistics",
      "IB Mathematics: Analysis and Approaches", "Dual Enrollment College Algebra", "Dual Enrollment Calculus I",
    ],
  },
  {
    name: "Science",
    core: true,
    courses: [
      "Biology", "Honors Biology", "Chemistry", "Honors Chemistry", "Physics", "Honors Physics", "Physical Science", "Environmental Science",
      "Earth Systems", "Anatomy and Physiology", "Forensic Science", "AP Biology", "AP Chemistry", "AP Environmental Science", "AP Physics 1",
      "AP Physics 2", "AP Physics C: Mechanics", "IB Biology", "IB Chemistry", "Dual Enrollment Biology",
    ],
  },
  {
    name: "Social Studies",
    core: true,
    courses: [
      "World Geography", "World History", "Honors World History", "United States History", "Honors United States History",
      "American Government / Civics", "Economics / Business / Free Enterprise", "Psychology", "Sociology", "AP Human Geography",
      "AP World History: Modern", "AP United States History", "AP United States Government and Politics", "AP Macroeconomics",
      "AP Microeconomics", "AP Psychology", "AP European History", "IB History of the Americas", "Dual Enrollment American Government",
    ],
  },
  {
    name: "World Languages",
    core: true,
    courses: [
      "Spanish I", "Spanish II", "Spanish III", "Honors Spanish III", "Spanish IV", "AP Spanish Language and Culture", "French I", "French II",
      "French III", "AP French Language and Culture", "German I", "German II", "Latin I", "Latin II", "AP Latin", "Chinese I", "Chinese II",
      "American Sign Language I", "American Sign Language II",
    ],
  },
  {
    name: "Computer Science",
    core: false,
    courses: ["Foundations of Computer Science", "Programming, Games, Apps and Society", "AP Computer Science Principles", "AP Computer Science A", "Cybersecurity"],
  },
  {
    name: "Fine Arts",
    core: false,
    courses: ["Visual Arts", "Drawing and Painting", "Band", "Chorus", "Orchestra", "Theatre", "Dance", "AP Art and Design", "AP Music Theory", "AP Art History"],
  },
  {
    name: "Health and PE",
    core: false,
    courses: ["Health", "Personal Fitness", "Physical Education", "Weight Training"],
  },
  {
    name: "Career and Electives",
    core: false,
    courses: ["Financial Literacy", "Business Essentials", "Marketing", "Culinary Arts", "Engineering Concepts", "Health Science", "JROTC", "Yearbook", "AP Seminar", "AP Research"],
  },
];

/** Guess the level from the course name: AP, IB, dual enrollment or honors. */
export function levelFromName(course: string): CourseGrade["level"] {
  if (/^AP\b/.test(course)) return "AP";
  if (/^IB\b/.test(course)) return "IB";
  if (/^Dual Enrollment\b|\bDE\b/i.test(course)) return "DE";
  if (/^Honors\b|\(H\)|\bHonors\b/i.test(course)) return "honors";
  return "standard";
}

/** Subjects and courses in alphabetical order, filtered by a search. */
export function searchCourses(query: string): Subject[] {
  const q = query.trim().toLowerCase();
  return [...SUBJECTS]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({
      ...s,
      courses: s.courses
        .filter((c) => !q || c.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
        .sort((a, b) => a.localeCompare(b)),
    }))
    .filter((s) => s.courses.length > 0);
}

export function subjectOf(course: string): Subject | undefined {
  return SUBJECTS.find((s) => s.courses.includes(course));
}
