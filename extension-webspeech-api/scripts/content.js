// Content script injected into all pages

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
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Speech Recognition API is not supported in this browser.");
        return null;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    
    rec.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        const target = getTargetField();
        if (finalTranscript && target) {
            let processedText = finalTranscript.trim();
            const lowerText = processedText.toLowerCase();
            
            // --- VOICE COMMANDS ENGINE ---
            if (lowerText === "new line" || lowerText === "next line") {
                insertTextAtCursor(target, '\n');
            } 
            else if (lowerText === "clear field" || lowerText === "clear text") {
                insertTextAtCursor(target, '', true); 
            }
            else {
                processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
                insertTextAtCursor(target, processedText + ' ');
            }
        }
    };
    
    rec.onend = () => {
        if (isRecording) {
            try { rec.start(); } catch(e) {}
        } else {
            stopVisualization();
        }
    };
    
    rec.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === 'not-allowed' || event.error === 'audio-capture' || event.error === 'aborted') {
            isRecording = false;
            if (micBtn) micBtn.style.color = (currentTheme === 'dark') ? '#ffffff' : '#4f46e5';
            stopVisualization();
        }
    };
    
    return rec;
}

// Stop recording if the user switches to another tab
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && isRecording) {
            isRecording = false;
            try { recognition.stop(); } catch(e) {}
            if (micBtn) micBtn.style.color = (currentTheme === 'dark') ? '#ffffff' : '#4f46e5';
            stopVisualization();
        }
    });
}

// Safely insert text into ANY architecture (React, Standard, or Google Docs Canvas)
function insertTextAtCursor(element, text, wipe = false) {
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
        floatingUI.style.setProperty('background', 'rgba(0, 0, 0, 0.85)', 'important');
        floatingUI.style.border = '1px solid rgba(255,255,255,0.1)';
        floatingUI.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        if (!isRecording && micBtn) micBtn.style.color = '#ffffff';
    } else {
        floatingUI.style.setProperty('background', 'rgba(255, 255, 255, 0.85)', 'important');
        floatingUI.style.border = '1px solid rgba(0,0,0,0.1)';
        floatingUI.style.boxShadow = '0 8px 32px rgba(0,0,0,0.12)';
        if (!isRecording && micBtn) micBtn.style.color = '#4f46e5';
    }
}

function injectFloatingUI(theme = 'dark') {
    currentTheme = theme;
    let existingUI = document.getElementById('anyfield-dictation-ui');
    if (existingUI) {
        floatingUI = existingUI;
        micBtn = document.getElementById('anyfield-mic-btn');
        visualizerCanvas = document.getElementById('anyfield-visualizer');
        canvasCtx = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;
        applyTheme(theme);
        return;
    }
    
    floatingUI = document.createElement('div');
    floatingUI.id = 'anyfield-dictation-ui';
    
    floatingUI.style.position = 'fixed';
    floatingUI.style.bottom = '20px';
    floatingUI.style.right = '20px';
    floatingUI.style.setProperty('display', 'flex', 'important');
    floatingUI.style.alignItems = 'center';
    floatingUI.style.gap = '8px';
    floatingUI.style.padding = '8px 12px';
    floatingUI.style.backdropFilter = 'blur(10px)';
    floatingUI.style.borderRadius = '24px';
    floatingUI.style.cursor = 'grab';
    floatingUI.style.zIndex = '2147483647';
    floatingUI.style.transition = 'opacity 0.2s, box-shadow 0.2s, background 0.2s';
    floatingUI.style.userSelect = 'none';
    
    micBtn = document.createElement('button');
    micBtn.id = 'anyfield-mic-btn';
    micBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" x2="12" y1="19" y2="22"></line>
    </svg>`;
    micBtn.title = "Start Dictation";
    micBtn.style.background = 'none';
    micBtn.style.border = 'none';
    micBtn.style.cursor = 'pointer';
    micBtn.style.padding = '4px';
    micBtn.style.display = 'flex';
    micBtn.style.alignItems = 'center';
    micBtn.style.justifyContent = 'center';
    micBtn.style.borderRadius = '50%';
    
    visualizerCanvas = document.createElement('canvas');
    visualizerCanvas.id = 'anyfield-visualizer';
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
    if (!floatingUI || userHasDragged) return;
    try {
        const rect = field.getBoundingClientRect();
        floatingUI.style.top = `${rect.bottom + 10}px`;
        floatingUI.style.left = `${rect.left}px`;
        floatingUI.style.bottom = 'auto';
        floatingUI.style.right = 'auto';
    } catch(e) {}
}

// Hide UI
function hideUI() { /* Handled by fixed widget */ }

// Toggle Dictation State
async function toggleDictation() {
    if (!recognition) recognition = initSpeechRecognition();
    if (!recognition) return alert("Speech Recognition not supported in this browser.");

    if (isRecording) {
        isRecording = false;
        try { recognition.stop(); } catch(e) {}
        micBtn.classList.remove('recording');
        stopVisualization();
    } else {
        // Request cross-tab lock before starting
        try {
            await chrome.runtime.sendMessage({ action: "requestMicrophoneLock" });
            // Wait 150ms to let other tabs successfully release their microphone locks
            await new Promise(r => setTimeout(r, 150));
        } catch(e) {}
        
        isRecording = true;
        micBtn.style.color = '#ef4444'; // Red when recording
        try { recognition.start(); } catch(e) {}
        await startVisualization();
    }
}

// Audio Visualization setup
async function startVisualization() {
    try {
        microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        
        const source = audioContext.createMediaStreamSource(microphoneStream);
        source.connect(analyser);
        
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            if (!isRecording) return;
            animationId = requestAnimationFrame(draw);
            
            analyser.getByteFrequencyData(dataArray);
            
            canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
            
            const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
                const alpha = Math.min(1, 0.2 + (dataArray[i] / 255));
                if (currentTheme === 'dark') {
                    canvasCtx.fillStyle = `rgba(34, 211, 238, ${alpha})`; // Cyan
                } else {
                    canvasCtx.fillStyle = `rgba(79, 70, 229, ${alpha})`; // Indigo
                }
                canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        
        draw();
    } catch (err) {
        console.warn("Microphone access denied or failed (lock conflict)", err);
    }
}

function stopVisualization() {
    if (animationId) cancelAnimationFrame(animationId);
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
chrome.storage.local.get(['extensionEnabled', 'widgetTheme'], (result) => {
    if (result.extensionEnabled !== false) {
        injectFloatingUI(result.widgetTheme || 'dark');
    }
});

    document.addEventListener('focusin', (e) => {
        const el = e.target;
        // Support Google Docs IFRAME alongside normal inputs
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable || el.tagName === 'IFRAME') {
            if (el.type !== 'password' && el.type !== 'hidden') {
                activeField = el;
                showUI(el);
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
                if (isRecording) {
                    isRecording = false;
                    try { recognition.stop(); } catch(e) {}
                    if (micBtn) micBtn.style.color = (currentTheme === 'dark') ? '#ffffff' : '#4f46e5';
                    stopVisualization();
                }
                sendResponse({status: "released"});
            }
        });
    }

    // Listen for storage changes to universally sync settings across all tabs instantly
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.extensionEnabled) {
                const isEnabled = changes.extensionEnabled.newValue;
                if (isEnabled) {
                    chrome.storage.local.get(['widgetTheme'], (res) => {
                        injectFloatingUI(res.widgetTheme || 'dark');
                        if (floatingUI) floatingUI.style.setProperty('display', 'flex', 'important');
                    });
                } else {
                    if (isRecording) {
                        isRecording = false;
                        try { recognition.stop(); } catch(e) {}
                        if (micBtn) micBtn.style.color = (currentTheme === 'dark') ? '#ffffff' : '#4f46e5';
                        stopVisualization();
                    }
                    if (floatingUI) floatingUI.style.setProperty('display', 'none', 'important');
                }
            }
            if (changes.widgetTheme) {
                applyTheme(changes.widgetTheme.newValue);
            }
        }
    });
}

// Export for Jest testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        insertTextAtCursor,
        initSpeechRecognition,
        injectFloatingUI
    };
}
