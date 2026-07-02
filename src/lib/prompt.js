// Builds the system + user prompts for a rewrite request, and parses the
// model's JSON response. Provider-agnostic: works the same for Anthropic and
// Bedrock since both speak the Messages API.

import { getPersona } from "./personas.js";
import { getAction } from "./actions.js";

const BASE_SYSTEM = `You are "Toner", a careful writing coach and editor embedded in the user's text box. You help people refine written communication before they send it.

Core rules — follow all of them:
- Preserve the author's intent and meaning. Do not invent facts, commitments, names, numbers, or details that are not present.
- Keep the author's own voice when possible. Prefer minimal edits over heavy rewriting unless the requested action calls for more.
- Do not add emotional intensity that was not in the original.
- Do not turn casual messages into stiff corporate language, and avoid filler like "I hope this message finds you well" unless it genuinely fits.
- Never include meta-commentary, apologies, or notes about being an AI. Return only the rewritten content in the JSON fields.
- You are an editor, not a sender. Never claim to have sent anything.

You ALWAYS respond with a single valid JSON object and nothing else, matching this shape:
{
  "suggestions": [ { "text": "<rewritten message>", "label": "<short label>" } ],
  "tone_feedback": "<one or two sentences on how the ORIGINAL may come across; empty string if not relevant>",
  "warnings": [ "<optional short warning>" ]
}
Provide 1 suggestion unless asked for alternatives. Do not wrap the JSON in markdown fences.`;

function styleBlock(style) {
  if (!style) return "";
  const lines = [];
  if (style.tone && style.tone.length)
    lines.push(`Preferred tone: ${style.tone.join(", ")}.`);
  if (style.format) lines.push(`Preferred format: ${style.format}.`);
  if (style.avoid && style.avoid.length)
    lines.push(`Avoid: ${style.avoid.join(", ")}.`);
  if (style.preserveVoice)
    lines.push("Preserve the author's wording and voice as much as possible.");
  if (style.custom) lines.push(style.custom);
  if (!lines.length) return "";
  return `\n\nThe user's personal style profile (apply it):\n- ${lines.join("\n- ")}`;
}

function contextBlock(context) {
  if (!context) return "";
  const parts = [];
  if (context.app) parts.push(`App: ${context.app}`);
  if (context.audience) parts.push(`Audience: ${context.audience}`);
  if (context.messageType) parts.push(`Message type: ${context.messageType}`);
  if (!parts.length) return "";
  return `\n\nContext for this message: ${parts.join("; ")}.`;
}

export function buildPrompts({ actionId, personaId, text, style, context }) {
  const action = getAction(actionId);
  const persona = getPersona(personaId);

  let system = BASE_SYSTEM;
  if (persona.prompt) {
    system += `\n\nPersona to write as — "${persona.name}":\n${persona.prompt}`;
  }
  system += styleBlock(style);
  system += contextBlock(context);

  if (action.toneCheck) {
    system +=
      `\n\nFor this request, fill "tone_feedback" with a brief, candid read on how the ` +
      `original may land, and put the constructive rewrite in "suggestions".`;
  }
  if (action.multi) {
    system += `\n\nFor this request, return 3-5 suggestions, each with a distinct labeled style.`;
  }

  const user = `${action.instruction}\n\nMessage to work on:\n"""\n${text}\n"""`;

  return { system, user };
}

// Lenient JSON extraction — models occasionally add stray text or fences.
export function parseResponse(rawText) {
  if (!rawText) return null;
  let s = rawText.trim();

  // Strip ```json ... ``` fences if present.
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();

  // Find the outermost JSON object.
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1);
  }

  try {
    const obj = JSON.parse(s);
    const suggestions = Array.isArray(obj.suggestions)
      ? obj.suggestions
          .filter((x) => x && typeof x.text === "string" && x.text.trim())
          .map((x) => ({ text: x.text.trim(), label: x.label || "Suggestion" }))
      : [];
    return {
      suggestions,
      toneFeedback: typeof obj.tone_feedback === "string" ? obj.tone_feedback : "",
      warnings: Array.isArray(obj.warnings) ? obj.warnings.filter(Boolean) : [],
    };
  } catch (e) {
    // Fallback: treat the whole thing as a single suggestion.
    return {
      suggestions: [{ text: rawText.trim(), label: "Suggestion" }],
      toneFeedback: "",
      warnings: ["Response was not valid JSON; showing raw output."],
    };
  }
}
