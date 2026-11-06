import { Page } from "../ui";
import { JobsHome } from "./jobs-home";
import "../trades/trades.css";

export const metadata = {
  title: "Weekend and holiday jobs for students · ScholarTasks",
  description: "Weekend, holiday and school-break jobs from local companies checked by our review team. Students apply in the app, and a parent agrees before anything is sent.",
};

/** Weekend and holiday jobs: the family's applications, reference letters, and jobs to apply for. */
export default function JobsPage() {
  return (
    <Page title="Weekend and holiday jobs">
      <p className="lead">
        Part-time work on weekends, over the holidays and during school breaks, from local companies our review team checked.
        Apply right here. A parent reads every application and ticks I agree before the company sees it.
      </p>
      <JobsHome />
    </Page>
  );
}
