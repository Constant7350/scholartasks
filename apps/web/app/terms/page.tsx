import { LegalPage, SUPPORT_EMAIL } from "../legal";

export const metadata = { title: "Terms of service · ScholarTasks" };

export default function Terms() {
  return (
    <LegalPage title="Terms of service">
      <p>These terms are an agreement between you and ScholarTasks. By creating an account or using ScholarTasks, you agree to them.</p>

      <h2>Accounts</h2>
      <ul>
        <li>A parent or legal guardian who is at least 18 creates the family account and is responsible for it.</li>
        <li>Students get their own sign-in only at 13 or older, and join only through their parent&apos;s invite code. A parent may add a child aged 10 to 12 in grades 6 to 8 as a profile on the parent&apos;s own account; the child has no sign-in and AI features are off for them until they turn 13.</li>
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
        The career interest quiz and every career, major, trade or military suggestion in ScholarTasks are ideas to explore, not professional career
        counseling, a test of ability, or a recommendation that any student follow a particular path. Results depend on the answers given and can change
        as a student grows. ScholarTasks does not promise that a career will be a good fit, open to the student, or pay a certain amount. Students and
        families make their own decisions about careers, schools, majors and training and are responsible for those decisions.
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
        and your plan stays active until the end of the period you paid for. Monthly and yearly plans renew automatically at the price shown until
        you cancel. You can cancel online in a few taps, the same way you signed up, or in your App Store or Google Play subscriptions if you paid there.
      </p>
      <p>
        The Family plan is priced by your oldest student&apos;s grade: Explore for grades 6 to 8, Build for grades 9 and 10, and Apply for grades 11
        and 12. The price includes 2 students, and each additional student is $2.99 a month ($25 a year on yearly plans). When your oldest student&apos;s grade moves your family to another level, or they graduate or leave the
        account, or you add or remove an additional student, we tell you by email and in the app about 30 days before your next bill. The new price starts at that next billing date (at renewal for
        yearly plans), never in the middle of a period you already paid for.
      </p>
      <p>
        Students on a family account must be the parent&apos;s own children or children in their legal care. The parent is responsible for the
        consents they sign for each student.
      </p>

      <h2>Text messages</h2>
      <p>
        If you turn on text reminders, ScholarTasks sends automated deadline reminder texts to the number you confirm, up to 20 a month. Message and
        data rates may apply. Reply STOP to stop, or HELP for help. Texts are optional and never needed to use ScholarTasks. Carriers are not
        liable for delayed or undelivered messages.
      </p>

      <h2>Schools</h2>
      <p>
        A school that connects to ScholarTasks signs our student data agreement first. Families choose whether to connect to a school and what to share,
        and can stop sharing at any time. School staff may use what a family shares only to help that student.
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
