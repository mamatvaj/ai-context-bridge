// ============================================================
// AI Context Bridge — Grok (grok.com) Injector
// ============================================================

(function () {
  "use strict";

  const PENDING_KEY  = "pendingPrompt";
  const STALE_MS     = 15000;
  const MAX_ATTEMPTS = 30;

  let attempt = 0;

  function tryInject() {
    chrome.storage.local.get(PENDING_KEY, (res) => {
      const pending = res[PENDING_KEY];
      if (!pending) return;
      if (Date.now() - pending.timestamp > STALE_MS) {
        chrome.storage.local.remove(PENDING_KEY);
        return;
      }
      if (pending.provider !== "grok") return;

      const editor = findEditor();
      if (!editor) {
        attempt++;
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(tryInject, 400 + attempt * 150);
        }
        return;
      }

      const ok = injectText(editor, pending.text);
      if (!ok) {
        attempt++;
        if (attempt < MAX_ATTEMPTS) setTimeout(tryInject, 500);
        return;
      }

      chrome.storage.local.remove(PENDING_KEY);

      if (pending.autoSubmit) {
        setTimeout(() => clickSend(), 900);
      }
    });
  }

  function findEditor() {
    return (
      // Grok uses a textarea or contenteditable depending on version
      document.querySelector("textarea[placeholder*='Ask']") ||
      document.querySelector("textarea[placeholder*='Grok']") ||
      document.querySelector("textarea[data-testid*='input']") ||
      document.querySelector("div[contenteditable='true'][aria-label*='message']") ||
      document.querySelector("div[contenteditable='true'][role='textbox']") ||
      document.querySelector("div[contenteditable='true']") ||
      document.querySelector("textarea")
    );
  }

  function injectText(editor, text) {
    editor.focus();
    const isTextarea = editor.tagName === "TEXTAREA";

    if (isTextarea) {
      // React native setter trick — bypasses React's synthetic event guard
      const proto    = window.HTMLTextAreaElement.prototype;
      const setter   = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(editor, text);
      editor.dispatchEvent(new Event("input",  { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // contenteditable — clear then insert
      document.execCommand("selectAll", false);
      document.execCommand("delete",    false);
      const ok = document.execCommand("insertText", false, text);
      if (!ok || !editor.textContent.trim()) {
        editor.textContent = text;
        editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    }

    return editor.value?.trim().length > 0 || editor.textContent?.trim().length > 0;
  }

  function findSendButton() {
    return (
      document.querySelector('button[aria-label*="Send"]') ||
      document.querySelector('button[aria-label*="send"]') ||
      document.querySelector('button[type="submit"]') ||
      (() => {
        const btns = [...document.querySelectorAll("button")];
        return btns.find(
          (b) => !b.disabled &&
                 b.querySelector("svg") &&
                 b.closest("form, [class*='input'], [class*='composer'], [class*='chat']")
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
      if ((b && !b.disabled) || retries++ > 12) {
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
  setTimeout(() => observer.disconnect(), 15000);
})();
