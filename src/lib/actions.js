// Predefined actions ("modes"). Each action is a discrete instruction the user
// can trigger. `multi` actions ask the model for several labeled alternatives.
// `toneCheck` actions emphasize returning tone feedback before the rewrite.

export const ACTIONS = [
  {
    id: "improve",
    label: "Improve",
    instruction:
      "Improve this message: fix grammar and awkward phrasing, sharpen clarity, and make it " +
      "read well — while fully preserving the author's intent and meaning.",
  },
  {
    id: "grammar",
    label: "Fix grammar",
    instruction:
      "Fix only grammar, spelling, punctuation, and clearly awkward phrasing. Make the " +
      "smallest possible edits. Do not change tone, structure, or meaning.",
  },
  {
    id: "concise",
    label: "Make concise",
    instruction:
      "Make this message shorter and tighter while keeping every important point and the " +
      "author's intent. Cut filler, redundancy, and hedging.",
  },
  {
    id: "clear",
    label: "Make clearer",
    instruction:
      "Make this message easier to understand: clearer structure, plainer wording, and an " +
      "obvious main point. Keep the meaning identical.",
  },
  {
    id: "warmer",
    label: "Warmer",
    instruction:
      "Make this message warmer and more considerate without adding emotion that wasn't " +
      "there or becoming gushy. Keep it genuine.",
  },
  {
    id: "direct",
    label: "More direct",
    instruction:
      "Make this message more direct and to-the-point with a clear ask — without becoming " +
      "rude, blunt, or demanding.",
  },
  {
    id: "professional",
    label: "More professional",
    instruction:
      "Make this message sound more professional and polished for a workplace context, " +
      "without turning it into stiff corporate language.",
  },
  {
    id: "diplomatic",
    label: "More diplomatic",
    instruction:
      "Make this message more diplomatic and tactful, especially if any part could land as " +
      "harsh, blaming, or passive-aggressive. Keep it honest.",
  },
  {
    id: "tone",
    label: "Check tone",
    toneCheck: true,
    instruction:
      "Assess how this message is likely to come across to the reader. Identify any risk that " +
      "it sounds harsh, blaming, passive-aggressive, dismissive, vague, or overly long. Then " +
      "offer a more constructive version that keeps the author's intent.",
  },
  {
    id: "alternatives",
    label: "Alternatives",
    multi: true,
    instruction:
      "Provide several distinct rewrites of this message in different styles. Label each one " +
      "(for example: Friendly, Direct, Executive, Diplomatic). All must preserve the author's " +
      "intent.",
  },
];

export function getAction(id) {
  return ACTIONS.find((a) => a.id === id) || ACTIONS[0];
}

export function actionMenu() {
  return ACTIONS.map(({ id, label }) => ({ id, label }));
}
