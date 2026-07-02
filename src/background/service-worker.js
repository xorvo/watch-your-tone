// Background service worker (ES module). The only place that holds credentials
// and talks to the AI provider. Content scripts and popups message it.

import { getSettings, isConfigured } from "../lib/storage.js";
import { buildPrompts, parseResponse } from "../lib/prompt.js";
import { runProvider } from "../lib/providers/index.js";
import { personaMenu } from "../lib/personas.js";
import { actionMenu } from "../lib/actions.js";

// Right-click context menu on selected text.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "toner-refine",
    title: "Refine with Toner",
    contexts: ["editable"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "toner-refine" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TONER_OPEN_PANEL" }, () => void chrome.runtime.lastError);
  }
});

// Keyboard shortcut (Commands API). Browser-level, so it works inside inputs and
// isn't intercepted by page-level extensions like Vimium.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "open-panel") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "TONER_OPEN_PANEL" }, () => void chrome.runtime.lastError);
});

// Detect a friendly app name from a hostname, for context hints.
function detectApp(hostname = "") {
  const h = hostname.toLowerCase();
  if (h.includes("slack.com")) return "slack";
  if (h.includes("mail.google.com")) return "gmail";
  if (h.includes("outlook")) return "outlook";
  if (h.includes("docs.google.com")) return "google docs";
  if (h.includes("notion.so")) return "notion";
  if (h.includes("linear.app")) return "linear";
  if (h.includes("github.com")) return "github";
  return "";
}

async function handleRewrite(payload) {
  const settings = await getSettings();

  if (!(await isConfigured())) {
    return {
      ok: false,
      error: "Toner isn't set up yet. Open the extension settings to add your API key or AWS credentials.",
      needsSetup: true,
    };
  }

  const text = (payload.text || "").trim();
  if (!text) {
    return { ok: false, error: "There's no text to work on." };
  }

  const context = {};
  if (settings.context.autoDetectApp && payload.hostname) {
    const app = detectApp(payload.hostname);
    if (app) context.app = app;
  }
  if (payload.audience) context.audience = payload.audience;
  if (payload.messageType) context.messageType = payload.messageType;

  const { system, user } = buildPrompts({
    actionId: payload.actionId,
    personaId: payload.personaId || settings.personaId,
    text,
    style: settings.style,
    context,
  });

  try {
    const raw = await runProvider(settings, { system, user, maxTokens: 2048 });
    const parsed = parseResponse(raw);
    if (!parsed || !parsed.suggestions.length) {
      return { ok: false, error: "The model didn't return a usable suggestion. Try again." };
    }
    return { ok: true, result: parsed };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg?.type) {
      case "TONER_GET_CONFIG": {
        const settings = await getSettings();
        sendResponse({
          ok: true,
          personas: personaMenu(),
          actions: actionMenu(),
          activePersonaId: settings.personaId,
          configured: await isConfigured(),
          disabledSites: settings.disabledSites,
        });
        break;
      }
      case "TONER_REWRITE": {
        sendResponse(await handleRewrite(msg.payload || {}));
        break;
      }
      case "TONER_OPEN_OPTIONS": {
        chrome.runtime.openOptionsPage();
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message type." });
    }
  })();
  return true; // keep the message channel open for async sendResponse
});
