// ============================================================
// AI Context Bridge — Background Service Worker
// ============================================================

const AI_PLATFORMS = {
  claude:  { name: "Claude",  url: "https://claude.ai/new"         },
  chatgpt: { name: "ChatGPT", url: "https://chatgpt.com/"           },
  gemini:  { name: "Gemini",  url: "https://gemini.google.com/app"  },
  meta:    { name: "Meta AI", url: "https://www.meta.ai/"           },
  grok:    { name: "Grok",    url: "https://grok.com/"              },
};

// ── Build context menu (built-ins + custom prompts) ─────────
async function buildContextMenu() {
  return new Promise(resolve => {
    chrome.contextMenus.removeAll(async () => {
      // Root
      chrome.contextMenus.create({
        id: "aicb-root", title: "AI Context Bridge", contexts: ["selection"],
      });

      // Built-in actions
      const builtins = [
        { id: "aicb-explain",   title: "💡 Explain This" },
        { id: "aicb-summarize", title: "📝 Summarize"    },
        { id: "aicb-custom",    title: "✏️ Custom Ask…"  },
      ];
      builtins.forEach(a => chrome.contextMenus.create({
        id: a.id, parentId: "aicb-root", title: a.title, contexts: ["selection"],
      }));

      // Separator + custom prompts
      const { customPrompts } = await chrome.storage.local.get("customPrompts");
      const prompts = customPrompts || [];
      if (prompts.length > 0) {
        chrome.contextMenus.create({
          id: "aicb-sep", parentId: "aicb-root", type: "separator", contexts: ["selection"],
        });
        prompts.forEach(p => {
          chrome.contextMenus.create({
            id: `aicb-cp-${p.id}`,
            parentId: "aicb-root",
            title: p.name,
            contexts: ["selection"],
          });
        });
      }

      resolve();
    });
  });
}

// ── Install / startup ───────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await buildContextMenu();

  chrome.storage.local.get("settings", (res) => {
    if (!res.settings) {
      chrome.storage.local.set({
        settings: {
          defaultProvider:  "claude",
          floatingWidget:   true,
          selectionTooltip: true,
          autoSubmit:       false,
        },
      });
    }
  });

  chrome.storage.local.get("customPrompts", (res) => {
    if (!res.customPrompts) chrome.storage.local.set({ customPrompts: [] });
  });
});

// ── Rebuild menu when custom prompts change ─────────────────
chrome.storage.onChanged.addListener((changes) => {
  if (changes.customPrompts) buildContextMenu();
});

// ── Context menu click handler ──────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info) => {
  const id  = info.menuItemId;
  const sel = info.selectionText || "";

  const { settings, customPrompts } = await chrome.storage.local.get(["settings", "customPrompts"]);
  const provider = settings?.defaultProvider || "claude";

  // Built-in actions
  const builtinMap = {
    "aicb-explain":   () => buildPrompt("explain",   sel),
    "aicb-summarize": () => buildPrompt("summarize", sel),
    "aicb-custom":    () => sel,
  };
  if (builtinMap[id]) {
    await storeAndOpen(builtinMap[id](), provider);
    return;
  }

  // Custom prompts
  if (id.startsWith("aicb-cp-")) {
    const cpId = id.replace("aicb-cp-", "");
    const cp   = (customPrompts || []).find(p => p.id === cpId);
    if (cp) {
      const prompt = `${cp.prompt}\n\n${sel}`;
      await storeAndOpen(prompt, provider);
    }
  }
});

// ── Message handler ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "AICB_SEND") {
    const { action, text, provider, isFullPage, customPromptId } = msg;
    let prompt;

    if (customPromptId) {
      // Execute a saved custom prompt template
      chrome.storage.local.get("customPrompts", (res) => {
        const cp = (res.customPrompts || []).find(p => p.id === customPromptId);
        const finalPrompt = cp ? `${cp.prompt}\n\n${text}` : text;
        storeAndOpen(finalPrompt, provider)
          .then(() => sendResponse({ success: true }))
          .catch(() => sendResponse({ success: false }));
      });
    } else {
      prompt = buildPrompt(action, text, isFullPage);
      storeAndOpen(prompt, provider)
        .then(() => sendResponse({ success: true }))
        .catch(() => sendResponse({ success: false }));
    }

    return true; // async
  }

  if (msg.type === "AICB_REBUILD_MENU") {
    buildContextMenu().then(() => sendResponse({ success: true }));
    return true;
  }
});

// ── Helpers ─────────────────────────────────────────────────
function buildPrompt(action, text, isFullPage = false) {
  const context = isFullPage ? "full page content" : "selected text";
  const templates = {
    explain:   `Please explain the following ${context} clearly and concisely:\n\n${text}`,
    summarize: `Please simplify and summarize the following ${context}:\n\n${text}`,
    custom:    text,
  };
  return templates[action] || text;
}

async function storeAndOpen(prompt, provider) {
  const platform = AI_PLATFORMS[provider];
  if (!platform) return;

  const { settings } = await chrome.storage.local.get("settings");
  const autoSubmit = settings?.autoSubmit ?? false;

  await chrome.storage.local.set({
    pendingPrompt: { text: prompt, provider, autoSubmit, timestamp: Date.now() },
  });

  chrome.tabs.create({ url: platform.url });
}
