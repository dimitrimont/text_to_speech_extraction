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
            insertTextAtCursor(activeField, finalTranscript + ' ');
        }
    };
    
    rec.onend = () => {
        if (isRecording) {
            rec.start(); // auto-restart if still supposed to be recording
        } else {
            stopVisualization();
        }
    };
    
    return rec;
}

// Safely insert text to handle React/Vue/Angular controlled inputs
function insertTextAtCursor(element, text) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const currentValue = element.value;
        element.value = currentValue.slice(0, start) + text + currentValue.slice(end);
        
        // Dispatch events so SPAs notice the change
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        
        element.selectionStart = element.selectionEnd = start + text.length;
    } else if (element.isContentEditable) {
        document.execCommand('insertText', false, text);
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
    
    micBtn.addEventListener('click', toggleDictation);
}

// Show UI near active field
function showUI(field) {
    if (!floatingUI) injectFloatingUI();
    const rect = field.getBoundingClientRect();
    
    floatingUI.style.display = 'flex';
    floatingUI.style.top = `${window.scrollY + rect.top - 40}px`;
    floatingUI.style.left = `${window.scrollX + rect.left + rect.width - 150}px`;
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
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
            if (el.type !== 'password' && el.type !== 'hidden') {
                activeField = el;
                showUI(el);
            }
        }
    });

    document.addEventListener('focusout', (e) => {
        setTimeout(() => {
            if (!isRecording && document.activeElement !== activeField) {
                hideUI();
            }
        }, 200);
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
