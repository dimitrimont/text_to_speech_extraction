/**
 * @jest-environment node
 */
const path = require('path');

const CONTENT_SCRIPT_PATH = path.resolve(__dirname, '../extension-webspeech-api/scripts/content.js');

describe('Extension E2E Test', () => {
    let browser;
    let page;
    let puppeteer;

    beforeAll(async () => {
        // Use dynamic import to support modern Puppeteer ESM
        puppeteer = (await import('puppeteer')).default;
        
        // Launch standard headless Chrome without extension sandboxing restrictions
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    });

    afterAll(async () => {
        if (browser) {
            await browser.close();
        }
    });

    test('Floating microphone UI should appear when an input is focused', async () => {
        expect(browser).toBeTruthy();
        
        page = await browser.newPage();
        
        // Navigate to a blank HTML page
        await page.goto('about:blank');
        
        // Inject a dummy input into the page
        await page.evaluate(() => {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'test-input';
            document.body.appendChild(input);
        });

        // Inject our extension's content script directly into the page
        // This bypasses the strict extension-loading sandbox while still testing our logic!
        await page.addScriptTag({ path: CONTENT_SCRIPT_PATH });
        
        // Mock chrome extension initialization
        await page.evaluate(() => {
            if (typeof window.injectFloatingUI === 'function') {
                window.injectFloatingUI();
            }
        });

        // Trigger focus
        await page.evaluate(() => {
            const el = document.getElementById('test-input');
            el.focus();
            // Force dispatch focusin since synthetic focus sometimes doesn't bubble in headless
            el.dispatchEvent(new Event('focusin', { bubbles: true }));
        });
        
        // Wait for the UI container to be injected by our script
        const uiElement = await page.waitForSelector('#anyfield-dictation-ui', { 
            visible: true, 
            timeout: 2000 
        });
        
        expect(uiElement).toBeTruthy();
    });
});
