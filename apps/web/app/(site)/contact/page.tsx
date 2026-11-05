import { SUPPORT_EMAIL } from "../../legal";
import { PageHead } from "../parts";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact us · ScholarTasks",
  description: "Questions about ScholarTasks for your family or school? Send us a message and we'll write back.",
};

export default async function Contact({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return (
    <>
      <PageHead kicker="Contact us" title="Questions? We're happy to help">
        Send us a message about ScholarTasks for your family or your school. A real person reads every message, usually within a day or two.
      </PageHead>
      <section style={{ paddingBottom: 72 }}>
        <div className="site-wrap s-contact">
          <ContactForm school={topic === "school"} />
          <div className="s-side">
            <div className="s-card">
              <span className="s-icon" aria-hidden="true">✉️</span>
              <h3>Email us</h3>
              <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
            </div>
            <div className="s-card">
              <span className="s-icon green" aria-hidden="true">📖</span>
              <h3>Already using ScholarTasks?</h3>
              <p>The <a href="/help">help guide</a> walks through every page, step by step.</p>
            </div>
            <div className="s-card">
              <span className="s-icon gold" aria-hidden="true">🏫</span>
              <h3>A school or counselor?</h3>
              <p>Pick "School or counselor" in the form and tell us about your school. See <a href="/schools">ScholarTasks for schools</a>.</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
