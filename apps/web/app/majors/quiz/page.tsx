import { redirect } from "next/navigation";

/** The short quiz grew into the full career interest quiz; old links and bookmarks land there. */
export default function OldCareerQuiz() {
  redirect("/career-quiz");
}
