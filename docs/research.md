# Speech-to-Text (Dictation) Browser Extension Research

*Note: While often conflated, converting spoken words into written text is officially known as **Speech-to-Text (STT)** or Automatic Speech Recognition (ASR). Text-to-Speech (TTS) is the reverse (reading text out loud). Based on the project requirements, this document focuses on STT.*

This project implements a dual-engine approach to ensure both broad compatibility and cutting-edge machine learning capabilities, suitable for an AI/ML engineering context.

---

## 1. Core STT Engine Architectures

We evaluated multiple speech recognition engines and settled on a dual-phase architecture, allowing the extension to be lightweight by default while offering a robust, completely offline ML option.

### Option A: The "Baseline" Approach (Web Speech API)
This is the standard native browser implementation, utilizing JavaScript's built-in `SpeechRecognition` API.

*   **How it works:** Hooks directly into the browser's native speech services (often utilizing cloud processing on Chrome).
*   **Pros:** 
    *   **Zero Dependencies:** No heavy machine learning models to download or bundle.
    *   **Highly Performant:** Uses very little CPU/RAM since the browser delegates it to the OS.
*   **Cons:** 
    *   **Privacy:** On Chrome, this often sends the audio stream to Google's servers for processing.
    *   **Browser Support:** Firefox support is currently limited/experimental.

### Option B: The "Edge AI" Approach (Whisper inside the Browser) 🌟 Highly Recommended
This is an advanced ML approach utilizing Hugging Face's `Transformers.js` to run a quantized version of OpenAI's Whisper model (`whisper-tiny.en`) directly inside the Chrome extension using WebAssembly.

*   **How it works:** We utilize a Web Worker in the extension that downloads the ML model to the browser cache. As the user speaks, the extension captures the audio, converts it to a Float32 array, and feeds it directly into the neural network running locally in Chrome.
*   **Pros:** 
    *   **100% Private & Offline:** Audio never leaves the user's computer, showing a deep understanding of Edge AI and inference safety.
    *   **Highly Accurate:** Superior robustness to accents or background noise.
*   **Cons:** 
    *   **Size & Resources:** Model weights (~40MB) must be cached, and inference requires moderate CPU/RAM usage.

**Recommendation:** The extension currently defaults to Option A (Baseline) for rapid testing. We will build out Option B (Edge AI) as a Web Worker service to handle offline, privacy-first transcription.

---

## 2. Text Injection Heuristics (Fixing Google Docs)

Standard DOM manipulation (`element.value = text`) fails on complex Single Page Applications (SPAs).

**Areas of Improvement & Fixes Applied:**
1.  **React/Vue Inputs:** These frameworks override native DOM setters. We resolved this by explicitly calling the native `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set` to bypass React's state wrapper, followed by dispatching synthetic `input` events.
2.  **Google Docs / Canvas Editors:** Google Docs no longer uses standard text nodes; it draws text to a `<canvas>` and intercepts keystrokes via a hidden `.docs-texteventtarget-iframe`. 
    *   *Improvement:* We implemented a `getTargetField()` heuristic that explicitly searches for `.docs-texteventtarget-iframe` if standard `document.activeElement` fails.
    *   *Text Injection:* Instead of `.value`, we synthesize a highly specific `TextEvent` (`textEvent.initTextEvent('textInput', ...)`) and dispatch it directly to the Docs iframe, successfully tricking the Canvas engine into rendering the text.
3.  **UI Positioning in Docs:** Because Docs steals focus, dynamic `focusin` UI positioning fails. 
    *   *Improvement:* We pivoted to a **Persistent Floating Widget**. By injecting the UI with `position: fixed` and `z-index: 2147483647` into the `document.body` (and adding `all_frames: true` to manifest), the dictation UI is now universally accessible on *any* site, including Docs, without relying on fragile focus events.

---

## 3. Audio Frequency Visualization
To show the voice frequencies visually (e.g., a waveform or eq-bar graph) as the user speaks, we use the **Web Audio API**.
*   **Mechanism:** Capture the microphone stream using `navigator.mediaDevices.getUserMedia` -> route through an `AudioContext` -> into an `AnalyserNode`.
*   **Output:** The `AnalyserNode` provides real-time frequency analysis data, rendered onto a `<canvas>` element inside the persistent widget.
