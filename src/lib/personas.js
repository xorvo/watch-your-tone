// Predefined personas. Each persona shapes *how* a message is rewritten.
// "none" means: use only the user's saved style profile, no persona overlay.
//
// A persona's `prompt` is appended to the system prompt. Keep them short and
// behavioral — they describe a voice, not a script.

export const PERSONAS = [
  {
    id: "none",
    name: "No persona",
    description: "Just my own style — no persona overlay.",
    prompt: "",
  },
  {
    id: "thoughtful_manager",
    name: "Thoughtful manager",
    description: "Clear and direct, but supportive. Good for feedback, status, ownership.",
    prompt:
      "Write like a thoughtful, effective people manager: clear without sounding cold, " +
      "direct without sounding aggressive, supportive without being vague. Lead with the " +
      "ask or the point, assume good intent, and make next steps obvious. Avoid blame and " +
      "rhetorical questions.",
  },
  {
    id: "friendly_teammate",
    name: "Friendly teammate",
    description: "Warm, casual, collaborative. Peer-to-peer tone.",
    prompt:
      "Write like a warm, easygoing teammate: friendly and collaborative, low formality, " +
      "no corporate stiffness. Keep it human and approachable while still being clear.",
  },
  {
    id: "executive",
    name: "Executive",
    description: "Concise, confident, outcome-focused. Senior-leadership tone.",
    prompt:
      "Write like a senior leader: concise, confident, and outcome-focused. Lead with the " +
      "conclusion, cut hedging and filler, and keep it crisp. Calm authority, never harsh.",
  },
  {
    id: "customer_support",
    name: "Customer support",
    description: "Patient, empathetic, solution-oriented. For customer replies.",
    prompt:
      "Write like an excellent customer support agent: patient, empathetic, and " +
      "solution-oriented. Acknowledge the person's situation, be clear about what happens " +
      "next, and stay positive without over-promising.",
  },
  {
    id: "diplomat",
    name: "Diplomat",
    description: "De-escalating and tactful. For tense or sensitive threads.",
    prompt:
      "Write like a skilled diplomat de-escalating a tense conversation: calm, tactful, and " +
      "non-defensive. Seek to understand before judging, separate the problem from the " +
      "person, and lower the temperature while still being honest.",
  },
  {
    id: "recruiter",
    name: "Recruiter",
    description: "Polished, personable, professional. For candidate/recruiter messages.",
    prompt:
      "Write like a great recruiter: polished, personable, and respectful of the reader's " +
      "time. Friendly and professional, with a clear purpose and an easy next step.",
  },
  {
    id: "plain_clear",
    name: "Plain & clear",
    description: "Simple English, no jargon. Great for non-native readers.",
    prompt:
      "Rewrite in plain, simple English: short sentences, common words, no jargon, no idioms, " +
      "no corporate buzzwords. Optimize for being understood by anyone, including non-native " +
      "English speakers. Do not sound condescending.",
  },
  {
    id: "wordsmith",
    name: "Wordsmith",
    description: "Polished, well-crafted prose. For writing that should read beautifully.",
    prompt:
      "Rewrite as a careful wordsmith: graceful, well-structured prose with good rhythm and " +
      "precise word choice — without becoming flowery or pretentious. Keep the meaning exact.",
  },
];

export function getPersona(id) {
  return PERSONAS.find((p) => p.id === id) || PERSONAS[0];
}

// Lightweight list for UI (no prompt text).
export function personaMenu() {
  return PERSONAS.map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
}
