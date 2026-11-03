import { HopeChecker } from "./hope-checker";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px" }}>
      <h1 style={{ marginBottom: 4 }}>ScholarTasks</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Your plan for college: grades, test prep, scholarships, state aid and every deadline in one place.
      </p>
      <p><a href="/signin">Sign in</a> · <a href="/family">Your family</a> · <a href="/join">Student: join your family</a></p>
      <HopeChecker />
      <p style={{ fontSize: 12, color: "#777" }}>
        Preview only. Georgia rules come from a draft data pack that has not yet been verified with GSFC.
      </p>
    </main>
  );
}
