import { LegalPage, SUPPORT_EMAIL } from "../legal";

export const metadata = { title: "Delete your account · ScholarTasks" };

/** Public page for app store listings: how to delete a ScholarTasks account and what gets deleted. */
export default function DeleteAccount() {
  return (
    <LegalPage title="Delete your ScholarTasks account">
      <h2>In the app or on the website</h2>
      <ol>
        <li>Sign in and open the <strong>Menu</strong>.</li>
        <li>Tap <strong>Face ID, sign-in and account</strong>.</li>
        <li>Scroll to <strong>Delete my account</strong>, tap it, then tap <strong>Yes, delete it for good</strong>.</li>
      </ol>
      <p><a href="/security#delete-account">Go to Delete my account</a></p>

      <h2>Can&apos;t sign in?</h2>
      <p>
        Email <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20account`}>{SUPPORT_EMAIL}</a> from the email address on the account and ask us to
        delete it. We do it within 30 days and reply when it&apos;s done.
      </p>

      <h2>What is deleted</h2>
      <ul>
        <li><strong>The only parent on a family account:</strong> the whole family&apos;s information: each student&apos;s profile, grades, courses, test scores, colleges, scholarships, to-dos and settings, and the students&apos; sign-ins.</li>
        <li><strong>A parent when another parent remains:</strong> your sign-in and your link to the family. The family&apos;s information stays with the other parent.</li>
        <li><strong>A student:</strong> your sign-in and your link to the family. Your parent keeps the family&apos;s plan.</li>
      </ul>
      <p>
        We keep the locked security log (a record of who changed what and when, which no one can edit or remove) and payment records that tax law
        requires. A paid plan needs to be cancelled
        first, on the Plan and billing page of the website.
      </p>
    </LegalPage>
  );
}
