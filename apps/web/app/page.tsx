import { SignedInRedirect } from "./signed-in-redirect";
import { Page } from "./ui";

export default function Landing() {
  return (
    <Page>
      <SignedInRedirect />
      <section className="hero">
        <p className="eyebrow">Built in Georgia</p>
        <h1>College, scholarships and aid, handled</h1>
        <p className="hint">One plan for your family: grades, test prep, applications and every deadline.</p>
      </section>
      <p style={{ marginTop: 20 }}>
        <a className="btn btn-inline link-btn" href="/signin">Get started free</a>{" "}
        <a className="btn btn-ghost btn-inline link-btn" href="/tools/hope">Try the HOPE checker</a>
      </p>
    </Page>
  );
}
