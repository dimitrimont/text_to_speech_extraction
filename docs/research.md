# Speech-to-Text (Dictation) Browser Extension Research

*Note: While often conflated, converting spoken words into written text is officially known as **Speech-to-Text (STT)** or Automatic Speech Recognition (ASR). Text-to-Speech (TTS) is the reverse (reading text out loud). Based on the project requirements (taking speech and putting it into a text box), this document focuses on STT.*

## 1. Core STT Engine Options (Free & Open Source)

To build a browser extension that handles dictation, we have a few primary avenues for the underlying speech recognition engine.

### Option A: Web Speech API (Native Browser Implementation)
Most modern browsers (Chrome, Safari, Edge) have built-in speech recognition capabilities accessible via JavaScript.
*   **Pros:** 
    *   **Zero Dependencies:** No heavy machine learning models to download or bundle.
    *   **Completely Free:** Handled natively by the browser.
    *   **Highly Performant:** Uses very little CPU/RAM since the browser delegates it to the OS or its own optimized cloud services.
*   **Cons:** 
    *   **Privacy:** On Chrome, this often sends the audio stream to Google's servers for processing if offline dictation isn't enabled by the user.
    *   **Browser Support:** Firefox support is currently limited/experimental.

### Option B: Whisper via Transformers.js (WebAssembly)
OpenAI's Whisper is a state-of-the-art open-source STT model. Thanks to `Transformers.js`, it can be run directly inside the browser using WebAssembly.
*   **Pros:** 
    *   **100% Private & Offline:** Audio never leaves the user's computer.
    *   **Highly Accurate:** Superior to native APIs in many cases, especially for accents or background noise.
*   **Cons:** 
    *   **Size:** Even the `whisper-tiny` model is ~40-70MB, making the extension heavy to install.
    *   **Resource Intensive:** Running neural networks in the browser can drain laptop batteries and cause CPU spikes.

### Option C: Vosk (WebAssembly)
Vosk is an offline open-source speech recognition toolkit that also compiles to WebAssembly.
*   **Pros:** Lighter than Whisper, works completely offline, supports many languages.
*   **Cons:** Less accurate than Whisper; integration into a browser extension is somewhat complex.

**Recommendation:** For the primary implementation, we should use the **Web Speech API**. It provides the most seamless, lightweight experience for a browser extension. As an advanced "Pro" feature later, we could offer an offline WebAssembly (Whisper) toggle for privacy-conscious users.

---

## 2. Audio Frequency Visualization
To show the voice frequencies visually (e.g., a waveform or eq-bar graph) as the user speaks, we can use the **Web Audio API**.
*   **Mechanism:** We capture the microphone stream using `navigator.mediaDevices.getUserMedia`. We then route this stream through an `AudioContext` into an `AnalyserNode`.
*   **Output:** The `AnalyserNode` provides real-time frequency and time-domain analysis data, which we can render onto an HTML5 `<canvas>` element injected next to the text box.

---

## 3. Browser Extension Architecture (Manifest V3)
To ensure this works on "any text field on the internet," we need a **Content Script**.
*   **Content Script:** Injected into every web page. It will attach event listeners to `input`, `textarea`, and `[contenteditable="true"]` elements.
*   **UI Injection:** When a user clicks or focuses on a text field, the content script will inject a small floating "Microphone" button nearby.
*   **Permissions Needed:** `activeTab`, `scripting`, `microphone` (or `audioCapture`).

---

## 4. Additional Enhanced Features
To make this product stand out, we can plan for the following enhancements:
1.  **Auto-Punctuation & Capitalization:** Automatically capitalizing the first letter of sentences and inferring periods/question marks based on pauses.
2.  **Voice Commands:** Commands like *"New Line"*, *"Delete that"*, or *"Clear All"* to give hands-free control over the text field.
3.  **Language Toggle:** A quick dropdown to switch the recognition language (e.g., English to Spanish).
4.  **Visual Feedback Modes:** Multiple visualizer styles (Waveform, Bars, Circular) to make the tool feel premium.

