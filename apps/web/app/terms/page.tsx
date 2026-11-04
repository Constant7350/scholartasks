import { LegalPage, SUPPORT_EMAIL } from "../legal";

export const metadata = { title: "Terms of service · ScholarTasks" };

export default function Terms() {
  return (
    <LegalPage title="Terms of service">
      <p>These terms are an agreement between you and ScholarTasks. By creating an account or using ScholarTasks, you agree to them.</p>

      <h2>Accounts</h2>
      <ul>
        <li>A parent or legal guardian who is at least 18 creates the family account and is responsible for it.</li>
        <li>Students must be at least 13 and join only through their parent&apos;s invite code.</li>
        <li>Keep your sign-in details private. Tell us right away at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you think someone else has used your account.</li>
      </ul>

      <h2>What ScholarTasks is, and isn&apos;t</h2>
      <p>
        ScholarTasks gives planning help, reminders and suggestions, including suggestions written by AI. We work hard to keep program rules and
        deadlines accurate, but they change, and we cannot guarantee that any information is complete or current. Always confirm requirements and
        deadlines with the official source, such as GAfutures, StudentAid.gov or the college. ScholarTasks is not a school counselor, lawyer or
        financial adviser, and it cannot guarantee admission, scholarships or aid.
      </p>
      <p>
        SAT and ACT practice questions in ScholarTasks are original, written by our team with help from AI to match the skills and formats described in the
        publicly available College Board and ACT test outlines. They are not official test questions, and practice scores are estimates, not
        predictions of an official score. SAT is a trademark of the College Board and ACT is a trademark of ACT Education Corp. Neither
        organization makes, sponsors or endorses ScholarTasks.
      </p>
      <p>You are responsible for the applications and forms you submit. We never submit government forms or sign in to government accounts for you.</p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t misuse ScholarTasks: no trying to access other families&apos; information, no interfering with the service, and no using it to break the
        law or school honesty rules.
      </p>

      <h2>Paid plans</h2>
      <p>
        Some features may require a paid subscription. Prices and what each plan includes will be shown before you pay. You can cancel at any time,
        and your plan stays active until the end of the period you paid for.
      </p>

      <h2>Your information</h2>
      <p>Your family&apos;s information belongs to you. Our <a href="/privacy">privacy policy</a> explains how we handle it.</p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time. We may suspend accounts that break these terms. If we ever shut down the service, we will give you
        notice and a way to download your information.
      </p>

      <h2>Limits on liability</h2>
      <p>
        ScholarTasks is provided &quot;as is.&quot; To the extent the law allows, we are not liable for indirect or consequential losses, such as a missed
        deadline or scholarship, and our total liability is limited to the amount you paid us in the 12 months before the claim.
      </p>

      <h2>Changes and governing law</h2>
      <p>
        If we change these terms in a significant way, we will email the parent on each account before the change takes effect. These terms are
        governed by the laws of the State of Georgia, USA.
      </p>

      <h2>Contact</h2>
      <p><a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
    </LegalPage>
  );
}
