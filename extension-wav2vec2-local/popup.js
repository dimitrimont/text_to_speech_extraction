document.addEventListener('DOMContentLoaded', async () => {
    const toggle = document.getElementById('master-toggle');
    const statusText = document.getElementById('status-text');
    const themeToggle = document.getElementById('theme-toggle');
    const themeText = document.getElementById('theme-text');
    
    // Load current state
    const result = await chrome.storage.local.get(['extensionEnabled', 'widgetTheme']);
    let isEnabled = result.extensionEnabled !== false; // Default true
    let isDark = result.widgetTheme !== 'light'; // Default dark
    
    function updateUI() {
        toggle.checked = isEnabled;
        statusText.textContent = isEnabled ? "Active" : "Disabled";
        statusText.style.color = isEnabled ? "#22d3ee" : "#9ca3af";
        
        themeToggle.checked = isDark;
        themeText.textContent = isDark ? "Dark Theme" : "Light Theme";
        
        // Update popup background styling dynamically
        if (isDark) {
            document.body.style.background = "#111827";
            document.body.style.color = "#f9fafb";
            document.querySelectorAll('.toggle-container').forEach(el => el.style.background = "#1f2937");
            themeText.style.color = "#e5e7eb";
        } else {
            document.body.style.background = "#ffffff";
            document.body.style.color = "#111827";
            document.querySelectorAll('.toggle-container').forEach(el => el.style.background = "#f3f4f6");
            themeText.style.color = "#374151";
            statusText.style.color = isEnabled ? "#4f46e5" : "#6b7280";
        }
    }
    
    updateUI();
    
    toggle.addEventListener('change', async (e) => {
        isEnabled = e.target.checked;
        await chrome.storage.local.set({ extensionEnabled: isEnabled });
        updateUI();
    });
    
    themeToggle.addEventListener('change', async (e) => {
        isDark = e.target.checked;
        await chrome.storage.local.set({ widgetTheme: isDark ? 'dark' : 'light' });
        updateUI();
    });
});
