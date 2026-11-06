import { PostForm } from "./post-form";
import { Page } from "../../ui";
import "../trades.css";

export const metadata = {
  title: "Post an apprenticeship or opening for students · ScholarTasks",
  description: "Local companies: post apprenticeships, paid training and entry-level jobs for high school students and graduates. Free, no account needed, reviewed by our team.",
};

/** Public page for companies: post an opening for students. No account needed. */
export default function PostOpeningPage() {
  return (
    <Page title="Post an apprenticeship or opening">
      <p className="lead">
        Looking for people who want to learn a trade? Post your apprenticeship, paid training or entry-level job here and
        students and families planning their next step will see it. It&apos;s free, and you don&apos;t need an account.
      </p>
      <div className="trade-callouts">
        <div className="panel trade-callout"><b>1. Fill in the form</b><span>About five minutes. Tell students what the work is and how to apply.</span></div>
        <div className="panel trade-callout"><b>2. Our team reviews it</b><span>Usually within two business days. We check every listing to keep students safe.</span></div>
        <div className="panel trade-callout"><b>3. Students contact you</b><span>They apply the way you choose: your website, email or phone. We never share students&apos; details.</span></div>
      </div>
      <PostForm />
    </Page>
  );
}
