import { Page } from "./ui";

export default function NotFound() {
  return (
    <Page title="We can't find that page">
      <div className="panel">
        <p className="hint">The link may be old or mistyped. Everything is still here.</p>
        <p style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: 0 }}>
          <a className="btn btn-inline link-btn" href="/home">Go to Home</a>
          <a className="btn btn-ghost btn-inline link-btn" href="/help">Help and how-to</a>
        </p>
      </div>
    </Page>
  );
}
