document.getElementById('force-dictate-btn').addEventListener('click', async () => {
    // Get the currently active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
        // Send a message to the content script in that tab
        chrome.tabs.sendMessage(tab.id, { action: "forceToggleDictation" }, (response) => {
            // Close the popup window after clicking
            window.close();
        });
    }
});
