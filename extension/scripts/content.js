// Content script injected into all pages

let activeField = null;
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
        
        if (finalTranscript && activeField) {
            let processedText = finalTranscript.trim();
            const lowerText = processedText.toLowerCase();
            
            // --- VOICE COMMANDS ENGINE ---
            if (lowerText === "new line" || lowerText === "next line") {
                insertTextAtCursor(activeField, '\n');
            } 
            else if (lowerText === "clear field" || lowerText === "clear text") {
                insertTextAtCursor(activeField, '', true); 
            }
            else {
                processedText = processedText.charAt(0).toUpperCase() + processedText.slice(1);
                insertTextAtCursor(activeField, processedText + ' ');
            }
        }
    };
    
    rec.onend = () => {
        if (isRecording) {
            rec.start();
        } else {
            stopVisualization();
        }
    };
    
    return rec;
}

// Safely insert text into ANY architecture (React, Standard, or Google Docs Canvas)
function insertTextAtCursor(element, text, wipe = false) {
    if (wipe) text = "";

    // 1. Google Docs / Canvas Editors (They use hidden iframes for typing)
    if (element.tagName === 'IFRAME' || element.classList?.contains('docs-texteventtarget-iframe')) {
        if (wipe) {
            // Simulate backspaces for Google Docs if clear command is used
            for(let i=0; i<50; i++) {
                element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true }));
            }
            return;
        }
        // Google Docs listens to synthetic TextEvents sent directly to the hidden iframe
        const textEvent = document.createEvent('TextEvent');
        textEvent.initTextEvent('textInput', true, true, window, text, 9, "en-US");
        element.dispatchEvent(textEvent);
        return;
    }

    // 2. React / Vue / Standard Inputs
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const currentValue = element.value;
        const newText = wipe ? '' : (currentValue.slice(0, start) + text + currentValue.slice(end));
        
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        
        if (element.tagName === 'INPUT' && nativeInputValueSetter) {
            nativeInputValueSetter.call(element, newText);
        } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
            nativeTextAreaValueSetter.call(element, newText);
        } else {
            element.value = newText;
        }
        
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.selectionStart = element.selectionEnd = start + text.length;
    } 
    // 3. Standard ContentEditable (Notion, Medium, etc)
    else if (element.isContentEditable) {
        element.focus();
        if (wipe) {
            element.innerHTML = '';
        } else {
            document.execCommand('insertText', false, text);
        }
    }
}

// Create and inject floating UI
function injectFloatingUI() {
    if (document.getElementById('anyfield-dictation-ui')) return;
    
    floatingUI = document.createElement('div');
    floatingUI.id = 'anyfield-dictation-ui';
    
    micBtn = document.createElement('button');
    micBtn.id = 'anyfield-mic-btn';
    micBtn.innerHTML = '🎤';
    micBtn.title = "Start Dictation";
    
    visualizerCanvas = document.createElement('canvas');
    visualizerCanvas.id = 'anyfield-visualizer';
    visualizerCanvas.width = 100;
    visualizerCanvas.height = 30;
    canvasCtx = visualizerCanvas.getContext('2d');
    
    floatingUI.appendChild(micBtn);
    floatingUI.appendChild(visualizerCanvas);
    document.body.appendChild(floatingUI);
    
    // Use mousedown instead of click to prevent focus loss issues on some SPAs
    micBtn.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        toggleDictation();
    });
}

// Show UI near active field or mouse cursor
function showUI(field) {
    if (!floatingUI) injectFloatingUI();
    const rect = field.getBoundingClientRect();
    
    floatingUI.style.display = 'flex';
    
    // If field is hidden/offscreen (like Google Docs), position UI at the mouse click
    if (rect.width === 0 || rect.height === 0 || rect.top < -500 || rect.left < -500) {
        floatingUI.style.top = `${window.scrollY + lastMouseY - 40}px`;
        floatingUI.style.left = `${window.scrollX + lastMouseX + 20}px`;
    } else {
        // Standard positioning
        floatingUI.style.top = `${window.scrollY + rect.top - 40}px`;
        floatingUI.style.left = `${window.scrollX + rect.left + rect.width - 150}px`;
    }
}

// Hide UI
function hideUI() {
    if (floatingUI && !isRecording) {
        floatingUI.style.display = 'none';
    }
}

// Toggle Dictation State
async function toggleDictation() {
    if (!recognition) recognition = initSpeechRecognition();
    if (!recognition) return alert("Speech Recognition not supported in this browser.");

    if (isRecording) {
        isRecording = false;
        recognition.stop();
        micBtn.classList.remove('recording');
        stopVisualization();
    } else {
        isRecording = true;
        micBtn.classList.add('recording');
        recognition.start();
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
            
            canvasCtx.fillStyle = '#222';
            canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
            
            const barWidth = (visualizerCanvas.width / bufferLength) * 2.5;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
                canvasCtx.fillStyle = `rgb(${dataArray[i] + 100}, 50, 250)`;
                canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        
        draw();
    } catch (err) {
        console.error("Microphone access denied or failed", err);
    }
}

function stopVisualization() {
    if (animationId) cancelAnimationFrame(animationId);
    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
    }
    if (audioContext) {
        audioContext.close();
    }
    if (canvasCtx) {
        canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    }
}

// Event Listeners
if (typeof document !== 'undefined') {
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

    document.addEventListener('focusout', (e) => {
        setTimeout(() => {
            // Keep UI open if we click inside the UI itself
            if (!isRecording && document.activeElement !== activeField && !floatingUI?.contains(document.activeElement)) {
                hideUI();
            }
        }, 200);
    });

    // Listen for the "Force Start" command from the extension popup
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "forceToggleDictation") {
                if (!floatingUI) injectFloatingUI();
                
                // If there's no active field detected yet, anchor it to the top right of the screen
                floatingUI.style.display = 'flex';
                if (!floatingUI.style.top || floatingUI.style.top === '') {
                    floatingUI.style.position = 'fixed';
                    floatingUI.style.top = '20px';
                    floatingUI.style.right = '20px';
                    floatingUI.style.left = 'auto';
                }
                
                toggleDictation();
                sendResponse({status: "started"});
            }
        });
    }
}

// Export for Jest testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        insertTextAtCursor,
        initSpeechRecognition,
        injectFloatingUI
    };
}
