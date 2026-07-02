import { getSettings, saveSettings, isConfigured } from "../lib/storage.js";
import { personaMenu } from "../lib/personas.js";
import { actionMenu } from "../lib/actions.js";

const $ = (sel) => document.querySelector(sel);

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rewrite(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "TONER_REWRITE", payload }, (resp) => {
      if (chrome.runtime.lastError)
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(resp);
    });
  });
}

async function init() {
  const settings = await getSettings();
  const configured = await isConfigured();

  // Status
  const status = $("#status");
  if (configured) {
    const provider =
      settings.provider === "bedrock"
        ? "AWS Bedrock"
        : settings.provider === "bagw"
        ? "Local agent gateway (bagw)"
        : settings.provider === "openai"
        ? "OpenAI API"
        : "Anthropic API";
    status.className = "status ok";
    status.textContent = `Ready · using ${provider}`;
  } else {
    status.className = "status warn";
    status.innerHTML = `Not set up yet. <span class="link" id="openSettings2">Add your API key or AWS credentials</span>.`;
    $("#openSettings2").addEventListener("click", () => chrome.runtime.openOptionsPage());
  }

  // Persona select
  const personaSel = $("#persona");
  personaMenu().forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.emoji || ""} ${p.name}`;
    if (p.id === settings.personaId) o.selected = true;
    personaSel.appendChild(o);
  });
  personaSel.addEventListener("change", () =>
    saveSettings({ personaId: personaSel.value })
  );

  // Action select
  const actionSel = $("#action");
  actionMenu().forEach((a) => {
    const o = document.createElement("option");
    o.value = a.id;
    o.textContent = `${a.emoji || ""} ${a.label}`;
    actionSel.appendChild(o);
  });

  // Settings button
  $("#settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

  // Run
  $("#run").addEventListener("click", run);

  async function run() {
    const text = $("#input").value.trim();
    const out = $("#out");
    if (!text) {
      out.innerHTML = `<div class="msg">Type or paste a message first.</div>`;
      return;
    }
    out.innerHTML = `<div class="msg"><span class="spinner"></span>Working…</div>`;
    const resp = await rewrite({
      actionId: actionSel.value,
      personaId: personaSel.value,
      text,
    });
    if (!resp || !resp.ok) {
      out.innerHTML = `<div class="err">${escapeHtml(resp?.error || "Something went wrong.")}</div>`;
      return;
    }
    renderResult(resp.result, out);
  }
}

function renderResult(result, out) {
  let html = "";
  if (result.toneFeedback)
    html += `<div class="tone">${escapeHtml(result.toneFeedback)}</div>`;
  (result.warnings || []).forEach((w) => {
    html += `<div class="err" style="margin-bottom:8px">⚠ ${escapeHtml(w)}</div>`;
  });
  result.suggestions.forEach((s, i) => {
    html += `<div class="card" data-i="${i}">
      <div class="lbl">${escapeHtml(s.label || "Suggestion")}</div>
      <textarea>${escapeHtml(s.text)}</textarea>
      <div class="row"><button class="ghost" data-copy="${i}">Copy</button></div>
    </div>`;
  });
  out.innerHTML = html;
  out.querySelectorAll("[data-copy]").forEach((b) => {
    b.addEventListener("click", async () => {
      const ta = out.querySelector(`[data-i="${b.dataset.copy}"] textarea`);
      try {
        await navigator.clipboard.writeText(ta.value);
        b.textContent = "Copied ✓";
        setTimeout(() => (b.textContent = "Copy"), 1200);
      } catch {
        b.textContent = "Copy failed";
      }
    });
  });
}

init();
