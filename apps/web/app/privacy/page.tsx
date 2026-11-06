import { LegalPage, SUPPORT_EMAIL } from "../legal";

export const metadata = { title: "Privacy policy · ScholarTasks" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        ScholarTasks helps families plan for college, scholarships and financial aid. This policy explains what we collect, why, who can see it,
        and the choices you have. The short version: we collect only what we need to build your plan, we never sell your information, and parents
        stay in control of their student&apos;s account.
      </p>

      <h2>Who can use ScholarTasks</h2>
      <p>
        A parent or guardian creates the family account. Students must be at least 13 years old, and a student joins only with a code their parent
        creates. We do not knowingly collect information from children under 13. If you believe a child under 13 has given us information, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we will delete it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> your email address and, if you use Google sign-in, the name and email Google shares with us. If you choose a password, it is stored only in encrypted, one-way form. If you turn on text reminders, your cell phone number, used only to text you deadline reminders.</li>
        <li><strong>Family details:</strong> your family name, and for each student their first name, birth date, grade, state and the permissions you choose.</li>
        <li><strong>Planning details you add:</strong> such as courses, grades, test scores, colleges and scholarships you are interested in, and deadlines.</li>
        <li><strong>Basic technical data:</strong> sign-in times, device and browser type, and error logs, used to keep the service secure and working.</li>
      </ul>
      <p>
        We never ask for or store FAFSA FSA ID passwords, Social Security numbers or bank account numbers. When a form needs those, you enter them
        directly on the official government or school website.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To build your family&apos;s plan, check eligibility for programs such as Georgia HOPE and Zell Miller, and send reminders before deadlines.</li>
        <li>To power AI features that personalize suggestions for your student. AI providers we use process this information only to give you an answer and may not use it to train their models.</li>
        <li>To keep accounts secure, prevent abuse and fix problems.</li>
        <li>To send account emails such as sign-in links and reminders. You can ask us to stop reminder emails at any time.</li>
      </ul>
      <p><strong>We never sell personal information, and we never use student information for targeted advertising.</strong></p>

      <h2>Who can see it</h2>
      <ul>
        <li><strong>Inside your family:</strong> the parent who owns the account sees everything in it. A student sees and does only what their parent allows.</li>
        <li><strong>Service providers</strong> who host and run ScholarTasks for us under contract: Supabase (database and sign-in), Vercel (website hosting), Resend (email delivery), Twilio (text reminders, only if you turn them on), Anthropic (the Claude AI behind AI help, only when you use an AI feature and have allowed AI help) and Google (only if you choose Google sign-in).</li>
        <li><strong>When required by law,</strong> or to protect someone&apos;s safety.</li>
      </ul>
      <p>We never share student information with colleges, scholarship providers or anyone else unless you choose to send it.</p>

      <h2>How we protect it</h2>
      <p>
        Information is encrypted in transit and at rest. Database rules make sure each family can reach only its own records, and important changes
        are kept in a permanent audit log. Only a small number of authorized people can access production systems, and only to run the service. If a
        breach ever affects your information, we will tell you promptly.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>See, correct or download your family&apos;s information.</li>
        <li>Change what your student can see and do at any time from your family page.</li>
        <li>Delete a student or your whole account. We delete the information within 30 days, except where we must keep a record by law.</li>
      </ul>
      <p>To make a request, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>

      <h2>Changes</h2>
      <p>If we make a significant change to this policy, we will email the parent on each account before it takes effect.</p>

      <h2>Contact</h2>
      <p>Questions about privacy: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
