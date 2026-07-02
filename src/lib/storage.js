// All settings live in chrome.storage.local — never synced, so API keys and AWS
// credentials stay on this device. This is a deliberate privacy choice.

export const DEFAULTS = {
  provider: "anthropic", // "anthropic" | "openai" | "bedrock" | "bagw"

  // Direct Anthropic API
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-4-6",

  // OpenAI (or any OpenAI-compatible chat/completions endpoint)
  openai: {
    apiKey: "",
    model: "gpt-5.5",
    baseUrl: "https://api.openai.com/v1",
  },

  // bagw — Browser Agent Gateway (https://github.com/xorvo/bagw). Reuses your
  // locally-installed agent (e.g. Claude Code → Bedrock/profile/refresh). The
  // token is obtained by pairing (Connect), not pasted. Install: brew install
  // xorvo/tap/bagw  (then: brew services start bagw).
  bagw: {
    url: "http://127.0.0.1:8765",
    token: "", // set automatically after you approve the pairing
    agent: "claude", // which agent bagw should run
    model: "", // optional model override; empty = the agent's configured model
  },

  // AWS Bedrock (Claude via Bedrock)
  bedrock: {
    region: "us-east-1",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "", // optional, for temporary credentials
    modelId: "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
  },

  // Default persona applied to rewrites (see lib/personas.js)
  personaId: "none",

  // Personal style profile
  style: {
    tone: [], // e.g. ["concise", "kind", "direct"]
    avoid: [], // e.g. ["corporate jargon", "blame"]
    format: "", // freeform, e.g. "short slack-style message"
    preserveVoice: true,
    custom: "", // freeform extra guidance
  },

  // Optional context hints
  context: {
    autoDetectApp: true,
  },

  // Sites where Toner is disabled (hostnames)
  disabledSites: [],
};

export async function getSettings() {
  const stored = await chrome.storage.local.get(null);
  // Deep-merge defaults so new fields appear for existing installs.
  return {
    ...DEFAULTS,
    ...stored,
    openai: { ...DEFAULTS.openai, ...(stored.openai || {}) },
    bedrock: { ...DEFAULTS.bedrock, ...(stored.bedrock || {}) },
    bagw: { ...DEFAULTS.bagw, ...(stored.bagw || {}) },
    style: { ...DEFAULTS.style, ...(stored.style || {}) },
    context: { ...DEFAULTS.context, ...(stored.context || {}) },
  };
}

export async function saveSettings(patch) {
  await chrome.storage.local.set(patch);
}

export async function isConfigured() {
  const s = await getSettings();
  if (s.provider === "anthropic") return Boolean(s.anthropicApiKey);
  if (s.provider === "openai") return Boolean(s.openai.apiKey);
  if (s.provider === "bedrock")
    return Boolean(
      s.bedrock.accessKeyId && s.bedrock.secretAccessKey && s.bedrock.modelId
    );
  if (s.provider === "bagw") return Boolean(s.bagw.url && s.bagw.token);
  return false;
}
