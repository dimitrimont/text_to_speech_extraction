/**
 * @jest-environment node
 */
const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '../extension');

describe('Extension E2E Test', () => {
    let browser;
    let page;

    beforeAll(async () => {
        // Launch Chrome with the extension loaded
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
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
        
        // Navigate to a real HTTP page (content scripts don't run on file:// by default)
        await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
        
        // Inject a dummy input into the page
        await page.evaluate(() => {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'test-input';
            document.body.appendChild(input);
        });

        // Focus the input field
        await page.focus('#test-input');
        
        // Wait for the UI container to be injected by the content script
        const uiElement = await page.waitForSelector('#anyfield-dictation-ui', { 
            visible: true, 
            timeout: 5000 
        });
        
        expect(uiElement).toBeTruthy();
        
        // Ensure the mic button is present
        const micBtn = await page.$('#anyfield-mic-btn');
        expect(micBtn).toBeTruthy();
    });
});
