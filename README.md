# ⚡ AI Context Bridge

> Send selected text or full-page content directly into Claude, ChatGPT, and Grok — no API keys, no copy-paste, no friction.

**Version:** 1.20 · **Updated:** 29.03.2026  
**Author:** [Mamatva](https://techwithmamatva.blogspot.com/) · [techwithmamatva.blogspot.com](https://techwithmamatva.blogspot.com/)

<img width="2224" height="1920" alt="Gemini_Generated_Image_lpq6x9lpq6x9lpq6" src="https://github.com/user-attachments/assets/c5102a49-9582-4791-b2d3-5123780a9765" />


---

## What It Does

AI Context Bridge is a Chrome extension that acts as a one-click bridge between any webpage and your favourite AI assistant. Highlight text on any page, click a button, and the extension opens your chosen AI platform in a new tab with your prompt already typed in — ready to send.

No API keys. No accounts to link. No billing. Works with the free tier of every supported platform.

---

## Supported Platforms

| Platform | URL | Account Required |
|---|---|---|
| 🟠 **Claude** | claude.ai | Free Anthropic account |
| 🟢 **ChatGPT** | chatgpt.com | Free OpenAI account |
| ⚡ **Grok** | grok.com | X/Twitter account |

> ⚠️ **Gemini and Meta AI are temporarily hidden from the UI** due to injection instability after recent platform UI changes. Their injector code (`injectors/gemini.js`, `injectors/meta.js`) is preserved and can be re-enabled once selectors are updated.

---

## Features

### 🪄 Floating Widget
A draggable panel that lives on every webpage. Click the circular FAB button in the bottom-right corner to open it, or it appears automatically when you highlight text and click "More…" in the tooltip.

- **Full Page / Selected Text toggle** — switch between sending highlighted text or the entire page's content
- **Live preview** — shows the first 200 characters of what will be sent
- **Per-action platform override** — change the target platform for this specific action without changing your default
- **My Prompts section** — quick-access pills for all your saved custom prompt templates

### 💬 Selection Tooltip
Highlight any text → a compact action bar appears above the selection. Click **💡 Explain**, **📝 Summarize**, or **⚡ More…** without opening the full panel. Can be disabled from settings.

### 🖱️ Right-Click Context Menu
Right-click on selected text → **AI Context Bridge** submenu → choose an action. Built-in actions and all custom prompt templates appear here. Always uses the default AI platform.

### 🔧 Built-in Actions

| Action | Prompt sent to AI |
|---|---|
| 💡 **Explain** | "Please explain the following [text] clearly and concisely:" + text |
| 📝 **Summarize** | "Please simplify and summarize the following [text]:" + text |
| ✏️ **Custom Ask** | Your own instruction + text (widget) or raw text (right-click) |

### ✨ Custom Prompt Templates
Create up to **10 reusable prompt templates** that appear in the widget, tooltip, and right-click menu.

- Template name: up to 40 characters (emoji supported)
- Prompt body: up to 500 characters
- Selected text is automatically appended after the prompt
- Manage from the extension popup → Prompt Templates → **+** button

### 📄 Full Page Mode
Captures `document.body.innerText` of the current page (up to 50,000 characters) instead of a text selection. Enable via the segmented toggle in the floating widget.

### 🚀 Auto-Submit
When enabled, the extension automatically clicks the Send button after injecting the prompt — the AI starts responding immediately. Disabled by default. Enable from Settings → Behaviour.

---

## Installation

This extension is distributed as a ZIP file and must be loaded in Chrome's Developer Mode.

### Step-by-step

1. **Download** `ai-context-bridge.zip` and **unzip** it to a permanent folder  
   (e.g. `C:\Extensions\ai-context-bridge\` — do **not** delete this folder after installing)

2. Open Chrome and go to `chrome://extensions`

3. Toggle **Developer Mode** on (top-right switch)

4. Click **Load unpacked** and select the `ai-context-bridge` folder  
   (the one containing `manifest.json`)

5. **Pin the extension**: click the 🧩 puzzle-piece icon in the toolbar → find "AI Context Bridge" → click the pin icon

6. Open any webpage — you should see the teal FAB button in the bottom-right corner ✅

> ⚠️ **Keep the folder.** Chrome loads the extension directly from the unzipped folder. Moving or deleting it will break the extension.

---

## Usage Guide

### Basic workflow

```
1. Go to any webpage (article, doc, Wikipedia, etc.)
2. Select text with your mouse
3. Click "💡 Explain" in the tooltip that appears
4. AI platform opens in a new tab with prompt pre-filled
5. Press Send → get your answer
```

### Change default AI platform
```
1. Click the extension icon (toolbar)
2. Click any platform card in "Default AI Platform"
3. Saved instantly — no Save button needed
```

### Create a custom prompt
```
1. Click the extension icon
2. Scroll to "Prompt Templates" → click the green + button
3. Enter a name (e.g. "🌐 Translate to Hindi")
4. Enter the prompt (e.g. "Translate the following to Hindi:")
5. Click Save Template
6. It appears instantly in the widget, tooltip, and right-click menu
```

### Use Full Page Mode
```
1. Open the floating widget (click FAB or select text → More…)
2. Click "Full Page" in the toggle at the top of the panel
3. Choose an action (Explain / Summarize / Custom Ask)
```

---

## Settings Reference

| Setting | Default | Description |
|---|---|---|
| **Default AI Platform** | Claude | Platform used by right-click menu and widget default |
| **Floating Widget** | ON | Show/hide the FAB button and panel |
| **Selection Tooltip** | ON | Show/hide the mini action bar on text selection |
| **Auto-Submit** | OFF | Automatically click Send after injecting |

All settings save instantly. Changes apply live to all open tabs.

---

## Project Structure

```
ai-context-bridge/
├── manifest.json          # MV3 extension manifest
├── background.js          # Service worker — context menus, message bus, tab management
├── content.js             # Floating widget (Shadow DOM), selection detection, tooltip
├── widget.css             # (legacy, styles now inlined in Shadow DOM)
├── popup/
│   ├── popup.html         # Extension popup UI
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic — settings, custom prompt management
└── injectors/
    ├── claude.js          # claude.ai text injection (ProseMirror)
    ├── chatgpt.js         # chatgpt.com injection (React controlled input)
    ├── gemini.js          # gemini.google.com injection (Quill + Angular) — code preserved, hidden from UI
    ├── meta.js            # meta.ai injection (React input/textarea) — code preserved, hidden from UI
    └── grok.js            # grok.com injection (textarea / contenteditable)
```

---

## Technical Notes

### How injection works
The extension does **not** use any AI API. When you trigger an action:
1. The prompt is stored in `chrome.storage.local` with a 15-second TTL
2. A new tab opens at the target AI platform's URL
3. A platform-specific content script (`injectors/*.js`) polls the DOM until the editor is ready
4. The script injects the prompt text using the appropriate method for that platform's editor framework
5. If Auto-Submit is enabled, the script finds and clicks the Send button

### Platform-specific injection methods
| Platform | Editor | Injection method |
|---|---|---|
| Claude | ProseMirror (contenteditable) | `execCommand("insertText")` |
| ChatGPT | React controlled contenteditable | Native prototype setter + input event |
| Grok | Textarea / contenteditable | Native setter or execCommand depending on current UI |

> Gemini and Meta AI injectors exist in code (`injectors/gemini.js`, `injectors/meta.js`) but are not exposed in the UI. See Known Limitations.

### Shadow DOM isolation
The floating widget is attached to a zero-size Shadow DOM host. This means:
- The widget's CSS cannot be overridden or broken by any page's stylesheet
- The widget cannot accidentally interfere with the host page's CSS
- Works correctly even on pages with aggressive CSS resets

### Data storage
All data is stored locally in `chrome.storage.local`:
- `settings` — user preferences (default platform, toggles)
- `customPrompts` — array of `{id, name, prompt}` objects
- `pendingPrompt` — temporary storage of the active prompt (cleared after injection)

No data is sent to any server. No analytics. No tracking.

---

## Permissions

| Permission | Why it's needed |
|---|---|
| `storage` | Save settings and custom prompts locally |
| `tabs` | Open new tabs at AI platform URLs |
| `activeTab` | Access the current page for text capture |
| `scripting` | Inject content scripts on AI platform pages |
| `contextMenus` | Add "AI Context Bridge" to the right-click menu |
| `<all_urls>` | Run the floating widget on all websites |

---

## Troubleshooting

**FAB not visible** → Open popup → check Floating Widget is ON → refresh page

**Text not injecting** → Make sure you're logged in to the AI platform → wait 3–5s after tab opens → try disabling Auto-Submit


**Right-click menu not updated** → Wait 2–3 seconds, right-click again → or reload extension at `chrome://extensions`


---

## Known Limitations

- AI platforms may update their UI and break injection. Check the blog for extension updates.
- Auto-Submit relies on the platform's Send button being enabled within 6 seconds of injection.
- Full Page Mode captures visible text only — dynamically loaded content that hasn't rendered may not be captured.
- Maximum 50,000 characters for Full Page Mode to avoid platform input limits.

---

## Changelog

### v1.20 — 29.03.2026
- **Help Guide link added to popup** — `?` button in popup header opens `Help_Guide.html` in a new tab via `chrome.runtime.getURL()`
- `Help_Guide.html` bundled inside the extension and registered in `web_accessible_resources` in `manifest.json`
- Version bumped to v1.20 across popup, widget footer, and manifest

### v1.0.1 — 29.03.2026
- **Gemini and Meta AI removed from UI** — both platforms hidden from provider grid (popup) and floating widget platform selector due to ongoing injection instability after platform UI changes
- Injector code (`injectors/gemini.js`, `injectors/meta.js`) preserved intact — no functional code deleted
- `AI_PLATFORMS` routing table in `background.js` unchanged — re-enabling requires only adding entries back to `PROVIDERS[]` in `popup.js` and `content.js`

### v1.0.0 — 22.04.2025
- Initial release
- Shadow DOM widget with full CSS isolation
- 5 platform support: Claude, ChatGPT, Gemini, Meta AI, Grok
- Custom prompt templates (max 10)
- Full Page Mode
- Auto-Submit
- Real-time settings (no Save button)
- Right-click context menu with custom prompts
- Compact, polished UI with segmented toggle

---

## Author

**Mamatva**  
📝 Blog: [techwithmamatva.blogspot.com](https://techwithmamatva.blogspot.com/)

---

*AI Context Bridge is a personal project. It is not affiliated with Anthropic, OpenAI, Google, Meta, or X Corp.*
