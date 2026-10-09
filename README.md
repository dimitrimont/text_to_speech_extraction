# AnyField Dictation (Speech-to-Text Browser Extension)

Welcome to the AnyField Dictation extension! This project allows you to use your voice to type into **any text field** on the internet. It uses the native Web Speech API for high-performance dictation and features a real-time audio frequency visualizer.

*Note: This project is a Speech-to-Text (STT) tool designed to convert your computer's mic audio into text in a browser textbox.*

## Features

- **Universal Compatibility:** Works on standard inputs, textareas, and complex rich-text editors.
- **Audio Frequency Visualizer:** See your voice in real-time as you speak.
- **Privacy First:** Uses built-in browser APIs without requiring third-party cloud API keys.
- **Lightweight:** Pure Vanilla JS, no heavy frontend frameworks.

## Directory Structure

```
├── docs/                 # Research and project planning documents
├── extension/            # The actual browser extension code (Load this into Chrome)
│   ├── icons/            # Extension icons
│   ├── scripts/          # Background and Content scripts
│   ├── styles/           # CSS for the injected UI
│   └── manifest.json     # Chrome Extension Manifest V3
├── notebooks/            # Jupyter notebooks for STT model evaluation & testing
├── tests/                # Unit testing files
└── package.json          # Dev dependencies (linting, formatting)
```

## Installation (For Users & Reviewers)

Since this extension is in development and hosted on GitHub, you can install it manually in Chrome, Edge, or Brave:

1. **Clone the repository** (or download the ZIP and extract it):
   ```bash
   git clone https://github.com/your-username/text_to_speech_extention.git
   ```
2. **Open your browser's Extension page**:
   - Chrome/Brave: Navigate to `chrome://extensions/`
   - Edge: Navigate to `edge://extensions/`
3. **Enable "Developer mode"** (usually a toggle in the top right corner).
4. **Click "Load unpacked"** and select the `extension` folder from this repository.
5. **Pin the extension** to your toolbar for easy access.

## Development Setup

To work on this project locally, make sure you have [Node.js](https://nodejs.org/) installed.

1. Install development dependencies (ESLint, Prettier):
   ```bash
   npm install
   ```
2. Run the linter:
   ```bash
   npm run lint
   ```
3. To view the research and notebook evaluations:
   - Navigate to `notebooks/` and set up a Python virtual environment:
     ```bash
     python -m venv venv
     source venv/bin/activate
     pip install -r requirements.txt
     jupyter notebook
     ```

## How It Works

1. **Content Script (`content.js`):** Listens for focus events on any text field on a web page.
2. **UI Injection:** Upon focus, it creates a small floating microphone button next to the field.
3. **Web Audio API:** When clicked, it captures your microphone stream and pipes it into an `AnalyserNode` to draw a live frequency visualization.
4. **Web Speech API:** Simultaneously, it processes your speech into text and injects it directly into the focused field using standard DOM events so web frameworks (like React) register the change.

## Documentation

- [Research & Technology Options](docs/research.md)
- [Project Plan](docs/plan.md)

## License
MIT License
