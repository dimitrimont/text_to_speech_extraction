// Background service worker for AnyField Dictation
chrome.runtime.onInstalled.addListener(() => {
    console.log("AnyField Dictation installed successfully.");
});

// Coordinate microphone lock across multiple tabs/windows
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "requestMicrophoneLock") {
        // Broadcast to ALL tabs to stop recording, EXCEPT the one that requested it
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

