/** Shown when someone uses an AI feature before saying yes to AI help. */
export const AI_CONSENT_NEEDED =
  "Please allow AI help first: tap Allow AI help in the notice on this page, or open Menu, then Face ID, sign-in and account.";

/** True when the database refused an AI turn because the person hasn't allowed AI help yet. */
export const needsAiConsent = (e: { message?: string } | null | undefined) => !!e && /ai consent needed/.test(e.message ?? "");

/** Pages with AI features; the Allow AI help notice appears on these. */
export const AI_PAGES = ["/counselor", "/grades", "/practice", "/scholarships", "/test-prep", "/study", "/essays"];
