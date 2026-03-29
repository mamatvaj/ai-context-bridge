// AI Context Bridge — Popup (real-time, custom prompts)

const MAX_CUSTOM_PROMPTS = 10;
const MAX_PROMPT_NAME    = 40;
const MAX_PROMPT_BODY    = 500;

const PROVIDERS = [
  { id:"claude",  name:"Claude",  color:"#c96a2a", icon:`<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" fill="#c96a2a" opacity="0.2"/><path d="M12 2L4 7v10l8 5 8-5V7L12 2z" stroke="#c96a2a" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.5" fill="#c96a2a"/></svg>` },
  { id:"chatgpt", name:"ChatGPT", color:"#10a37f", icon:`<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><circle cx="12" cy="12" r="9" fill="#10a37f" opacity="0.15" stroke="#10a37f" stroke-width="1.5"/><path d="M9 12h6M12 9v6" stroke="#10a37f" stroke-width="1.8" stroke-linecap="round"/></svg>` },
  { id:"grok",    name:"Grok",    color:"#d1d5db", icon:`<svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M13 3L5 14h7l-1 7 8-12h-7l1-6z" fill="#d1d5db" opacity="0.2" stroke="#d1d5db" stroke-width="1.5" stroke-linejoin="round"/></svg>` },
];

const DEFAULT_SETTINGS = {
  defaultProvider: "claude", floatingWidget: true,
  selectionTooltip: true, autoSubmit: false,
};

let selectedProvider = "claude";
let customPrompts    = [];
let editingId        = null; // null = new, string = editing existing
let toastTimer       = null;

// ── Init ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  buildProviderGrid();
  loadAll();
  wireToggles();
  wireAddPromptView();
  wireHelpButton();
});

function wireHelpButton() {
  const btn = document.getElementById("btn-help");
  if (!btn) return;
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "rgba(255,255,255,0.12)";
    btn.style.color = "rgba(255,255,255,0.9)";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "rgba(255,255,255,0.06)";
    btn.style.color = "rgba(255,255,255,0.5)";
  });
  btn.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("Help_Guide.html") });
  });
}

function loadAll() {
  chrome.storage.local.get(["settings", "customPrompts"], (res) => {
    const s = { ...DEFAULT_SETTINGS, ...(res.settings ?? {}) };
    selectedProvider = s.defaultProvider;
    customPrompts    = res.customPrompts ?? [];
    syncProviderGrid();
    document.getElementById("toggle-widget").checked     = s.floatingWidget;
    document.getElementById("toggle-tooltip").checked    = s.selectionTooltip;
    document.getElementById("toggle-autosubmit").checked = s.autoSubmit;
    renderCustomChips();
    updateAddBtn();
  });
}

// ── Provider grid ───────────────────────────────────────────
function buildProviderGrid() {
  const grid = document.getElementById("provider-grid");
  grid.innerHTML = PROVIDERS.map(p => `
    <div class="provider-card" data-provider="${p.id}">
      <div class="provider-icon-svg" style="background:${p.color}18;">${p.icon}</div>
      <span class="provider-name">${p.name}</span>
      <div class="provider-check"></div>
    </div>`).join("");

  grid.querySelectorAll(".provider-card").forEach(card => {
    card.addEventListener("click", () => {
      selectedProvider = card.dataset.provider;
      syncProviderGrid();
      saveSettings();
    });
  });
}

function syncProviderGrid() {
  document.querySelectorAll(".provider-card").forEach(c =>
    c.classList.toggle("selected", c.dataset.provider === selectedProvider)
  );
}

// ── Toggles ─────────────────────────────────────────────────
function wireToggles() {
  ["toggle-widget","toggle-tooltip","toggle-autosubmit"].forEach(id =>
    document.getElementById(id).addEventListener("change", saveSettings)
  );
}

// ── Save settings ───────────────────────────────────────────
function saveSettings() {
  const settings = {
    defaultProvider:  selectedProvider,
    floatingWidget:   document.getElementById("toggle-widget").checked,
    selectionTooltip: document.getElementById("toggle-tooltip").checked,
    autoSubmit:       document.getElementById("toggle-autosubmit").checked,
  };
  chrome.storage.local.set({ settings }, () => {
    showToast("Saved");
    chrome.tabs.query({}, tabs => tabs.forEach(tab =>
      chrome.tabs.sendMessage(tab.id, { type: "AICB_SETTINGS_UPDATED", settings }).catch(() => {})
    ));
  });
}

// ── Custom prompts render ────────────────────────────────────
function renderCustomChips() {
  const container = document.getElementById("custom-chips");
  if (!customPrompts.length) { container.innerHTML = ""; return; }

  container.innerHTML = customPrompts.map(p => `
    <div class="custom-chip" data-id="${p.id}" title="${escHtml(p.prompt)}">
      <span class="custom-chip-name">${escHtml(p.name)}</span>
      <button class="custom-chip-del" data-del="${p.id}" title="Remove">
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>`).join("");

  // Delete buttons
  container.querySelectorAll(".custom-chip-del").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCustomPrompt(btn.dataset.del);
    });
  });
}

function updateAddBtn() {
  const btn = document.getElementById("btn-add-prompt");
  btn.disabled = customPrompts.length >= MAX_CUSTOM_PROMPTS;
  btn.title    = btn.disabled
    ? `Maximum ${MAX_CUSTOM_PROMPTS} custom prompts reached`
    : "Add custom prompt";
}

function deleteCustomPrompt(id) {
  customPrompts = customPrompts.filter(p => p.id !== id);
  saveCustomPrompts();
}

function saveCustomPrompts() {
  chrome.storage.local.set({ customPrompts }, () => {
    renderCustomChips();
    updateAddBtn();
    showToast("Saved");
    // Notify content scripts so widget refreshes
    chrome.tabs.query({}, tabs => tabs.forEach(tab =>
      chrome.tabs.sendMessage(tab.id, {
        type: "AICB_CUSTOM_PROMPTS_UPDATED", customPrompts,
      }).catch(() => {})
    ));
  });
}

// ── Add Prompt view ──────────────────────────────────────────
function wireAddPromptView() {
  const btnAdd    = document.getElementById("btn-add-prompt");
  const btnBack   = document.getElementById("btn-back");
  const btnCancel = document.getElementById("btn-cancel-prompt");
  const btnSave   = document.getElementById("btn-save-prompt");
  const nameInput = document.getElementById("prompt-name");
  const bodyInput = document.getElementById("prompt-body");
  const nameCount = document.getElementById("name-count");
  const bodyCount = document.getElementById("body-count");

  btnAdd.addEventListener("click", () => {
    if (customPrompts.length >= MAX_CUSTOM_PROMPTS) return;
    editingId = null;
    nameInput.value = "";
    bodyInput.value = "";
    updateCounts();
    document.getElementById("add-prompt-title").textContent = "New Prompt Template";
    showView("add");
  });

  btnBack.addEventListener("click", () => showView("main"));
  btnCancel.addEventListener("click", () => showView("main"));

  // Char counters
  nameInput.addEventListener("input", updateCounts);
  bodyInput.addEventListener("input", updateCounts);

  function updateCounts() {
    const nl = nameInput.value.length;
    const bl = bodyInput.value.length;
    nameCount.textContent = `${nl} / ${MAX_PROMPT_NAME}`;
    nameCount.className   = `char-count${nl > MAX_PROMPT_NAME * 0.85 ? nl >= MAX_PROMPT_NAME ? " over" : " warn" : ""}`;
    bodyCount.textContent = `${bl} / ${MAX_PROMPT_BODY}`;
    bodyCount.className   = `char-count${bl > MAX_PROMPT_BODY * 0.85 ? bl >= MAX_PROMPT_BODY ? " over" : " warn" : ""}`;
    btnSave.disabled = !nameInput.value.trim() || !bodyInput.value.trim();
  }

  btnSave.addEventListener("click", () => {
    const name   = nameInput.value.trim().slice(0, MAX_PROMPT_NAME);
    const prompt = bodyInput.value.trim().slice(0, MAX_PROMPT_BODY);
    if (!name || !prompt) return;

    if (editingId) {
      // Edit existing
      const idx = customPrompts.findIndex(p => p.id === editingId);
      if (idx !== -1) { customPrompts[idx].name = name; customPrompts[idx].prompt = prompt; }
    } else {
      // New
      customPrompts.push({ id: `cp_${Date.now()}`, name, prompt });
    }

    saveCustomPrompts();
    showView("main");
  });
}

function showView(which) {
  document.getElementById("view-main").classList.toggle("hidden", which !== "main");
  document.getElementById("view-add-prompt").classList.toggle("hidden", which !== "add");
}

// ── Toast ───────────────────────────────────────────────────
function showToast(msg = "Saved") {
  const toast = document.getElementById("toast");
  toast.querySelector("svg + *") ? null : null; // noop
  toast.childNodes[toast.childNodes.length - 1].textContent = " " + msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}

// ── Util ────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
