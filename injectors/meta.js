// AI Context Bridge — Meta AI Injector
// Meta AI uses <input> on home page and <textarea> in conversation —
// NOT contenteditable. Source: HAR analysis of actual DOM telemetry.

(function () {
  "use strict";

  const PENDING_KEY  = "pendingPrompt";
  const STALE_MS     = 15000;
  const MAX_ATTEMPTS = 30;

  let attempt    = 0;
  let injected   = false;
  let inProgress = false;   // synchronous guard — blocks concurrent async calls
  let observer   = null;

  function tryInject() {
    // Both guards must be checked SYNCHRONOUSLY before any async work
    if (injected || inProgress) return;
    inProgress = true;                    // block all subsequent calls immediately

    chrome.storage.local.get(PENDING_KEY, (res) => {
      // Re-check after async gap (another call may have completed while we waited)
      if (injected) { inProgress = false; return; }

      const pending = res[PENDING_KEY];
      if (!pending) { inProgress = false; return; }
      if (Date.now() - pending.timestamp > STALE_MS) {
        chrome.storage.local.remove(PENDING_KEY);
        inProgress = false;
        return;
      }
      if (pending.provider !== "meta") { inProgress = false; return; }

      const field = findInputField();
      if (!field) {
        inProgress = false;
        attempt++;
        if (attempt < MAX_ATTEMPTS) setTimeout(tryInject, 600 + attempt * 200);
        return;
      }

      // Kill observer NOW — before injecting — so React re-renders don't retrigger
      if (observer) { observer.disconnect(); observer = null; }

      injected = true;   // set before inject so nothing else can race
      inProgress = false;

      const holdIv = injectValue(field, pending.text);
      chrome.storage.local.remove(PENDING_KEY);

      if (pending.autoSubmit) {
        setTimeout(() => {
          clearInterval(holdIv); // stop holding so submit can clear the field cleanly
          submitForm(field);
        }, 800);
      }
    });
  }

  // ── Find the input field ──────────────────────────────────
  // Meta AI home: <input class="text-subheadline ...">
  // Meta AI conversation: <textarea class="... resize-none ...">
  function findInputField() {
    return (
      // Conversation textarea (most specific)
      document.querySelector("textarea.text-subheadline") ||
      document.querySelector("textarea[class*='resize-none']") ||
      document.querySelector("textarea[placeholder]") ||
      // Home page input
      document.querySelector("input.text-subheadline") ||
      document.querySelector("input[class*='text-subheadline']") ||
      document.querySelector("input[placeholder*='Ask']") ||
      document.querySelector("input[placeholder*='Message']") ||
      document.querySelector("input[placeholder*='meta']") ||
      document.querySelector("input[type='text'][class*='bg-transparent']") ||
      // Generic fallback
      document.querySelector("input[type='text']")
    );
  }

  // ── Inject value using React's native setter ──────────────
  function injectValue(field, text) {
    field.focus();

    const isTextarea = field.tagName === "TEXTAREA";
    const proto      = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter     = Object.getOwnPropertyDescriptor(proto, "value").set;

    function applyValue() {
      setter.call(field, text);
      field.dispatchEvent(new Event("input",  { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }

    applyValue();

    // React's reconciler runs AFTER our event and may reset the value to ""
    // (controlled input re-render). We watch for that and restore exactly once,
    // giving React time to commit our state update instead of fighting it.
    let holdCount = 0;
    const MAX_HOLDS = 20;  // hold for up to 2 seconds (20 × 100ms)
    const holdIv = setInterval(() => {
      if (holdCount++ >= MAX_HOLDS) {
        clearInterval(holdIv);
        return;
      }
      // If React wiped our value, re-apply
      if (field.value.trim().length === 0) {
        applyValue();
      } else {
        // Value is stable — stop watching
        clearInterval(holdIv);
      }
    }, 100);

    return holdIv; // caller can cancel if needed
  }

  // ── Submit ────────────────────────────────────────────────
  function submitForm(field) {
    field.focus();

    // Strategy 1: Enter keydown — Meta handles submit via keydown listener on input
    field.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, composed: true, cancelable: true,
    }));
    field.dispatchEvent(new KeyboardEvent("keyup", {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, composed: true,
    }));

    // Strategy 2: If the field still has text after 500ms,
    // find the send button by walking up from the input
    setTimeout(() => {
      const currentVal = field.value || field.textContent;
      if (!currentVal || currentVal.trim().length === 0) return; // already sent

      // Walk up from input to find a parent with a send button
      let el = field;
      for (let i = 0; i < 10; i++) {
        el = el.parentElement;
        if (!el) break;
        const btns = [...el.querySelectorAll("button")];
        const sendBtn = btns.find(b => {
          if (b.disabled) return false;
          const label = (b.getAttribute("aria-label") || "").toLowerCase();
          const title = (b.getAttribute("title") || "").toLowerCase();
          return label.includes("send") || title.includes("send") ||
                 b.querySelector("svg[data-icon*='send'], svg[class*='send']");
        });
        if (sendBtn) { sendBtn.click(); return; }
      }

      // Global fallback
      const globalBtn = [...document.querySelectorAll("button")]
        .find(b => !b.disabled &&
                   (b.getAttribute("aria-label") || "").toLowerCase().includes("send"));
      if (globalBtn) globalBtn.click();
    }, 500);
  }

  // ── Boot ─────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", tryInject);
  } else {
    tryInject();
  }

  // Watch for the input field to appear (SPA navigation)
  // CRITICAL: childList only (NOT subtree:true) — subtree fires on every React
  // re-render causing hundreds of concurrent tryInject() calls.
  // We debounce with a 300ms timer so rapid DOM changes only trigger once.
  let debounceTimer = null;
  observer = new MutationObserver(() => {
    if (injected || inProgress) return;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(tryInject, 300);
  });
  observer.observe(document.body, { childList: true, subtree: false });
  setTimeout(() => { if (observer) { observer.disconnect(); observer = null; } }, 15000);
})();
