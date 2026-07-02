// Toner — content script.
// Renders the refinement panel inside a shadow root, opened via the right-click
// menu or the keyboard command (no on-page overlay button — it never covers page
// controls). It reads text only when you open it and replaces text only on approval.

(() => {
  if (window.__tonerLoaded) return;
  window.__tonerLoaded = true;

  const HOSTNAME = location.hostname;
  let CONFIG = {
    personas: [{ id: "none", name: "No persona" }],
    actions: [
      { id: "improve", label: "Improve" },
      { id: "grammar", label: "Fix grammar" },
      { id: "concise", label: "Make concise" },
      { id: "tone", label: "Check tone" },
    ],
    activePersonaId: "none",
    disabledSites: [],
  };

  let currentField = null; // the editable element the panel is acting on
  let capture = null; // snapshot of text taken when the panel opens
  let host = null; // shadow host element
  let root = null; // shadow root
  let panel = null;
  let panelOpen = false;

  // ---- editable detection ----------------------------------------------------
  const TEXT_INPUT_TYPES = new Set(["text", "search", "email", "url", "tel", ""]);

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName;
    if (tag === "TEXTAREA") return !el.disabled && !el.readOnly;
    if (tag === "INPUT")
      return (
        !el.disabled &&
        !el.readOnly &&
        TEXT_INPUT_TYPES.has((el.type || "").toLowerCase())
      );
    if (el.isContentEditable) return true;
    return false;
  }

  function activeEditable() {
    const a = document.activeElement;
    return isEditable(a) ? a : null;
  }

  function siteDisabled() {
    return (CONFIG.disabledSites || []).some((d) => HOSTNAME.includes(d));
  }

  // ---- text capture / replacement -------------------------------------------
  function snapshot(el) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const hadSelection = end > start;
      const full = el.value || "";
      return {
        el,
        isCE: false,
        hadSelection,
        selStart: start,
        selEnd: end,
        fullText: full,
        text: hadSelection ? full.slice(start, end) : full,
      };
    }
    const sel = window.getSelection();
    let selectedText = "";
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      const r = sel.getRangeAt(0);
      if (el.contains(r.commonAncestorContainer)) selectedText = sel.toString();
    }
    const full = el.innerText || "";
    return {
      el,
      isCE: true,
      hadSelection: Boolean(selectedText),
      fullText: full,
      text: selectedText || full,
    };
  }

  function applyReplacement(cap, newText) {
    const el = cap.el;
    el.focus();

    if (!cap.isCE) {
      if (cap.hadSelection) {
        const before = cap.fullText.slice(0, cap.selStart);
        const after = cap.fullText.slice(cap.selEnd);
        el.value = before + newText + after;
        const pos = (before + newText).length;
        try {
          el.setSelectionRange(pos, pos);
        } catch {}
      } else {
        el.value = newText;
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // contenteditable (Slack, Gmail, Notion, …). execCommand('insertText') is
    // deprecated but remains the most reliable way to write into these editors
    // so their internal state stays consistent.
    const sel = window.getSelection();
    if (!cap.hadSelection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    const ok = document.execCommand("insertText", false, newText);
    if (!ok) {
      el.textContent = newText;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  // ---- messaging -------------------------------------------------------------
  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (resp) => {
          if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
          else resolve(resp);
        });
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    });
  }

  // ---- UI --------------------------------------------------------------------
  const STYLE = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }

  .toner-panel {
    position: fixed; z-index: 2147483647; width: 360px; max-width: calc(100vw - 24px);
    background: #fff; color: #111827; border: 1px solid #e5e7eb; border-radius: 14px;
    box-shadow: 0 16px 48px rgba(15,23,42,.24); overflow: hidden; font-size: 13px;
  }
  .toner-head { display: flex; align-items: center; gap: 9px; padding: 11px 13px; border-bottom: 1px solid #eef1f4; }
  .toner-logo { width: 18px; height: 18px; border-radius: 5px;
    background: linear-gradient(135deg, #12897d, #0a4952); flex: 0 0 auto; }
  .toner-title { font-weight: 650; font-size: 13.5px; letter-spacing: .01em; }
  .toner-close { margin-left: auto; background: transparent; border: none; color: #9aa3af;
    font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px; border-radius: 6px; }
  .toner-close:hover { color: #111827; background: #f3f4f6; }

  .toner-body { padding: 12px 13px 13px; max-height: 72vh; overflow: auto; }

  .toner-field { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; }
  .toner-field .toner-label { font-size: 12px; color: #6b7280; flex: 0 0 auto; }
  .toner-persona { flex: 1; background: #fff; color: #111827; border: 1px solid #d1d5db;
    border-radius: 8px; padding: 5px 8px; font-size: 12.5px; }

  .toner-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .toner-action { border: 1px solid #d7dbe0; background: #fff; border-radius: 8px;
    padding: 5px 10px; font-size: 12.5px; cursor: pointer; color: #1f2937; transition: all .1s ease; }
  .toner-action:hover { background: #f0fdfa; border-color: #5eead4; color: #0f766e; }
  .toner-action.primary { background: #0d9488; border-color: #0d9488; color: #fff; }
  .toner-action.primary:hover { background: #0f766e; }

  .toner-label-sm { font-size: 11px; text-transform: uppercase; letter-spacing: .05em;
    color: #9aa3af; margin: 4px 0 5px; font-weight: 600; }
  .toner-hint { color: #6b7280; font-size: 12.5px; padding: 4px 0; }

  .toner-tone { background: #fff8ed; border: 1px solid #fde3b8; color: #92610d; border-radius: 10px;
    padding: 9px 10px; margin-bottom: 10px; line-height: 1.4; }
  .toner-warn { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px;
    padding: 7px 9px; margin-bottom: 8px; font-size: 12.5px; }

  .toner-card { border: 1px solid #cdeee9; background: #f5fdfb; border-radius: 10px; padding: 10px; margin-bottom: 10px; }
  .toner-card-label { font-size: 11px; color: #0f766e; font-weight: 650; margin-bottom: 5px;
    text-transform: uppercase; letter-spacing: .04em; }
  .toner-suggest { width: 100%; min-height: 74px; resize: vertical; border: 1px solid #d1d5db;
    border-radius: 8px; padding: 8px; font-size: 13px; line-height: 1.45; color: #111827; background: #fff; }
  .toner-row { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }

  .toner-primary { background: #0d9488; color: #fff; border: none; border-radius: 8px;
    padding: 7px 13px; font-size: 12.5px; cursor: pointer; font-weight: 600; }
  .toner-primary:hover { background: #0f766e; }
  .toner-ghost { background: #fff; color: #374151; border: 1px solid #d1d5db; border-radius: 8px;
    padding: 7px 11px; font-size: 12.5px; cursor: pointer; }
  .toner-ghost:hover { background: #f3f4f6; }

  .toner-status { color: #6b7280; font-size: 12.5px; padding: 6px 0; }
  .toner-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 10px; padding: 9px 10px; }
  .toner-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid #d7dbe0;
    border-top-color: #0d9488; border-radius: 50%; animation: toner-spin .7s linear infinite; vertical-align: -1px; margin-right: 7px; }
  @keyframes toner-spin { to { transform: rotate(360deg); } }
  .toner-link { color: #0d9488; cursor: pointer; text-decoration: underline; }
  `;

  function ensureHost() {
    if (host) return;
    host = document.createElement("div");
    host.id = "toner-host";
    root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);
    document.documentElement.appendChild(host);
  }

  function buildPanel() {
    ensureHost();
    panel = document.createElement("div");
    panel.className = "toner-panel";

    const personaOpts = CONFIG.personas
      .map(
        (p) =>
          `<option value="${p.id}" ${
            p.id === CONFIG.activePersonaId ? "selected" : ""
          }>${escapeHtml(p.name)}</option>`
      )
      .join("");

    const actionBtns = CONFIG.actions
      .map(
        (a) =>
          `<button class="toner-action${a.id === "improve" ? " primary" : ""}" data-action="${a.id}">${escapeHtml(
            a.label
          )}</button>`
      )
      .join("");

    panel.innerHTML = `
      <div class="toner-head">
        <span class="toner-logo"></span>
        <span class="toner-title">Toner</span>
        <button class="toner-close" title="Close">&times;</button>
      </div>
      <div class="toner-body">
        <div class="toner-field">
          <span class="toner-label">Persona</span>
          <select class="toner-persona">${personaOpts}</select>
        </div>
        <div class="toner-actions">${actionBtns}</div>
        <div class="toner-out"></div>
      </div>
    `;
    root.appendChild(panel);

    panel.querySelector(".toner-close").addEventListener("click", closePanel);
    panel.querySelector(".toner-persona").addEventListener("change", (e) => {
      CONFIG.activePersonaId = e.target.value;
    });
    panel.querySelectorAll(".toner-action").forEach((b) => {
      b.addEventListener("click", () => runAction(b.dataset.action));
    });
    return panel;
  }

  function positionPanel() {
    if (!panel || !currentField || !document.contains(currentField)) return;
    const r = currentField.getBoundingClientRect();
    const pw = 360;
    let left = Math.min(r.left, window.innerWidth - pw - 12);
    left = Math.max(12, left);
    let top = r.bottom + 8;
    const ph = panel.offsetHeight || 320;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
  }

  function openPanel(initialAction) {
    if (siteDisabled()) return;
    const field = activeEditable();
    if (!field) {
      toast("Put your cursor in a text box first, then open Toner.");
      return;
    }
    currentField = field;
    capture = snapshot(currentField);
    if (!panel) buildPanel();
    panel.style.display = "block";
    panelOpen = true;
    panel.querySelector(".toner-out").innerHTML = capture.text
      ? `<div class="toner-hint">Pick an action to refine your message.</div>`
      : `<div class="toner-hint">This field is empty — type something first.</div>`;
    positionPanel();
    if (initialAction && capture.text) runAction(initialAction);
  }

  function closePanel() {
    if (panel) panel.style.display = "none";
    panelOpen = false;
    capture = null;
  }

  async function runAction(actionId) {
    const out = panel.querySelector(".toner-out");
    if (!capture || !capture.text) {
      out.innerHTML = `<div class="toner-hint">There's no text to work on yet.</div>`;
      return;
    }
    out.innerHTML = `<div class="toner-status"><span class="toner-spinner"></span>Working…</div>`;

    const resp = await send({
      type: "TONER_REWRITE",
      payload: {
        actionId,
        personaId: CONFIG.activePersonaId,
        text: capture.text,
        hostname: HOSTNAME,
      },
    });

    if (!resp || !resp.ok) {
      const msg = resp?.error || "Something went wrong.";
      out.innerHTML = `<div class="toner-error">${escapeHtml(msg)} ${
        resp?.needsSetup ? `<span class="toner-link" data-open-settings>Open settings</span>` : ""
      }</div>`;
      const link = out.querySelector("[data-open-settings]");
      if (link) link.addEventListener("click", () => send({ type: "TONER_OPEN_OPTIONS" }));
      return;
    }
    renderResult(resp.result);
  }

  function renderResult(result) {
    const out = panel.querySelector(".toner-out");
    let html = "";
    if (result.toneFeedback) {
      html += `<div class="toner-label-sm">How it may come across</div>
               <div class="toner-tone">${escapeHtml(result.toneFeedback)}</div>`;
    }
    (result.warnings || []).forEach((w) => {
      html += `<div class="toner-warn">${escapeHtml(w)}</div>`;
    });
    html += `<div class="toner-label-sm">Suggestion${result.suggestions.length > 1 ? "s" : ""}</div>`;

    result.suggestions.forEach((s, i) => {
      html += `<div class="toner-card" data-sugg="${i}">
        <div class="toner-card-label">${escapeHtml(s.label || "Suggestion")}</div>
        <textarea class="toner-suggest">${escapeHtml(s.text)}</textarea>
        <div class="toner-row">
          <button class="toner-primary" data-replace="${i}">Replace</button>
          <button class="toner-ghost" data-copy="${i}">Copy</button>
        </div>
      </div>`;
    });

    html += `<div class="toner-row" style="margin-top:8px">
      <button class="toner-ghost" data-regen>Try again</button>
    </div>`;

    out.innerHTML = html;

    out.querySelectorAll("[data-replace]").forEach((b) => {
      b.addEventListener("click", () => {
        const ta = out.querySelector(`[data-sugg="${b.dataset.replace}"] .toner-suggest`);
        applyReplacement(capture, ta.value);
        closePanel();
      });
    });
    out.querySelectorAll("[data-copy]").forEach((b) => {
      b.addEventListener("click", async () => {
        const ta = out.querySelector(`[data-sugg="${b.dataset.copy}"] .toner-suggest`);
        try {
          await navigator.clipboard.writeText(ta.value);
          b.textContent = "Copied";
          setTimeout(() => (b.textContent = "Copy"), 1200);
        } catch {
          b.textContent = "Copy failed";
        }
      });
    });
    const regen = out.querySelector("[data-regen]");
    if (regen) regen.addEventListener("click", () => runAction("improve"));
    positionPanel();
  }

  // Small transient toast (e.g. when no text field is focused).
  let toastEl = null;
  function toast(text) {
    ensureHost();
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.cssText =
        "position:fixed;z-index:2147483647;left:50%;bottom:24px;transform:translateX(-50%);" +
        "background:#111827;color:#fff;padding:9px 14px;border-radius:10px;font-size:13px;" +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
        "box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:80vw;";
      root.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.display = "block";
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (toastEl.style.display = "none"), 2600);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Reposition the open panel on scroll/resize.
  window.addEventListener("scroll", () => panelOpen && positionPanel(), true);
  window.addEventListener("resize", () => panelOpen && positionPanel());

  // Opened via the right-click menu or the keyboard command (both routed through
  // the background service worker).
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "TONER_OPEN_PANEL") {
      openPanel(msg.actionId);
    } else if (msg?.type === "TONER_CONFIG_UPDATED") {
      loadConfig();
    }
  });

  // ---- init ------------------------------------------------------------------
  async function loadConfig() {
    const resp = await send({ type: "TONER_GET_CONFIG" });
    if (resp && resp.ok) {
      CONFIG = { ...CONFIG, ...resp };
      if (panel) {
        panel.remove();
        panel = null;
      }
    }
  }
  loadConfig();
})();
