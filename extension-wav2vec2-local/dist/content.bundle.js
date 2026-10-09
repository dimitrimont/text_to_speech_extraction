/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 585
(module) {

// Content script injected into all pages
console.log("CONTENT SCRIPT LOADED");
let activeField = null;

function getTargetField() {
    // 1. Explicitly tracked field
    if (activeField) return activeField;
    
    // 2. Google Docs
    const docsIframe = document.querySelector('.docs-texteventtarget-iframe') || document.querySelector('iframe.docs-texteventtarget-iframe');
    if (docsIframe) return docsIframe;
    
    // 3. Actively focused element
    if (document.activeElement && 
       (document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' || 
        document.activeElement.isContentEditable)) {
        return document.activeElement;
    }
    
    // 4. Auto-detect if user forgot to click a text box (common on SPAs like Gemini or ChatGPT)
    // Find all contenteditable elements (including plaintext-only or empty attribute)
    const editables = Array.from(document.querySelectorAll('[contenteditable]')).filter(el => el.getAttribute('contenteditable') !== 'false');
    if (editables.length > 0) return editables[editables.length - 1]; // Usually the main chat box is last in DOM
    
    const textareas = document.querySelectorAll('textarea');
    if (textareas.length > 0) return textareas[textareas.length - 1];
    
    // Find any valid input field (excluding buttons, checkboxes, passwords, etc)
    const inputs = Array.from(document.querySelectorAll('input')).filter(el => 
        !['hidden', 'submit', 'button', 'radio', 'checkbox', 'password', 'color', 'file', 'image', 'reset'].includes(el.type)
    );
    if (inputs.length > 0) return inputs[inputs.length - 1];

    return null;
}

let recognition = null;
let isRecording = false;
let isExtensionEnabled = true;

// Audio context and analysis nodes for visualization
let audioContext = null;
let analyser = null;
let microphoneStream = null;
let animationId = null;

// UI Elements
let floatingUI = null;
let micBtn = null;
let visualizerCanvas = null;
let canvasCtx = null;

// Mouse tracking for Canvas-based editors (Google Docs) that hide inputs off-screen
let lastMouseX = 0;
let lastMouseY = 0;

if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });
}

// Initialize Speech Recognition
// ML ML pipeline replaces SpeechRecognition
let audioProcessor = null;
let recordingBuffer = [];
let silenceTimer = null;
let isProcessing = false;

function initMLPipeline() {
    // We don't need to return an object like SpeechRecognition, we just handle state
    return {
        start: async () => {
            await startVisualization();
        },
        stop: () => {
            stopVisualization();
        }
    };
}

// Stop recording if the user switches to another tab
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isRecording) {
            isRecording = false;
            try { recognition.stop(); } catch(e) {}
            if (micBtn) micBtn.style.color = (currentTheme === 'dark') ? '#FFA500' : '#FF8C00';
            stopVisualization();
        }
    });
}

// Safely insert text into ANY architecture (React, Standard, or Google Docs Canvas)
function insertTextAtCursor(element, text, wipe = false) {
    console.log("Injecting text:", text, "wipe:", wipe, "element:", element);
    if (wipe) text = "";

    // 1. Google Docs / Canvas Editors (They use hidden iframes for typing)
    if (element.tagName === 'IFRAME' || element.classList?.contains('docs-texteventtarget-iframe')) {
        const targetDoc = element.contentDocument || element.contentWindow?.document;
        const targetNode = targetDoc ? (targetDoc.activeElement || targetDoc.body) : element;
        const targetWin = element.contentWindow || window;
        
        if (wipe) {
            // Simulate backspaces for Google Docs if clear command is used
            for(let i=0; i<50; i++) {
                targetNode.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true }));
            }
            return;
        }
        
        if (targetWin && targetWin.focus) targetWin.focus();
        if (targetNode && targetNode.focus) targetNode.focus();

        // Fire a barrage of events that Google Docs might be listening to
        
        // 1. execCommand
        if (targetDoc) {
            try { targetDoc.execCommand('insertText', false, text); } catch(e) {}
        }
        
        // 2. Paste Event
        try {
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const pasteEvent = new ClipboardEvent('paste', {
                clipboardData: dataTransfer,
                bubbles: true,
                cancelable: true
            });
            targetNode.dispatchEvent(pasteEvent);
            if (targetNode !== targetDoc?.body) targetDoc?.body?.dispatchEvent(pasteEvent);
        } catch (e) {}

        // 3. TextEvent (Legacy)
        try {
            const textEvent = (targetDoc || document).createEvent('TextEvent');
            textEvent.initTextEvent('textInput', true, true, targetWin, text, 9, "en-US");
            targetNode.dispatchEvent(textEvent);
            if (targetNode !== targetDoc?.body) targetDoc?.body?.dispatchEvent(textEvent);
        } catch(e) {}
        
        // 4. InputEvent (Modern)
        try {
            const inputEvent = new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true });
            targetNode.dispatchEvent(inputEvent);
            if (targetNode !== targetDoc?.body) targetDoc?.body?.dispatchEvent(inputEvent);
        } catch(e) {}
        
        return;
    }

    // 2. React / Vue / Standard Inputs
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        element.focus();
        
        // Try native execCommand first (triggers all proper site events and undo stack)
        let execSuccess = false;
        try {
            if (wipe) document.execCommand('selectAll', false, null);
            execSuccess = document.execCommand('insertText', false, text);
        } catch(e) {}
        
        // Fallback to prototype injection for stubborn React/Vue wrappers if execCommand fails
        if (!execSuccess) {
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const currentValue = element.value;
            const newText = wipe ? '' : (currentValue.slice(0, start) + text + currentValue.slice(end));
            
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
            
            if (element.tagName === 'INPUT' && nativeInputValueSetter) {
                nativeInputValueSetter.call(element, newText);
            } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(element, newText);
            } else {
                element.value = newText;
            }
            element.selectionStart = element.selectionEnd = start + text.length;
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Unidentified' }));
    } 
    // 3. Standard ContentEditable (Notion, Medium, etc)
    else if (element.isContentEditable) {
        element.focus();
        if (wipe) {
            element.innerHTML = '';
        } else {
            document.execCommand('insertText', false, text);
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Unidentified' }));
    }
}

// Create and inject floating UI

let userHasDragged = false;
let isDragging = false;
let dragStartX, dragStartY;
let initialWidgetX, initialWidgetY;

let currentTheme = 'dark';

function applyTheme(theme) {
    currentTheme = theme;
    if (!floatingUI) return;
    
    if (theme === 'dark') {
        floatingUI.style.setProperty('background', 'rgba(15, 15, 15, 0.95)', 'important');
        floatingUI.style.border = '1px solid rgba(255, 165, 0, 0.3)';
        floatingUI.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.6)';
        if (!isRecording && micBtn) micBtn.style.color = '#FFA500';
    } else {
        floatingUI.style.setProperty('background', 'rgba(255, 245, 235, 0.95)', 'important');
        floatingUI.style.border = '1px solid rgba(255, 165, 0, 0.4)';
        floatingUI.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.1)';
        if (!isRecording && micBtn) micBtn.style.color = '#FF8C00';
    }
}

function injectFloatingUI(theme = 'dark') {
    // Prevent injecting into hidden or tiny iframes (like Google Docs event targets)
    if (window.innerWidth < 100 || window.innerHeight < 100) return;
    
    currentTheme = theme;
    let existingUI = document.getElementById('anyfield-ml-ui');
    if (existingUI) {
        floatingUI = existingUI;
        micBtn = document.getElementById('anyfield-ml-mic-btn');
        visualizerCanvas = document.getElementById('anyfield-ml-visualizer');
        canvasCtx = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;
        applyTheme(theme);
        return;
    }
    
    if (!document.getElementById('anyfield-ml-styles')) {
        const style = document.createElement('style');
        style.id = 'anyfield-ml-styles';
        style.textContent = `
            @keyframes anyfield-pulse {
                0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            #anyfield-ml-mic-btn {
                transition: all 0.2s ease;
            }
            #anyfield-ml-mic-btn.recording {
                animation: anyfield-pulse 1.5s infinite;
                background: rgba(239, 68, 68, 0.1) !important;
                color: #ef4444 !important;
            }
            #anyfield-ml-ui:hover {
                transform: translateY(-1px);
            }
        `;
        document.head.appendChild(style);
    }
    
    floatingUI = document.createElement('div');
    floatingUI.id = 'anyfield-ml-ui';
    
    floatingUI.style.position = 'fixed';
    floatingUI.style.setProperty('display', 'flex', 'important');
    floatingUI.style.bottom = '20px';
    floatingUI.style.right = '20px';
    floatingUI.style.alignItems = 'center';
    floatingUI.style.gap = '12px';
    floatingUI.style.padding = '8px 16px 8px 12px';
    floatingUI.style.backdropFilter = 'blur(16px)';
    floatingUI.style.webkitBackdropFilter = 'blur(16px)';
    floatingUI.style.borderRadius = '32px';
    floatingUI.style.cursor = 'grab';
    floatingUI.style.zIndex = '2147483647';
    floatingUI.style.transition = 'opacity 0.2s, box-shadow 0.2s, background 0.2s, transform 0.2s';
    floatingUI.style.userSelect = 'none';
    
    micBtn = document.createElement('button');
    micBtn.id = 'anyfield-ml-mic-btn';
    micBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" x2="12" y1="19" y2="22"></line>
    </svg>`;
    micBtn.title = "Start Dictation";
    micBtn.style.background = 'transparent';
    micBtn.style.border = 'none';
    micBtn.style.cursor = 'pointer';
    micBtn.style.padding = '8px';
    micBtn.style.display = 'flex';
    micBtn.style.alignItems = 'center';
    micBtn.style.justifyContent = 'center';
    micBtn.style.borderRadius = '50%';
    
    visualizerCanvas = document.createElement('canvas');
    visualizerCanvas.id = 'anyfield-ml-visualizer';
    visualizerCanvas.width = 100;
    visualizerCanvas.height = 30;
    visualizerCanvas.style.borderRadius = '4px';
    canvasCtx = visualizerCanvas.getContext('2d');
    
    floatingUI.appendChild(micBtn);
    floatingUI.appendChild(visualizerCanvas);
    document.body.appendChild(floatingUI);
    
    applyTheme(theme);
    
    micBtn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault(); 
        toggleDictation();
    });
    
    // Dragging logic
    floatingUI.addEventListener('mousedown', (e) => {
        if (e.target === micBtn || e.target.closest('svg')) return;
        isDragging = true;
        userHasDragged = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = floatingUI.getBoundingClientRect();
        initialWidgetX = rect.left;
        initialWidgetY = rect.top;
        
        floatingUI.style.cursor = 'grabbing';
        floatingUI.style.transition = 'none'; // Disable transition during drag
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        
        floatingUI.style.left = `${initialWidgetX + dx}px`;
        floatingUI.style.top = `${initialWidgetY + dy}px`;
        floatingUI.style.bottom = 'auto';
        floatingUI.style.right = 'auto';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            if (floatingUI) {
                floatingUI.style.cursor = 'grab';
                floatingUI.style.transition = 'opacity 0.2s, box-shadow 0.2s';
            }
        }
    });
}


// Show UI near active field or mouse cursor
function showUI(field) {
    // The user explicitly requested the widget stays in the corner and does not jump below text boxes.
    if (floatingUI) {
        floatingUI.style.setProperty('display', 'flex', 'important');
    }
}

// Hide UI
function hideUI() { /* Handled by fixed widget */ }

// Toggle Dictation State
async function toggleDictation() {
    if (!recognition) recognition = initMLPipeline();
    if (!recognition) return alert("Speech Recognition not supported in this browser.");

    if (isRecording) {
        isRecording = false;
        try { recognition.stop(); } catch(e) {}
        
        // Flush remaining audio buffer if user manually stops
        if (recordingBuffer.length > 5 && !isProcessing) {
            processMLAudio();
        }
        
        if (micBtn && !isProcessing) {
            micBtn.style.color = (currentTheme === 'dark') ? '#FFA500' : '#FF8C00';
        }
        stopVisualization();
    } else {
        // Request cross-tab lock before starting
        try {
            await chrome.runtime.sendMessage({ action: "requestMicrophoneLock" });
            // Wait 150ms to let other tabs successfully release their microphone locks
            await new Promise(r => setTimeout(r, 150));
        } catch(e) {
            if (e.message.includes("Extension context invalidated")) {
                alert("The extension was updated. Please refresh this page to use the new version.");
                return;
            }
        }
        
        isRecording = true;
        micBtn.style.color = '#ef4444'; // Red when recording
        try { recognition.start(); } catch(e) {}
        await startVisualization();
    }
}

// Audio Visualization setup
async function startVisualization() {
    try {
        // Request 16kHz mono audio for ML
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true } 
        });
        
        if (!isRecording) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        
        if (microphoneStream) {
            microphoneStream.getTracks().forEach(track => track.stop());
        }
        
        microphoneStream = stream;
        
        if (audioContext && audioContext.state !== 'closed') {
            try { audioContext.close(); } catch(e) {}
        }
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        analyser = audioContext.createAnalyser();
        
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        
        // Capture raw audio using AudioWorklet (removes deprecation warning and improves perf)
        await audioContext.audioWorklet.addModule(chrome.runtime.getURL('dist/worklet.js'));
        
        if (!isRecording || !audioContext) return;
        
        audioProcessor = new AudioWorkletNode(audioContext, 'recorder-worklet');
        source.connect(audioProcessor);
        audioProcessor.connect(audioContext.destination);
        
        recordingBuffer = [];
        let silenceThreshold = 0.02; // Adjust based on noise
        let silenceCount = 0;
        
        let hasStartedSpeaking = false;
        audioProcessor.port.onmessage = (e) => {
            if (!isRecording) return;
            
            const inputData = e.data;
            
            // Calculate energy for simple VAD (Voice Activity Detection)
            let energy = 0;
            for (let i = 0; i < inputData.length; i++) {
                energy += Math.abs(inputData[i]);
            }
            energy = energy / inputData.length;
            
            if (energy >= silenceThreshold) {
                hasStartedSpeaking = true;
                silenceCount = 0;
            } else {
                silenceCount++;
            }
            
            // Push audio to buffer
            const chunk = new Float32Array(inputData);
            
            if (!hasStartedSpeaking) {
                // Keep a small ring buffer (e.g. 3 chunks = ~0.75s) of silence before speech
                recordingBuffer.push(chunk);
                if (recordingBuffer.length > 3) recordingBuffer.shift();
            } else {
                recordingBuffer.push(chunk);
            }
            
            // If silence for ~1.5 seconds (16000Hz / 4096 * 1.5 ≈ 6 chunks), process audio
            if (hasStartedSpeaking && silenceCount > 6 && !isProcessing) {
                processMLAudio();
                hasStartedSpeaking = false; // Reset for next phrase
            }
        };
        
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!isRecording) return;
            animationId = requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            if (canvasCtx) {
                canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
                const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
                    const alpha = Math.min(1, 0.2 + (dataArray[i] / 255));
                    if (currentTheme === 'dark') {
                        canvasCtx.fillStyle = `rgba(255, 165, 0, ${alpha})`;
                    } else {
                        canvasCtx.fillStyle = `rgba(255, 140, 0, ${alpha})`;
                    }
                    canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                    x += barWidth + 1;
                }
            }
        };
        draw();
    } catch (err) {
        console.warn("Microphone access denied or failed", err);
    }
}

async function processMLAudio() {
    isProcessing = true;
    if (micBtn) micBtn.style.color = '#FCD34D'; // Yellow indicating processing
    
    // Concatenate all chunks
    const totalLength = recordingBuffer.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioData = new Float32Array(totalLength);
    let offset = 0;
    for (let chunk of recordingBuffer) {
        audioData.set(chunk, offset);
        offset += chunk.length;
    }
    
    recordingBuffer = []; // Clear for next phrase
    
    // Send to background worker
    try {
        const response = await chrome.runtime.sendMessage({ 
            action: "transcribe", 
            audio: Array.from(audioData) // Convert to standard array for JSON transport
        });
        
        if (response && response.text) {
            let processedText = response.text.trim();
            // Remove Whisper's noise tags like [Music], [blank_audio], (silence)
            processedText = processedText.replace(/\[.*?\]|\(.*?\)/g, '').trim();
            
            if (processedText.length > 0) {
                const lowerText = processedText.toLowerCase();
                
                // Format Wav2Vec2's ALL CAPS output to standard casing
                if (processedText === processedText.toUpperCase()) {
                    processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1).toLowerCase();
                }
                
                const target = getTargetField();
                if (target) {
                    if (lowerText.includes("new line") || lowerText.includes("next line")) {
                        insertTextAtCursor(target, '\n');
                    } 
                    else if (lowerText.includes("clear field") || lowerText.includes("clear text")) {
                        insertTextAtCursor(target, '', true); 
                    }
                    else {
                        insertTextAtCursor(target, processedText + ' ');
                    }
                }
            }
        }
    } catch(e) {
        console.error("Failed to communicate with ML worker:", e);
    }
    
    isProcessing = false;
    if (micBtn) {
        if (isRecording) {
            micBtn.style.color = '#ef4444'; // Red
        } else {
            micBtn.style.color = (currentTheme === 'dark') ? '#FFA500' : '#FF8C00';
        }
    }
}

function stopVisualization() {
    if (animationId) cancelAnimationFrame(animationId);
    if (audioProcessor) {
        try { audioProcessor.disconnect(); } catch(e) {}
        audioProcessor = null;
    }
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext && audioContext.state !== 'closed') {
        try {
            const p = audioContext.close();
            if (p && p.catch) p.catch(e => console.warn("AudioContext error:", e));
        } catch (e) {
            console.warn("AudioContext sync error:", e);
        }
    }
    audioContext = null;
    microphoneStream = null;
    if (canvasCtx) {
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }
}

// Event Listeners
if (typeof document !== 'undefined') {
    
// Check if extension is enabled before showing UI
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['extensionEnabled', 'widgetTheme'], (result) => {
        isExtensionEnabled = result.extensionEnabled !== false;
        if (isExtensionEnabled) {
            injectFloatingUI(result.widgetTheme || 'dark');
            
            // Auto-show for Google Docs since it's a dedicated word processor
            setTimeout(() => {
                if (window.location.hostname.includes('docs.google.com')) {
                    const docsIframe = document.querySelector('iframe.docs-texteventtarget-iframe') || document.querySelector('.docs-texteventtarget-iframe');
                    if (docsIframe) {
                        activeField = docsIframe;
                        showUI(docsIframe);
                    }
                }
            }, 1000); // Give Docs time to render the canvas
        }
    });
}

    document.addEventListener('focusin', (e) => {
        const el = e.target;
        // Support normal inputs
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.tagName === 'IFRAME') {
            if (el.type !== 'password' && el.type !== 'hidden') {
                activeField = el;
                showUI(el);
            }
        }
    });

    // Special robust handling for Google Docs canvas
    document.addEventListener('click', (e) => {
        if (!isExtensionEnabled) return;
        if (e.target.closest('#anyfield-ml-ui')) return;
        
        if (window.location.hostname.includes('docs.google.com')) {
            const docsIframe = document.querySelector('iframe.docs-texteventtarget-iframe') || document.querySelector('.docs-texteventtarget-iframe');
            if (docsIframe) {
                activeField = docsIframe;
                showUI(docsIframe);
            }
        }
    });

    
    // Listen for the "Force Start" command from the extension popup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

            if (request.action === "forceToggleDictation") {
                if (!floatingUI) injectFloatingUI();
                
                // If there's no active field detected yet, anchor it to the top right of the screen
                floatingUI.style.setProperty('display', 'flex', 'important');
                if (!floatingUI.style.top || floatingUI.style.top === '') {
                    floatingUI.style.position = 'fixed';
                    floatingUI.style.top = '20px';
                    floatingUI.style.right = '20px';
                    floatingUI.style.left = 'auto';
                }
                
                toggleDictation();
                sendResponse({status: "started"});
            }
            if (request.action === "releaseMicrophone") {
                isRecording = false;
                try { if (recognition) recognition.stop(); } catch(e) {}
                if (micBtn) micBtn.style.color = (currentTheme === 'dark') ? '#FFA500' : '#FF8C00';
                stopVisualization();
                sendResponse({status: "released"});
            }
        });
    }

    // Listen for storage changes to universally sync settings across all tabs instantly
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.extensionEnabled) {
                const isEnabled = changes.extensionEnabled.newValue;
                isExtensionEnabled = isEnabled;
                if (isEnabled) {
                    chrome.storage.local.get(['widgetTheme'], (res) => {
                        injectFloatingUI(res.widgetTheme || 'dark');
                        if (floatingUI) floatingUI.style.setProperty('display', 'flex', 'important');
                    });
                } else {
                    isRecording = false;
                    try { if (recognition) recognition.stop(); } catch(e) {}
                    if (micBtn) micBtn.style.color = (currentTheme === 'dark') ? '#FFA500' : '#FF8C00';
                    stopVisualization();
                    if (floatingUI) floatingUI.style.setProperty('display', 'none', 'important');
                }
            }
            if (changes.widgetTheme) {
                applyTheme(changes.widgetTheme.newValue);
            }
        }
    });
}
}

// Export for Jest testing
if ( true && module.exports) {
    module.exports = {
        insertTextAtCursor,
        initMLPipeline,
        injectFloatingUI
    };
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	let __webpack_exports__ = __webpack_require__(585);
/******/ 	
/******/ })()
;