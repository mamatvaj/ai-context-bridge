// ============================================================
// AI Context Bridge — Content Script (Shadow DOM Widget)
// ============================================================

(function () {
  "use strict";

  if (window.__AICB_INJECTED__) return;
  window.__AICB_INJECTED__ = true;

  // ── CSS (fully isolated inside Shadow DOM) ────────────────
  const WIDGET_CSS = `
    :host {
      all: initial;
      display: block;
      position: fixed;
      top: 0; left: 0;
      width: 0; height: 0;
      overflow: visible;
      z-index: 2147483647;
      pointer-events: none;
      --bg:        #0f1623;
      --bg2:       #141c2b;
      --surface:   #1a2235;
      --surface2:  #1e2840;
      --border:    rgba(255,255,255,0.08);
      --border2:   rgba(255,255,255,0.12);
      --accent:    #00c6a2;
      --accent2:   #5b8dee;
      --text:      #e8edf5;
      --text-dim:  #6b7a99;
      --text-mid:  #9aa3b8;
      --danger:    #f04e6a;
      --green:     #22c55e;
      --shadow:    0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06);
      --r-sm:      8px;
      --r-md:      12px;
      --r-lg:      18px;
      --r-pill:    999px;
      --mono:      'SF Mono','Fira Code',monospace;
      --ui:        -apple-system,'Segoe UI',system-ui,sans-serif;
      --zi:        2147483647;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── FAB ──────────────────────────────────────────── */
    #aicb-fab {
      position: fixed; z-index: var(--zi);
      right: 24px; bottom: 24px;
      width: 46px; height: 46px; border-radius: 50%;
      background: linear-gradient(135deg, #00c6a2, #5b8dee);
      border: none; cursor: grab; pointer-events: auto;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 18px rgba(0,198,162,0.35), 0 0 0 1px rgba(255,255,255,0.1);
      transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s;
      user-select: none; outline: none;
    }
    #aicb-fab:hover { transform:scale(1.08); box-shadow:0 6px 24px rgba(0,198,162,0.5); }
    #aicb-fab:active { cursor:grabbing; transform:scale(0.94); }
    #aicb-fab svg { width:20px; height:20px; fill:#fff; pointer-events:none; }
    #aicb-fab.pulse::after {
      content:''; position:absolute; width:100%; height:100%; border-radius:50%;
      border:2px solid var(--accent); animation:pulse-ring 1.6s ease-out infinite;
    }
    @keyframes pulse-ring { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(1.9);opacity:0} }

    /* ── Panel ────────────────────────────────────────── */
    #aicb-panel {
      position: fixed; z-index: var(--zi);
      right: 78px; bottom: 24px; width: 320px;
      background: var(--bg2);
      border: 1px solid var(--border2);
      border-radius: var(--r-lg);
      box-shadow: var(--shadow);
      font-family: var(--ui);
      pointer-events: auto;
      overflow: hidden;
      animation: panel-in 0.2s cubic-bezier(0.34,1.56,0.64,1) both;
    }
    #aicb-panel.hidden { display:none !important; }
    @keyframes panel-in { from{transform:scale(0.88) translateY(6px);opacity:0} to{transform:none;opacity:1} }

    /* ── Header ───────────────────────────────────────── */
    .hdr {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 16px 12px;
      border-bottom: 1px solid var(--border);
      cursor: move; user-select: none;
    }
    .hdr-left { display: flex; align-items: center; gap: 8px; }
    .dot {
      width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      background: var(--green); box-shadow: 0 0 8px rgba(34,197,94,0.6);
    }
    .hdr-text {
      display: flex; align-items: baseline; gap: 7px;
    }
    .title {
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--text); font-family: var(--mono);
    }
    .title-sep { color: var(--border2); font-size: 11px; }
    .status-badge { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); font-family: var(--mono); }
    .status-badge.error { color: var(--danger); }
    .close-btn {
      background: none; border: none; color: var(--text-dim); cursor: pointer;
      width: 26px; height: 26px; display: flex; align-items: center;
      justify-content: center; border-radius: 50%;
      transition: color 0.15s, background 0.15s;
    }
    .close-btn:hover { color: var(--text); background: rgba(255,255,255,0.08); }

    /* ── Creator bar ──────────────────────────────────── */
    .creator-bar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 5px 14px 6px;
      border-bottom: 1px solid var(--border);
    }
    .creator-by {
      font-size: 9px; color: var(--text-dim); font-family: var(--mono);
      letter-spacing: 0.03em;
    }
    .creator-by strong { color: var(--text-mid); font-weight: 600; }
    .creator-link {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 9px; color: var(--accent); text-decoration: none;
      opacity: 0.7; transition: opacity 0.15s; font-family: var(--mono);
      letter-spacing: 0.02em;
    }
    .creator-link:hover { opacity: 1; }

    /* ── Segmented Toggle (Full Page / Selected Text) ── */
    .seg-wrap { padding: 12px 14px 0; }
    .seg {
      display: grid; grid-template-columns: 1fr 1fr;
      background: var(--bg); border: 1px solid var(--border);
      border-radius: var(--r-pill); padding: 3px; gap: 0;
    }
    .seg-btn {
      border: none; background: none;
      font-size: 12px; font-weight: 500; color: var(--text-dim);
      padding: 7px 10px; border-radius: var(--r-pill); cursor: pointer;
      transition: color 0.2s, background 0.2s;
      font-family: var(--ui); letter-spacing: 0.01em;
    }
    .seg-btn.active {
      background: var(--surface2);
      color: var(--text);
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    }
    .seg-btn:not(.active):hover { color: var(--text-mid); }

    /* ── Preview ──────────────────────────────────────── */
    .preview-wrap { padding: 10px 14px 12px; }
    .preview-box {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--r-md); padding: 10px 12px;
      font-size: 12px; color: var(--text-mid); line-height: 1.45;
      min-height: 44px; max-height: 60px; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      font-style: italic;
    }

    /* Platform selector */
    .platform-wrap { padding: 0 14px 12px; }
    .platform-label {
      font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--text-dim);
      font-family: var(--mono); margin-bottom: 6px; display: block;
    }
    .select-wrap { position: relative; }
    .select-icon {
      position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
      display: flex; align-items: center; pointer-events: none; z-index: 1;
    }
    select {
      width: 100%; background: var(--surface);
      border: 1px solid var(--border2);
      border-radius: var(--r-md); color: var(--text);
      font-size: 13px; font-weight: 500; padding: 9px 36px 9px 34px;
      cursor: pointer; appearance: none; -webkit-appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7a99' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center;
      font-family: var(--ui); transition: border-color 0.15s;
    }
    select:focus { outline: none; border-color: rgba(0,198,162,0.4); }
    select option { background: var(--bg2); color: var(--text); }

    /* Custom textarea — compact wrap, slides in above buttons */
    .custom-wrap { padding: 0 14px 8px; }
    .custom-wrap.hidden { display: none; }
    textarea {
      width: 100%; background: var(--surface); border: 1px solid var(--border2);
      border-radius: var(--r-sm); color: var(--text); font-size: 12px;
      padding: 7px 10px; resize: none; height: 52px;
      font-family: var(--ui); line-height: 1.4; transition: border-color 0.15s;
    }
    textarea:focus { outline: none; border-color: rgba(0,198,162,0.4); }
    textarea::placeholder { color: var(--text-dim); }

    /* ── Action buttons — always 3-col, never reflow ───── */
    .actions {
      display: grid; grid-template-columns: 1fr 1fr 1fr;
      gap: 6px; padding: 0 14px 14px;
    }
    button.btn {
      border: 1px solid var(--border2);
      background: var(--surface);
      color: var(--text-mid);
      font-size: 11px; font-weight: 600;
      padding: 8px 4px; border-radius: var(--r-pill);
      cursor: pointer; display: flex; align-items: center;
      justify-content: center; gap: 4px;
      transition: border-color 0.15s, background 0.15s, color 0.15s, transform 0.1s;
      font-family: var(--ui); white-space: nowrap; min-width: 0;
    }
    button.btn:hover {
      border-color: rgba(0,198,162,0.35);
      background: var(--surface2); color: var(--text);
      transform: translateY(-1px);
    }
    button.btn:active { transform: translateY(0); }
    /* Custom Ask → Send: highlight in-place, stays in same grid cell */
    button.btn.send-mode {
      background: linear-gradient(135deg, rgba(0,198,162,0.18), rgba(91,141,238,0.18));
      border-color: rgba(0,198,162,0.4); color: var(--accent);
    }
    button.btn.send-mode:hover {
      background: linear-gradient(135deg, rgba(0,198,162,0.28), rgba(91,141,238,0.28));
      border-color: var(--accent);
    }
    .icon { font-size: 12px; line-height: 1; }

    /* ── Status bar ───────────────────────────────────── */
    .status-bar {
      padding: 7px 14px 8px; font-size: 10px; font-family: var(--mono);
      color: var(--accent); border-top: 1px solid var(--border);
      text-align: center; letter-spacing: 0.06em;
      display: flex; align-items: center; justify-content: center; gap: 6px;
    }
    .status-bar.error { color: var(--danger); }
    .status-bar .star {
      font-size: 11px; opacity: 0.5;
    }

    /* ── Custom prompt pills ──────────────────────────── */
    .cp-section { padding: 0 14px 12px; }
    .cp-section.hidden { display: none; }
    .cp-label {
      font-size: 8.5px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--text-dim);
      font-family: var(--mono); margin-bottom: 6px; display: block;
    }
    .cp-pills {
      display: flex; flex-wrap: wrap; gap: 5px;
    }
    button.cp-pill {
      border: 1px solid var(--border2); background: var(--surface);
      color: var(--text-mid); font-size: 11px; font-weight: 500;
      padding: 5px 10px; border-radius: var(--r-pill);
      cursor: pointer; font-family: var(--ui);
      transition: border-color 0.15s, background 0.15s, color 0.15s;
      white-space: nowrap; max-width: 140px;
      overflow: hidden; text-overflow: ellipsis;
    }
    button.cp-pill:hover {
      border-color: rgba(0,198,162,0.4); background: var(--surface2); color: var(--text);
    }

    /* ── Selection Tooltip ────────────────────────────── */
    #aicb-tip {
      position: fixed; z-index: var(--zi);
      background: var(--bg2); border: 1px solid var(--border2);
      border-radius: var(--r-pill); padding: 5px 8px;
      display: flex; gap: 2px; align-items: center;
      box-shadow: 0 6px 20px rgba(0,0,0,0.5); pointer-events: auto;
    }
    #aicb-tip.hidden { display: none !important; }
    .tip-btn {
      background: none; border: none; color: var(--text-mid); font-size: 11px;
      font-weight: 600; padding: 4px 9px; cursor: pointer;
      border-radius: var(--r-pill); white-space: nowrap;
      transition: color 0.12s, background 0.12s; font-family: var(--ui);
    }
    .tip-btn:hover { color: var(--text); background: rgba(255,255,255,0.08); }
    .tip-sep { width: 1px; height: 14px; background: var(--border2); flex-shrink: 0; }
  `;

  // ── Constants ─────────────────────────────────────────────
  const PROVIDERS = [
    { id:"claude",  name:"Claude",   svg:`<svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="#c96a2a" opacity="0.25"/><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" stroke="#c96a2a" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="#c96a2a"/></svg>` },
    { id:"chatgpt", name:"ChatGPT",  svg:`<svg viewBox="0 0 24 24" fill="none" width="13" height="13"><circle cx="12" cy="12" r="9" fill="#10a37f" opacity="0.15" stroke="#10a37f" stroke-width="1.5"/><path d="M9 12h6M12 9v6" stroke="#10a37f" stroke-width="1.8" stroke-linecap="round"/></svg>` },
    { id:"grok",    name:"Grok",     svg:`<svg viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M13 3L5 14h7l-1 7 8-12h-7l1-6z" fill="#d1d5db" opacity="0.2" stroke="#d1d5db" stroke-width="1.5" stroke-linejoin="round"/></svg>` },
  ];

  // ── State ─────────────────────────────────────────────────
  let selectedText    = "";
  let isFullPage      = false;
  let currentProvider = "claude";
  let panelVisible    = false;
  let tooltipTimer    = null;
  let shadow          = null;

  // ── Bootstrap ─────────────────────────────────────────────
  function init() {
    // Zero-size fixed host — no layout impact on page
    const host = document.createElement("div");
    host.id = "aicb-host";
    host.style.cssText = "all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483647;pointer-events:none;";

    shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = WIDGET_CSS;
    shadow.appendChild(style);

    buildFAB();
    buildPanel();
    buildTooltip();

    (document.body || document.documentElement).appendChild(host);
    watchForRemoval(host);

    // Apply saved settings
    chrome.storage.local.get(["settings", "customPrompts"], (res) => {
      const s = res?.settings;
      if (s?.defaultProvider) {
        currentProvider = s.defaultProvider;
        const sel = shadow.querySelector("#aicb-provider");
        if (sel) sel.value = currentProvider;
      }
      if (s?.floatingWidget === false) hideFAB();
      renderCustomPills(res.customPrompts || []);
    });
  }

  // ── FAB ───────────────────────────────────────────────────
  function buildFAB() {
    const fab = document.createElement("button");
    fab.id = "aicb-fab";
    fab.title = "AI Context Bridge";
    fab.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z"/></svg>`;
    shadow.appendChild(fab);
    makeDraggable(fab);
    fab.addEventListener("click", () => {
      if (fab.dataset.dragged === "true") { fab.dataset.dragged = "false"; return; }
      togglePanel();
    });
  }

  // ── Panel ─────────────────────────────────────────────────
  function buildPanel() {
    const panel = document.createElement("div");
    panel.id = "aicb-panel";
    panel.className = "hidden";
    panel.innerHTML = `
      <div class="hdr" id="aicb-hdr">
        <div class="hdr-left">
          <div class="dot"></div>
          <div class="hdr-text">
            <span class="title">AI Context Bridge</span>
            <span class="title-sep">·</span>
            <span class="status-badge" id="aicb-status-badge">READY</span>
          </div>
        </div>
        <button class="close-btn" id="aicb-close" title="Close">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1 1l11 11M12 1L1 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="creator-bar">
        <span class="creator-by">v1.20 [29.03.2026] · by <strong>Mamatva</strong></span>
        <a class="creator-link" href="https://techwithmamatva.blogspot.com/" target="_blank" title="Tech with Mamatva">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          techwithmamatva
        </a>
      </div>

      <div class="seg-wrap">
        <div class="seg">
          <button class="seg-btn" id="aicb-seg-full">Full Page</button>
          <button class="seg-btn active" id="aicb-seg-sel">Selected Text</button>
        </div>
      </div>

      <div class="preview-wrap">
        <div class="preview-box" id="aicb-preview">No text selected — make a selection or switch modes.</div>
      </div>

      <div class="platform-wrap">
        <label class="platform-label">Target Platform</label>
        <div class="select-wrap">
          <div class="select-icon" id="aicb-sel-icon"></div>
          <select id="aicb-provider">
            ${PROVIDERS.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="custom-wrap hidden" id="aicb-custom-wrap">
        <textarea id="aicb-custom" placeholder="Your custom question or instruction…" rows="2"></textarea>
      </div>

      <div class="actions" id="aicb-actions">
        <button class="btn" id="aicb-explain"><span class="icon">💡</span> Explain</button>
        <button class="btn" id="aicb-summarize"><span class="icon">📝</span> Summarize</button>
        <button class="btn" id="aicb-custom-btn"><span class="icon">✏️</span> Custom Ask</button>
      </div>

      <div class="cp-section hidden" id="aicb-cp-section">
        <span class="cp-label">My Prompts</span>
        <div class="cp-pills" id="aicb-cp-pills"></div>
      </div>
    `;
    shadow.appendChild(panel);
    makeDraggable(panel, "aicb-hdr");
    wirePanel();
  }

  function wirePanel() {
    shadow.querySelector("#aicb-close").addEventListener("click", hidePanel);

    const sel = shadow.querySelector("#aicb-provider");
    const selIcon = shadow.querySelector("#aicb-sel-icon");

    function syncIcon() {
      const p = PROVIDERS.find(p => p.id === sel.value);
      if (selIcon && p) selIcon.innerHTML = p.svg;
    }

    sel.value = currentProvider;
    syncIcon();
    sel.addEventListener("change", () => {
      currentProvider = sel.value;
      syncIcon();
    });

    // Segmented toggle: Full Page ↔ Selected Text
    const segFull = shadow.querySelector("#aicb-seg-full");
    const segSel  = shadow.querySelector("#aicb-seg-sel");
    segFull.addEventListener("click", () => {
      isFullPage = true;
      segFull.classList.add("active");
      segSel.classList.remove("active");
      updatePreview();
    });
    segSel.addEventListener("click", () => {
      isFullPage = false;
      segSel.classList.add("active");
      segFull.classList.remove("active");
      updatePreview();
    });

    // Custom Ask — shows compact textarea above the grid, button becomes Send in-place
    const customArea = shadow.querySelector("#aicb-custom");
    const customWrap = shadow.querySelector("#aicb-custom-wrap");
    const customBtn  = shadow.querySelector("#aicb-custom-btn");

    customBtn.addEventListener("click", () => {
      const isOpen = !customWrap.classList.contains("hidden");
      if (!isOpen) {
        // Open: show textarea, change only the Custom Ask button to Send
        customWrap.classList.remove("hidden");
        customBtn.innerHTML = `<span class="icon">🚀</span> Send`;
        customBtn.classList.add("send-mode");
        customArea.focus();
      } else {
        // Already open — send if there's text, or close if empty
        const q = customArea.value.trim();
        if (!q) {
          customWrap.classList.add("hidden");
          customBtn.innerHTML = `<span class="icon">✏️</span> Custom Ask`;
          customBtn.classList.remove("send-mode");
        } else {
          sendAction("custom", q);
        }
      }
    });

    shadow.querySelector("#aicb-explain").addEventListener("click",   () => sendAction("explain"));
    shadow.querySelector("#aicb-summarize").addEventListener("click", () => sendAction("summarize"));
  }

  // ── Custom Prompt Pills ────────────────────────────────────
  function renderCustomPills(prompts) {
    const section = shadow.querySelector("#aicb-cp-section");
    const pills   = shadow.querySelector("#aicb-cp-pills");
    if (!section || !pills) return;

    if (!prompts || prompts.length === 0) {
      section.classList.add("hidden");
      return;
    }

    section.classList.remove("hidden");
    pills.innerHTML = prompts.map(p =>
      `<button class="cp-pill" data-cpid="${p.id}" title="${p.prompt.slice(0,80)}">${p.name}</button>`
    ).join("");

    pills.querySelectorAll(".cp-pill").forEach(btn => {
      btn.addEventListener("click", () => {
        sendCustomPrompt(btn.dataset.cpid);
      });
    });
  }

  function sendCustomPrompt(cpId) {
    const provider = shadow.querySelector("#aicb-provider")?.value || currentProvider;
    let text = "";
    if (isFullPage) {
      text = document.body.innerText.trim().slice(0, 50000);
    } else if (selectedText) {
      text = selectedText;
    } else {
      setStatus("⚠ No text — enable Full Page or select text", true);
      return;
    }
    setStatus("⟳ Opening platform…");
    chrome.runtime.sendMessage(
      { type: "AICB_SEND", action: "custom", text, provider, isFullPage, customPromptId: cpId },
      (res) => {
        if (chrome.runtime.lastError || !res?.success) { setStatus("✗ Error", true); return; }
        setStatus(`✓ Sent`);
        setTimeout(hidePanel, 1400);
      }
    );
  }

  // ── Tooltip ───────────────────────────────────────────────
  function buildTooltip() {
    const tip = document.createElement("div");
    tip.id = "aicb-tip";
    tip.className = "hidden";
    tip.innerHTML = `
      <button class="tip-btn" data-action="explain">💡 Explain</button>
      <div class="tip-sep"></div>
      <button class="tip-btn" data-action="summarize">📝 Summarize</button>
      <div class="tip-sep"></div>
      <button class="tip-btn" data-action="panel">⚡ More…</button>
    `;
    shadow.appendChild(tip);
    tip.addEventListener("mousedown", (e) => {
      const btn = e.target.closest(".tip-btn");
      if (!btn) return;
      e.preventDefault();
      const a = btn.dataset.action;
      if (a === "panel") { showPanel(); hideTip(); }
      else               { sendAction(a); hideTip(); }
    });
  }

  // ── Selection Detection ────────────────────────────────────
  document.addEventListener("mouseup", (e) => {
    if (e.composedPath().some(n => n?.id === "aicb-host")) return;
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      const sel  = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 5) {
        selectedText = text;
        updatePreview();
        showTip(sel);
        shadow.querySelector("#aicb-fab")?.classList.add("pulse");
      } else if (!isFullPage) {
        hideTip();
        shadow.querySelector("#aicb-fab")?.classList.remove("pulse");
      }
    }, 120);
  });

  document.addEventListener("keyup", () => {
    const text = window.getSelection()?.toString().trim();
    if (text && text.length > 5) {
      selectedText = text;
      updatePreview();
      shadow.querySelector("#aicb-fab")?.classList.add("pulse");
    }
  });

  document.addEventListener("mousedown", (e) => {
    if (e.composedPath().some(n => n?.id === "aicb-host")) return;
    clearTimeout(tooltipTimer);
    if (!isFullPage) hideTip();
  });

  // ── Tooltip Position ───────────────────────────────────────
  function showTip(sel) {
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    const tip   = shadow.querySelector("#aicb-tip");
    if (!tip) return;
    tip.style.left = Math.max(8, rect.left + rect.width / 2 - 80) + "px";
    tip.style.top  = (rect.top - 46 + window.scrollY) + "px";
    tip.classList.remove("hidden");
  }
  function hideTip() { shadow.querySelector("#aicb-tip")?.classList.add("hidden"); }

  // ── Panel Visibility ───────────────────────────────────────
  function togglePanel() { panelVisible ? hidePanel() : showPanel(); }
  function showPanel() {
    shadow.querySelector("#aicb-panel")?.classList.remove("hidden");
    panelVisible = true;
    updatePreview();
    hideTip();
    // Sync provider icon
    const sel = shadow.querySelector("#aicb-provider");
    const selIcon = shadow.querySelector("#aicb-sel-icon");
    if (sel && selIcon) {
      const p = PROVIDERS.find(p => p.id === sel.value);
      if (p) selIcon.innerHTML = p.svg;
    }
  }
  function hidePanel() {
    shadow.querySelector("#aicb-panel")?.classList.add("hidden");
    panelVisible = false;
  }
  function hideFAB() {
    const f = shadow?.querySelector("#aicb-fab");
    if (f) f.style.display = "none";
  }

  // ── Preview ────────────────────────────────────────────────
  function updatePreview() {
    const previewEl = shadow.querySelector("#aicb-preview");
    if (!previewEl) return;
    if (isFullPage) {
      const t = document.body.innerText.trim();
      previewEl.textContent = t.slice(0, 200) + (t.length > 200 ? "…" : "");
    } else if (selectedText) {
      previewEl.textContent = selectedText.slice(0, 200) + (selectedText.length > 200 ? "…" : "");
    } else {
      previewEl.textContent = "No text selected — make a selection or switch modes.";
    }
  }

  // ── Send ───────────────────────────────────────────────────
  function sendAction(action, customQ = "") {
    const provider = shadow.querySelector("#aicb-provider")?.value || currentProvider;
    let text = "";
    if (isFullPage) {
      text = document.body.innerText.trim().slice(0, 50000);
    } else if (selectedText) {
      text = selectedText;
    } else {
      setStatus("⚠ No text — enable Full Page or select text", true);
      return;
    }
    if (action === "custom" && customQ) text = `${customQ}\n\nContext:\n${text}`;
    setStatus("⟳ Opening platform…");
    chrome.runtime.sendMessage({ type: "AICB_SEND", action, text, provider, isFullPage }, (res) => {
      if (chrome.runtime.lastError || !res?.success) { setStatus("✗ Error — check extension", true); return; }
      setStatus(`✓ Sent to ${PROVIDERS.find(p => p.id === provider)?.name || provider}`);
      setTimeout(hidePanel, 1400);
    });
  }

  // ── Status ─────────────────────────────────────────────────
  function setStatus(msg, isError = false) {
    const el = shadow.querySelector("#aicb-status-badge");
    if (!el) return;
    el.textContent = msg;
    el.className   = "status-badge" + (isError ? " error" : "");
    if (!isError) setTimeout(() => { if (el.textContent === msg) el.textContent = "READY"; }, 3000);
  }

  // ── Draggable ──────────────────────────────────────────────
  function makeDraggable(el, handleId = null) {
    const handle = handleId ? (shadow.querySelector("#" + handleId) || el) : el;
    let sx, sy, ox, oy, dragging = false;
    handle.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      dragging = true; sx = e.clientX; sy = e.clientY;
      const r = el.getBoundingClientRect(); ox = r.left; oy = r.top;
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup",   onUp);
    });
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      el.style.left = (ox+dx) + "px"; el.style.top = (oy+dy) + "px";
      el.style.right = "auto"; el.style.bottom = "auto";
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) el.dataset.dragged = "true";
    }
    function onUp() {
      dragging = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    }
  }

  // ── Live settings from popup ───────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "AICB_SETTINGS_UPDATED") {
      const s = msg.settings;
      const sel = shadow?.querySelector("#aicb-provider");
      if (sel && s.defaultProvider) { sel.value = s.defaultProvider; currentProvider = s.defaultProvider; }
      const fab = shadow?.querySelector("#aicb-fab");
      if (fab) fab.style.display = (s.floatingWidget === false) ? "none" : "";
    }
    if (msg.type === "AICB_CUSTOM_PROMPTS_UPDATED") {
      renderCustomPills(msg.customPrompts || []);
    }
  });

  // ── Re-inject if host is removed ──────────────────────────
  function watchForRemoval(host) {
    const parent = host.parentNode;
    if (!parent) return;
    const obs = new MutationObserver(() => {
      if (!document.getElementById("aicb-host")) {
        obs.disconnect();
        window.__AICB_INJECTED__ = false;
        // Small delay so the page finishes its DOM surgery before we re-add
        setTimeout(init, 50);
      }
    });
    obs.observe(parent, { childList: true });
  }

  // ── Run ────────────────────────────────────────────────────
  if (document.body) {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }

})();
