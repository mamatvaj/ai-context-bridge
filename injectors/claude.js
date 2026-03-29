// ============================================================
// AI Context Bridge — Claude.ai Injector
// ============================================================

(function () {
  "use strict";

  const PENDING_KEY  = "pendingPrompt";
  const STALE_MS     = 15000;
  const MAX_ATTEMPTS = 20;
  const BASE_DELAY   = 400;

  let attempt = 0;

  function tryInject() {
    chrome.storage.local.get(PENDING_KEY, (res) => {
      const pending = res[PENDING_KEY];
      if (!pending) return;
      if (Date.now() - pending.timestamp > STALE_MS) {
        chrome.storage.local.remove(PENDING_KEY);
        return;
      }
      if (pending.provider !== "claude") return;

      const editor = findEditor();
      if (!editor) {
        attempt++;
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(tryInject, BASE_DELAY + attempt * 150);
        }
        return;
      }

      injectText(editor, pending.text);
      chrome.storage.local.remove(PENDING_KEY);

      if (pending.autoSubmit) {
        setTimeout(() => clickSend(), 900);
      }
    });
  }

  function findEditor() {
    return (
      document.querySelector("div[contenteditable='true'].ProseMirror") ||
      document.querySelector("div[contenteditable='true'][data-placeholder]") ||
      document.querySelector("div[contenteditable='true']")
    );
  }

  function injectText(editor, text) {
    editor.focus();
    const result = document.execCommand("insertText", false, text);
    if (!result) {
      editor.textContent = text;
      editor.dispatchEvent(new Event("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const range = document.createRange();
    const sel   = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function findSendButton() {
    return (
      document.querySelector('button[aria-label="Send Message"]') ||
      document.querySelector('button[aria-label*="Send"]') ||
      document.querySelector('button[data-testid*="send"]') ||
      (() => {
        const btns = [...document.querySelectorAll("button")];
        return btns.find(
          (b) => !b.disabled &&
                 b.querySelector("svg") &&
                 b.closest('[class*="composer"], [class*="input"], form, footer')
        );
      })()
    );
  }

  function clickSend() {
    const btn = findSendButton();
    if (btn && !btn.disabled) { btn.click(); return; }
    let retries = 0;
    const iv = setInterval(() => {
      const b = findSendButton();
      if ((b && !b.disabled) || retries++ > 10) {
        clearInterval(iv);
        if (b && !b.disabled) b.click();
      }
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInject);
  } else {
    tryInject();
  }

  const observer = new MutationObserver(() => { attempt = 0; tryInject(); });
  observer.observe(document.body, { childList: true, subtree: false });
  setTimeout(() => observer.disconnect(), 10000);
})();
