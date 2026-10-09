# AnyField Dictation

AnyField Dictation is a browser extension that allows you to use your voice to type into **any text field** on the internet. Whether you are filling out a form, writing an email, or searching the web, this extension brings seamless Speech-to-Text (STT) capabilities to your browser.

This repository contains **two different versions** of the extension, taking two distinct approaches to STT processing. You can choose whichever version best fits your privacy and performance needs.

---

## The Two Approaches: Detailed Breakdown

### 1. The Web Speech API Version (`extension-webspeech-api`)
This is the recommended version for most users. It acts as a lightweight wrapper around your browser's native `SpeechRecognition` interface.

* **How it works:** When you speak, the extension uses the Web Speech API to capture your voice. The browser then handles the heavy lifting, typically by streaming the audio to a remote server (such as Google's servers if you are using Chrome) where a massive, highly optimized model processes it and returns the transcribed text.
* **Pros:** 
  * Extremely fast transcription with near-zero latency.
  * Highly accurate, even with background noise.
  * Automatically handles casing, punctuation, and grammar.
  * Very lightweight extension size since the browser does all the work.
* **Cons:** 
  * **Privacy tradeoff:** Your voice data is sent to the cloud (Google, Microsoft, Apple, depending on your browser) for processing.
  * Requires an active internet connection.

### 2. The Local ML Version (`extension-wav2vec2-local`)
This version is designed for users who require strict privacy. It runs a neural network directly inside your browser.

* **How it works:** This version uses the Web Audio API and an `AudioWorklet` to capture raw 16kHz audio from your microphone. It batches this audio and sends it to a background service worker, which runs the `Xenova/whisper-tiny.en` machine learning model entirely locally using `Transformers.js` (compiled to WebAssembly).
* **Pros:** 
  * **100% Private:** Your audio never leaves your device. No data is sent to the cloud.
  * Works completely offline.
* **Cons:** 
  * **Slower & Less Accurate:** Browsers have strict memory and CPU limits, meaning we can only run the "tiny" variant of the Whisper model. This tiny model is less accurate than cloud models, occasionally producing typos, struggling with niche technical vocabulary, or misinterpreting background noise.
  * Because it processes audio in chunks on your CPU rather than streaming to a massive cloud GPU, there is a slight delay between speaking and the text appearing.

---

## Installation & Usage Guide

### Part 1: How to Install
Since this is a developer project, you will need to install it manually. It works in Chromium-based browsers like Google Chrome, Microsoft Edge, or Brave.

1. **Download the project**: Either clone this repository using Git or download it as a ZIP file and extract it to a folder on your computer.
2. **Open your Extensions page**:
   - In Chrome or Brave, type `chrome://extensions/` into your URL bar and hit Enter.
   - In Edge, type `edge://extensions/`.
3. **Turn on Developer Mode**: Look for a toggle switch in the top right corner labeled "Developer mode" and turn it on.
4. **Load the Extension**: 
   - Click the **"Load unpacked"** button that appears in the top left.
   - Select the folder of the version you want to use (either the `extension-webspeech-api` folder OR the `extension-wav2vec2-local` folder).
5. **Pin the Extension**: Click the puzzle piece icon next to your URL bar and "pin" the AnyField Dictation icon so it is always visible.

### Part 2: How to Use
Once installed, using the extension is simple:

1. **Enable the Extension**: Click the AnyField Dictation icon in your browser toolbar. A small popup will open. Ensure the toggle switch is set to **ON**.
2. **Select a Text Field**: Go to any website and click into a text input, search bar, or text area (like writing a tweet or an email).
3. **Activate the Microphone**: A small, floating microphone widget will automatically appear in the bottom right corner of your browser window. 
4. **Start Dictating**: Click the floating microphone widget. The icon will turn red, indicating it is actively listening. Speak clearly into your microphone.
5. **Watch it Type**: Your speech will be automatically transcribed and typed into the text field you selected.
6. **Stop Dictating**: When you are finished, click the red microphone widget again to turn it off.

---

## Voice Commands
Both versions support basic voice commands to help format your text without touching the keyboard:
- Say **"New line"** or **"Next line"** to press Enter and move to a new line.
- Say **"Clear field"** or **"Clear text"** to delete everything currently in the text box.

---

## Development Setup

To work on this project locally, make sure you have [Node.js](https://nodejs.org/) installed.

```bash
npm install
npm run lint
```

**Modifying the Local ML Version:**
The `extension-wav2vec2-local` version uses Webpack to bundle the Transformers.js library. If you make any changes to the code inside `extension-wav2vec2-local/src/`, you must rebuild the extension before the changes take effect:
```bash
cd extension-wav2vec2-local
npx webpack
```
Once rebuilt, go back to your `chrome://extensions/` page and click the "Reload" icon on the extension card.

## Directory Structure

```text
├── extension-webspeech-api/   # The native Web Speech API extension
├── extension-wav2vec2-local/  # The local Transformers.js ML extension
├── notebooks/                 # Jupyter notebooks for STT model evaluation & testing
├── docs/                      # Research and project planning documents
```

## License
MIT License
