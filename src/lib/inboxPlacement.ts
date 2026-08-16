/**
 * Heuristics for the content signals mailbox providers (notably Gmail) use to route
 * bulk mail to the Promotions tab. These are advisory: placement is decided per
 * recipient by the provider and can never be guaranteed by the sender.
 */

export interface PlacementIssue {
  field: "subject" | "body";
  message: string;
}

const PROMO_WORDS = [
  "free",
  "discount",
  "sale",
  "offer",
  "deal",
  "bonus",
  "save",
  "% off",
  "limited time",
  "act now",
  "buy now",
  "click here",
  "sign up now",
  "exclusive",
  "unbeatable",
  "guaranteed",
];

export function checkInboxPlacement(subject: string, body: string): PlacementIssue[] {
  const issues: PlacementIssue[] = [];
  const s = subject.trim();
  const b = body.trim();

  // Subject signals — weighted heaviest by filters.
  if (/[A-Z]{4,}/.test(s)) {
    issues.push({
      field: "subject",
      message: "Words in ALL CAPS read as advertising. Use normal sentence case.",
    });
  }
  if (/!{2,}|\?{2,}/.test(s)) {
    issues.push({ field: "subject", message: "Repeated ! or ? is a strong promotional signal." });
  }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s)) {
    issues.push({ field: "subject", message: "Emoji in the subject line pushes mail to Promotions." });
  }
  if (s.length > 60) {
    issues.push({ field: "subject", message: "Keep the subject under 60 characters — long subjects look like campaigns." });
  }

  const subjectPromo = PROMO_WORDS.filter((w) => s.toLowerCase().includes(w));
  if (subjectPromo.length) {
    issues.push({
      field: "subject",
      message: `Promotional wording in the subject (${subjectPromo.join(", ")}). Describe the message plainly instead.`,
    });
  }

  // Body signals.
  const bodyPromo = PROMO_WORDS.filter((w) => b.toLowerCase().includes(w));
  if (bodyPromo.length > 2) {
    issues.push({
      field: "body",
      message: `Heavy sales language (${bodyPromo.slice(0, 4).join(", ")}). Write it the way you'd write to one person.`,
    });
  }
  if ((b.match(/https?:\/\//g) || []).length > 2) {
    issues.push({ field: "body", message: "More than two links looks like a newsletter. One clear link performs best." });
  }
  if (b.length > 1200) {
    issues.push({ field: "body", message: "Long messages read as bulk mail. Short, personal notes land in the inbox more often." });
  }
  if (b.length > 0 && b.length < 40) {
    issues.push({ field: "body", message: "Very short messages with a link look like spam. Add a line of real context." });
  }

  return issues;
}
