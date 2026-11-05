import { HopeChecker } from "../../hope-checker";
import { Page } from "../../ui";

export const metadata = { title: "State scholarship checker (HOPE, Bright Futures, TOPS and more) · ScholarTasks" };

export default function HopePage() {
  return (
    <Page title="State scholarship checker">
      <p className="hint">Pick your state, then add your student&apos;s core courses to see where they stand for HOPE and Zell Miller, Bright Futures, LIFE, TOPS, Tennessee HOPE and more. Nothing here is saved.</p>
      <HopeChecker />
    </Page>
  );
}
