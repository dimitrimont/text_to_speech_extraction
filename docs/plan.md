# Project Plan: AnyField Speech-to-Text Extension

## 1. Project Overview
The goal of this project is to build a browser extension that allows users to dictate text directly into any text input field on the web. It will feature a real-time audio frequency visualizer and will be built to be easily installable directly from GitHub.

## 2. Architecture & Tech Stack
*   **Extension Format:** Chrome Extension Manifest V3.
*   **STT Engine:** Web Speech API (primary, lightweight, native).
*   **Audio Engine:** Web Audio API (`AnalyserNode`) for visualization.
*   **UI/Styling:** Vanilla JavaScript and CSS (no heavy frontend frameworks to keep the extension lean and fast).
*   **Testing/Evaluation:** Jupyter Notebooks (Python) to evaluate STT model alternatives.

## 3. Implementation Phases

### Phase 1: Project Skeleton & Setup (Current)
*   [x] Set up directory structure (`extension/`, `docs/`, `notebooks/`, `tests/`).
*   [x] Create research and planning documents.
*   [x] Initialize Git and basic files (`README.md`, `package.json` for linting).

### Phase 2: Core Browser Extension (Manifest & UI)
*   [ ] Define `manifest.json` with necessary permissions (`activeTab`, `scripting`, microphone access).
*   [ ] Create `content.js` to detect when a user focuses on an `input`, `textarea`, or `contenteditable` element.
*   [ ] Inject a floating UI (Microphone Button) near the active text field.

### Phase 3: Speech Recognition & Text Injection
*   [ ] Implement `speechHandler.js` using the Web Speech API.
*   [ ] Capture transcribed text and safely append/insert it at the cursor position in the target text field.
*   [ ] Handle edge cases (e.g., React/Vue controlled inputs that require dispatching `input` events).

### Phase 4: Audio Visualization
*   [ ] Request microphone access via `getUserMedia`.
*   [ ] Hook the audio stream into an `AudioContext` and `AnalyserNode`.
*   [ ] Draw real-time frequency bars on an HTML5 `<canvas>` that overlays or sits next to the microphone button.

### Phase 5: Testing & Evaluation
*   [ ] Create `STT_Model_Evaluation.ipynb` in the `notebooks/` directory.
*   [ ] Set up a Python environment with `librosa`, `SpeechRecognition`, and `matplotlib` to evaluate traditional vs. advanced STT models, ensuring we have research backing our API choice.
*   [ ] Write unit tests for the core logic (if decoupled from the DOM).

### Phase 6: Polish & Publishing
*   [ ] Add enhanced features (Voice commands like "New Line", "Clear").
*   [ ] Create high-quality icons.
*   [ ] Finalize `README.md` with step-by-step installation instructions for unpacked extensions.
*   [ ] Ensure code is well-commented and employer-ready.

## 4. How to Test (QA Plan)
1.  **Unit/Lint Testing:** Run `npm run lint` and `npm test` to ensure code quality.
2.  **Browser Manual QA:** 
    *   Load the extension in Chrome via `chrome://extensions` -> "Load unpacked".
    *   Test on standard HTML forms (e.g., Wikipedia search).
    *   Test on complex web apps (e.g., Google Docs, Twitter/X tweet box, Gmail composer).
3.  **Visualizer QA:** Ensure the frequency bars react in real-time and stop when dictation pauses.
