import { getSettings, saveSettings } from "../lib/storage.js";
import { PERSONAS } from "../lib/personas.js";

const $ = (id) => document.getElementById(id);

function splitList(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

let pairedToken = ""; // bagw per-client token, set on load / after pairing

function setProviderVisibility(provider) {
  $("bagw-section").classList.toggle("active", provider === "bagw");
  $("anthropic-section").classList.toggle("active", provider === "anthropic");
  $("openai-section").classList.toggle("active", provider === "openai");
  $("bedrock-section").classList.toggle("active", provider === "bedrock");
}

function selectedProvider() {
  const el = document.querySelector('input[name="provider"]:checked');
  return el ? el.value : "anthropic";
}

async function load() {
  const s = await getSettings();

  document.querySelectorAll('input[name="provider"]').forEach((r) => {
    r.checked = r.value === s.provider;
    r.addEventListener("change", () => setProviderVisibility(selectedProvider()));
  });
  setProviderVisibility(s.provider);

  $("bagwUrl").value = s.bagw.url || "http://127.0.0.1:8765";
  $("bagwAgent").value = s.bagw.agent || "claude";
  $("bagwModel").value = s.bagw.model || "";
  pairedToken = s.bagw.token || "";
  if (pairedToken) {
    $("bagwStatus").className = "test-status ok";
    $("bagwStatus").textContent = "Connected ✓";
  }

  $("anthropicApiKey").value = s.anthropicApiKey || "";
  $("anthropicModel").value = s.anthropicModel || "claude-sonnet-4-6";

  $("openaiApiKey").value = s.openai.apiKey || "";
  $("openaiModel").value = s.openai.model || "gpt-5.5";
  $("openaiBaseUrl").value = s.openai.baseUrl || "https://api.openai.com/v1";

  $("bedrockRegion").value = s.bedrock.region || "";
  $("bedrockAccessKeyId").value = s.bedrock.accessKeyId || "";
  $("bedrockSecretAccessKey").value = s.bedrock.secretAccessKey || "";
  $("bedrockSessionToken").value = s.bedrock.sessionToken || "";
  $("bedrockModelId").value = s.bedrock.modelId || "";

  // Persona dropdown
  const personaSel = $("persona");
  PERSONAS.forEach((p) => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = `${p.emoji || ""} ${p.name}`;
    if (p.id === s.personaId) o.selected = true;
    personaSel.appendChild(o);
  });
  const updateDesc = () => {
    const p = PERSONAS.find((x) => x.id === personaSel.value);
    $("personaDesc").textContent = p ? p.description : "";
  };
  personaSel.addEventListener("change", updateDesc);
  updateDesc();

  $("styleTone").value = (s.style.tone || []).join(", ");
  $("styleAvoid").value = (s.style.avoid || []).join(", ");
  $("styleFormat").value = s.style.format || "";
  $("stylePreserveVoice").checked = s.style.preserveVoice !== false;
  $("styleCustom").value = s.style.custom || "";

  $("showInlineButton").checked = s.showInlineButton !== false;
  $("autoDetectApp").checked = s.context.autoDetectApp !== false;
  $("disabledSites").value = (s.disabledSites || []).join("\n");
}

function collect() {
  return {
    provider: selectedProvider(),
    bagw: {
      url: $("bagwUrl").value.trim() || "http://127.0.0.1:8765",
      token: pairedToken, // managed by the Connect (pairing) flow, not typed
      agent: $("bagwAgent").value.trim() || "claude",
      model: $("bagwModel").value.trim(),
    },
    anthropicApiKey: $("anthropicApiKey").value.trim(),
    anthropicModel: $("anthropicModel").value,
    openai: {
      apiKey: $("openaiApiKey").value.trim(),
      model: $("openaiModel").value.trim() || "gpt-5.5",
      baseUrl: $("openaiBaseUrl").value.trim() || "https://api.openai.com/v1",
    },
    bedrock: {
      region: $("bedrockRegion").value.trim() || "us-east-1",
      accessKeyId: $("bedrockAccessKeyId").value.trim(),
      secretAccessKey: $("bedrockSecretAccessKey").value.trim(),
      sessionToken: $("bedrockSessionToken").value.trim(),
      modelId: $("bedrockModelId").value.trim(),
    },
    personaId: $("persona").value,
    style: {
      tone: splitList($("styleTone").value),
      avoid: splitList($("styleAvoid").value),
      format: $("styleFormat").value.trim(),
      preserveVoice: $("stylePreserveVoice").checked,
      custom: $("styleCustom").value.trim(),
    },
    context: { autoDetectApp: $("autoDetectApp").checked },
    showInlineButton: $("showInlineButton").checked,
    disabledSites: splitList($("disabledSites").value),
  };
}

async function save() {
  await saveSettings(collect());
  const st = $("saveStatus");
  st.textContent = "Saved ✓";
  st.className = "save-status ok";
  // Tell open tabs to refresh their config.
  try {
    const tabs = await chrome.tabs.query({});
    tabs.forEach((t) => {
      if (t.id) chrome.tabs.sendMessage(t.id, { type: "TONER_CONFIG_UPDATED" }, () => void chrome.runtime.lastError);
    });
  } catch {}
  setTimeout(() => (st.textContent = ""), 2000);
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

async function testConnection() {
  // Save first so the background uses the latest credentials.
  await saveSettings(collect());
  const st = $("testStatus");
  st.className = "test-status";
  st.innerHTML = `<span class="spinner"></span>Testing…`;
  const resp = await rewrite({
    actionId: "grammar",
    personaId: "none",
    text: "this is a quick conection test",
  });
  if (resp && resp.ok) {
    st.textContent = "Connection works ✓";
    st.className = "test-status ok";
  } else {
    st.textContent = resp?.error || "Connection failed.";
    st.className = "test-status err";
  }
}

// Pair this extension with bagw: request access, wait for the user to approve
// it (native dialog or `bagw approve <code>`), then store the issued token.
async function bagwConnect() {
  const base = ($("bagwUrl").value.trim() || "http://127.0.0.1:8765").replace(/\/+$/, "");
  const agent = $("bagwAgent").value.trim() || "claude";
  const st = $("bagwStatus");
  st.className = "test-status";
  st.innerHTML = `<span class="spinner"></span>Requesting access…`;

  let pair;
  try {
    const r = await fetch(`${base}/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Toner", agent }),
    });
    pair = await r.json();
  } catch {
    st.className = "test-status err";
    st.textContent = `Couldn't reach bagw at ${base}. Is it running? (brew services start bagw)`;
    return;
  }
  if (!pair.pairingId) {
    st.className = "test-status err";
    st.textContent = pair.error || "Pairing request failed.";
    return;
  }

  const hint =
    pair.approval === "cli"
      ? ` — on the bagw machine run: bagw approve ${pair.code}`
      : " — approve the dialog on the bagw machine";
  st.className = "test-status";
  st.innerHTML = `Waiting for approval (code <b>${pair.code}</b>)${hint}…`;

  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    let p;
    try {
      p = await (await fetch(`${base}/pair/${pair.pairingId}`)).json();
    } catch {
      continue;
    }
    if (p.status === "approved" && p.token) {
      pairedToken = p.token;
      // Persist immediately and select bagw as the provider.
      document.querySelector('input[name="provider"][value="bagw"]').checked = true;
      setProviderVisibility("bagw");
      await saveSettings({
        provider: "bagw",
        bagw: { url: base, token: p.token, agent, model: $("bagwModel").value.trim() },
      });
      st.className = "test-status ok";
      st.textContent = "Connected ✓ — bagw approved this extension.";
      return;
    }
    if (p.status === "denied") {
      st.className = "test-status err";
      st.textContent = "Request was denied.";
      return;
    }
  }
  st.className = "test-status err";
  st.textContent = "Timed out waiting for approval. Click Connect to try again.";
}

$("save").addEventListener("click", save);
$("test").addEventListener("click", testConnection);
$("bagwConnect").addEventListener("click", bagwConnect);
load();
