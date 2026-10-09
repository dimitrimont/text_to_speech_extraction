# Problem Resolution & Technical Architecture Log

This document details the primary technical hurdles encountered while building the baseline dictation extension (Option A) and the specific architectural solutions implemented to solve them.

## 1. The Global "Microphone Lock" Conflict
**Problem:** The native `SpeechRecognition` API and `AudioContext` crash or throw `InvalidStateError` when multiple tabs attempt to access the microphone simultaneously. 
**Solution:** Built a cross-tab background Service Worker (`background.js`) to act as a lock controller. When dictation starts in one tab, it broadcasts a `releaseMicrophone` message to all other tabs, forcing them to safely drop their locks before the new tab starts. Additionally, a `visibilitychange` listener stops dictation if the user switches tabs, preventing dormant tabs from holding the lock.

## 2. Text Injection Failures on SPAs (Google Search, React, Vue)
**Problem:** A standard DOM injection (`input.value = "text"`) completely fails on modern Single Page Applications (SPAs) because state managers (like React or Google's custom framework) don't register native DOM changes without the accompanying events.
**Solution:** We built an aggressive 4-stage heuristic injection sequence:
1. Try native `document.execCommand('insertText')` to preserve the undo stack.
2. If it fails, fallback to modifying the `window.HTMLInputElement.prototype.value` setter to bypass React wrappers.
3. For SPAs like Google Search that refuse to acknowledge the text until focus is lost, forcefully dispatch a barrage of synthetic events: `new Event('input')`, `new Event('change')`, and `new KeyboardEvent('keyup')`. This tricks the SPA into instantly fetching the updated value.

## 3. Google Docs Canvas Isolation
**Problem:** Google Docs does not use standard HTML inputs. It renders text on a `<canvas>` element and captures keystrokes via a hidden, cross-origin `<iframe class="docs-texteventtarget-iframe">`.
**Solution:** Modified the `getTargetField` engine to actively search for `iframe.docs-texteventtarget-iframe`. When injecting text, we bypass standard input methods and instead fire a localized `ClipboardEvent('paste')` and `InputEvent('beforeinput')` directly into the iframe's `contentDocument.body`, seamlessly spoofing a user pasting text.

## 4. Enable/Disable UI Desynchronization
**Problem:** Clicking "Disable" in the extension popup did not reliably hide the widget across all frames, and re-enabling it failed to show the widget.
**Solution:** Removed unhandled manual message broadcasts from the popup (which caused `Unchecked runtime.lastError` on blank tabs). Migrated the entire state engine to a `chrome.storage.onChanged` listener inside the content script. This guarantees 100% synchronized, error-free UI updates across all tabs instantly whenever the global switch is toggled. Additionally, we explicitly set `display: flex !important` in JavaScript to override any conflicting site CSS.

## 5. UI Positioning and Interoperability
**Problem:** The widget was initially static. Complex UI elements like emojis were off-putting for professional environments.
**Solution:** Redesigned the UI using a modern glassmorphism aesthetic (SVG icons, backdrop blur, CSS variables). Implemented a robust mouse-drag event handler allowing the widget to be dragged across the screen, and created an auto-positioning logic (`showUI(field)`) that anchors the widget directly beneath the actively focused input field, unless manually repositioned by the user.

## 6. Phase 2 Preparation: Building the Transformers.js ML Engine (Option B)
When we move to build the on-device ML engine using Whisper (`@xenova/transformers`), we must keep the following architectural constraints in mind based on our Phase 1 learnings:

1. **Keep the DOM Injector Intact:** Our 4-stage text injection sequence (`execCommand` -> Prototype fallback -> Synthetic `input/change/keyup` events -> IFrame localized pasting) is pristine. When we swap the Speech API for Whisper, the *only* thing that should change is how we generate the text string. The DOM injection logic (`insertTextAtCursor`) must remain untouched because it perfectly bypasses React/Google Docs security.
2. **Web Worker Memory Limits:** We cannot run Transformers.js inside `content.js` because loading a 40MB+ `.onnx` model on every single tab will crash the browser. The ML pipeline MUST be sequestered inside a background Web Worker (or Offscreen Document) that is spawned once and persists.
3. **Audio Chunk Transfer:** We must extract raw PCM float32 arrays from the microphone in `content.js`, downsample them to 16kHz (Whisper's requirement), and post them via `chrome.runtime.sendMessage` to the Background Worker for inference. 
4. **Bandwidth vs Latency:** Whisper is computationally heavy. We cannot stream 100ms chunks like the native Speech API does for interim results. We will likely need to use a Voice Activity Detector (VAD) to slice the audio on pauses (e.g., every 2-3 seconds) and send full phrases to the background worker to keep CPU usage reasonable.
