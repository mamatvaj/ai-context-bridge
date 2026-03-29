// ============================================================
// AI Context Bridge — ChatGPT Injector
// ============================================================

(function () {
  "use strict";

  const PENDING_KEY  = "pendingPrompt";
  const STALE_MS     = 15000;
  const MAX_ATTEMPTS = 25;

  let attempt = 0;

  function tryInject() {
    chrome.storage.local.get(PENDING_KEY, (res) => {
      const pending = res[PENDING_KEY];
      if (!pending) return;
      if (Date.now() - pending.timestamp > STALE_MS) {
        chrome.storage.local.remove(PENDING_KEY);
        return;
      }
      if (pending.provider !== "chatgpt") return;

      const editor = findEditor();
      if (!editor) {
        attempt++;
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(tryInject, 400 + attempt * 100);
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
      document.querySelector("#prompt-textarea") ||
      document.querySelector("div[contenteditable='true'][id*='prompt']") ||
      document.querySelector("div[contenteditable='true']") ||
      document.querySelector("textarea[placeholder*='Message']")
    );
  }

  function injectText(editor, text) {
    editor.focus();
    const isTextarea = editor.tagName === "TEXTAREA";

    if (isTextarea) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, "value"
      ).set;
      nativeSetter.call(editor, text);
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    } else {
      editor.textContent = "";
      editor.focus();
      document.execCommand("insertText", false, text);
      if (!editor.textContent) {
        editor.textContent = text;
        editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      }
    }

    try {
      const range = document.createRange();
      const sel   = window.getSelection();
      range.selectNodeContents(editor);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  function findSendButton() {
    return (
      document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[aria-label="Send message"]') ||
      document.querySelector('button[aria-label*="Send"]') ||
      (() => {
        const btns = [...document.querySelectorAll("button")];
        return btns.find(
          (b) => !b.disabled &&
                 b.querySelector("svg") &&
                 b.closest("form, [class*='composer'], [class*='input']")
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
  setTimeout(() => observer.disconnect(), 12000);
})();
