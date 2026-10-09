import * as transformers from '@xenova/transformers';
const { pipeline, env } = transformers;
globalThis.transformers = transformers;

// Skip local model check since we are in a browser extension
env.allowLocalModels = false;
env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('dist/');
env.backends.onnx.wasm.numThreads = 1;

// Use Whisper Tiny for better accuracy and punctuation
const MODEL_NAME = 'Xenova/whisper-tiny.en';

let transcriber = null;

// Initialize the pipeline
async function initializeTranscriber() {
    if (transcriber) return transcriber;
    console.log("Loading Whisper model...");
    try {
        transcriber = await pipeline('automatic-speech-recognition', MODEL_NAME, {
            quantized: true
        });
        console.log("Model loaded successfully!");
        return transcriber;
    } catch (e) {
        console.error("Failed to load model:", e);
        return null;
    }
}

// Pre-load the model when the extension starts
initializeTranscriber();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "transcribe") {
        const audioData = new Float32Array(request.audio);
        
        initializeTranscriber().then(pipe => {
            if (!pipe) {
                sendResponse({ text: "" });
                return;
            }
            
            pipe(audioData).then(result => {
                const text = Array.isArray(result) ? result[0]?.text : result.text;
                console.log("Transcription result:", text);
                sendResponse({ text: text || "" });
            }).catch(e => {
                console.error("Transcription error:", e);
                sendResponse({ text: "", error: e.toString() });
            });
        });
        
        return true; // Keep message channel open for async response
    }

    if (request.action === "requestMicrophoneLock") {
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                if (tab.id !== sender.tab?.id) {
                    chrome.tabs.sendMessage(tab.id, { action: "releaseMicrophone" }).catch(() => {});
                }
            }
        });
        sendResponse({ granted: true });
    }
});
