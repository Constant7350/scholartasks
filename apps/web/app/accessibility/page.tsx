import { LegalPage, SUPPORT_EMAIL } from "../legal";

export const metadata = { title: "Accessibility · ScholarTasks" };

export default function Accessibility() {
  return (
    <LegalPage title="Accessibility">
      <p>
        ScholarTasks is built for every family and student, including people who use screen readers, keyboard navigation, captions, zoom or larger
        text. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.1 at level AA on the website and in the phone app.
      </p>
      <h2>What we do</h2>
      <ul>
        <li>Check pages with automated accessibility tools and by hand, on phones and computers.</li>
        <li>Label every form field and button, keep text readable against its background, and let you zoom without breaking the page.</li>
        <li>Offer the whole app and AI answers in Spanish.</li>
      </ul>
      <h2>Tell us about a problem</h2>
      <p>
        If something is hard to use, email <a href={`mailto:${SUPPORT_EMAIL}?subject=Accessibility`}>{SUPPORT_EMAIL}</a> with the page and what
        happened. We&apos;ll reply as soon as we can and help you get the information another way while we fix it.
      </p>
    </LegalPage>
  );
}
