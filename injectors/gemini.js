// AI Context Bridge — Google Gemini Injector

(function () {
  "use strict";

  const PENDING_KEY  = "pendingPrompt";
  const STALE_MS     = 15000;
  const MAX_ATTEMPTS = 30;

  let attempt    = 0;
  let injected   = false;
  let inProgress = false;
  let gObserver  = null;

  function tryInject() {
    if (injected || inProgress) return;
    inProgress = true;

    chrome.storage.local.get(PENDING_KEY, (res) => {
      if (injected) { inProgress = false; return; }

      const pending = res[PENDING_KEY];
      if (!pending) { inProgress = false; return; }
      if (Date.now() - pending.timestamp > STALE_MS) {
        chrome.storage.local.remove(PENDING_KEY);
        inProgress = false;
        return;
      }
      if (pending.provider !== "gemini") { inProgress = false; return; }

      const editor = findEditor();
      if (!editor) {
        inProgress = false;
        attempt++;
        if (attempt < MAX_ATTEMPTS) setTimeout(tryInject, 500 + attempt * 200);
        return;
      }

      if (gObserver) { gObserver.disconnect(); gObserver = null; }

      injected = true;
      inProgress = false;

      injectText(editor, pending.text);
      chrome.storage.local.remove(PENDING_KEY);

      if (pending.autoSubmit) {
        pollAndSubmit(editor, 6000);
      }
    });
  }

  function findEditor() {
    return (
      document.querySelector("rich-textarea .ql-editor") ||
      document.querySelector("rich-textarea div[contenteditable='true']") ||
      document.querySelector(".ql-editor[contenteditable='true']") ||
      document.querySelector("div[contenteditable='true']")
    );
  }

  function injectText(editor, text) {
    editor.focus();

    // Scope selection to editor contents only (not the whole page)
    try {
      const range = document.createRange();
      range.selectNodeContents(editor);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch(_) {}

    document.execCommand("delete", false);
    document.execCommand("insertText", false, text);

    if (editor.textContent.trim().length < 5) {
      editor.innerText = text;
    }

    // Fire input events on BOTH the .ql-editor AND the rich-textarea host
    // Angular's component model binds to the host, Quill binds to the inner div
    const host = document.querySelector("rich-textarea") || editor.parentElement;
    [editor, host].filter(Boolean).forEach(el => {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    });
  }

  // ── Send button finder ────────────────────────────────────
  // Gemini's send button has NO stable data-test-id or aria-label in the chat UI.
  // It IS inside the bottom input container and has .disabled as a property.
  // Strategy: find all buttons in the input area, pick the one that is enabled.
  function findSendButton() {
    // Walk up from the editor to find the input container
    const editor = findEditor();
    if (!editor) return null;

    // Go up ~5 levels to find the input area wrapper
    let container = editor;
    for (let i = 0; i < 8; i++) {
      container = container.parentElement;
      if (!container) break;
      // Look for any non-disabled button with an icon inside this container
      const btns = [...container.querySelectorAll("button")];
      const sendBtn = btns.find(b => {
        // Skip buttons we know are NOT the send button
        if (b.closest(".input-pills, .toolbar, [class*='option'], [class*='menu']")) return false;
        // Must be enabled (Angular sets the .disabled PROPERTY, not just the attribute)
        if (b.disabled) return false;
        // Must have an icon (send button always has a mat-icon or svg)
        if (!b.querySelector("mat-icon, svg")) return false;
        // Must not be a formatting/attachment button (they usually have specific icons)
        const label = (b.getAttribute("aria-label") || "").toLowerCase();
        if (label && !label.includes("send")) return false;
        return true;
      });
      if (sendBtn) return sendBtn;
    }

    // Absolute fallback: any button in the page with aria-label containing "send"
    return [...document.querySelectorAll("button")]
      .find(b => !b.disabled &&
                 (b.getAttribute("aria-label") || "").toLowerCase().includes("send"));
  }

  function pollAndSubmit(editor, budgetMs) {
    const start = Date.now();
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;

      // Strategy 1: find and click the enabled send button
      const btn = findSendButton();
      if (btn && !btn.disabled) {
        clearInterval(iv);
        btn.click();
        return;
      }

      // Strategy 2: after 2s, also try Enter key on the host element
      if (elapsed > 2000 && elapsed < 2200) {
        const host = document.querySelector("rich-textarea") || editor;
        editor.focus();
        host.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter", code: "Enter", keyCode: 13, which: 13,
          bubbles: true, composed: true, cancelable: true,
        }));
      }

      if (elapsed > budgetMs) clearInterval(iv);
    }, 150);
  }

  // ── Boot ─────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInject);
  } else {
    tryInject();
  }

  let debounceTimer = null;
  gObserver = new MutationObserver(() => {
    if (injected || inProgress) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tryInject, 300);
  });
  gObserver.observe(document.body, { childList: true, subtree: false });
  setTimeout(() => { if (gObserver) { gObserver.disconnect(); gObserver = null; } }, 15000);
})();
