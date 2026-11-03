import { HopeChecker } from "../../hope-checker";
import { Page } from "../../ui";

export const metadata = { title: "HOPE and Zell Miller checker · ScholarTasks" };

export default function HopePage() {
  return (
    <Page title="HOPE and Zell Miller checker">
      <p className="hint">Add your student's core courses to see where they stand. Nothing here is saved.</p>
      <HopeChecker />
      <p className="hint" style={{ fontSize: 12 }}>Preview only. Georgia rules come from a draft data pack that has not yet been verified with GSFC.</p>
    </Page>
  );
}
