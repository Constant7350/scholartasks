import { Page } from "../../ui";
import { OpeningsList } from "../openings-list";
import "../trades.css";

export const metadata = {
  title: "Apprenticeships and local openings for students · ScholarTasks",
  description: "Apprenticeships, paid training and entry-level jobs from local companies, checked by our review team. Home state first, and every state.",
};

/** Openings local companies posted, after our team approved them. Open to everyone, signed in or not. */
export default function OpeningsPage() {
  return (
    <Page title="Apprenticeships and local openings">
      <p className="hint"><a href="/trades">← Trades and trade schools</a></p>
      <p className="lead">
        Apprenticeships, paid training and entry-level jobs from companies looking for people who want to learn a trade.
        Our review team checks every listing before it shows. Openings in your home state come first, then the rest of the country.
      </p>
      <p className="note note-info">
        You decide who to contact. Apply the way each company asks; ScholarTasks never sends your details to companies.
        Looking for more? The <a href="https://www.apprenticeship.gov/finder" target="_blank" rel="noreferrer">U.S. Department of Labor apprenticeship finder</a> covers every state.
      </p>
      <OpeningsList />
      <p className="hint" style={{ marginTop: 24 }}>Do you hire for a trade? <a href="/trades/post">Post an opening for free</a>. Our team reviews it before students see it.</p>
    </Page>
  );
}
