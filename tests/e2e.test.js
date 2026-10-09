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
        
        // Navigate to a real HTTP page
        await page.goto('https://example.com', { waitUntil: 'networkidle0' });
        
        // Inject a dummy input into the page
        await page.evaluate(() => {
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'test-input';
            // Give it some size so it's clickable
            input.style.width = '200px';
            input.style.height = '40px';
            document.body.appendChild(input);
        });

        // Click the input field to trigger 'focusin' reliably
        await page.click('#test-input');
        
        // Optionally, dispatch focusin manually if puppeteer click doesn't bubble it as expected
        await page.evaluate(() => {
            document.getElementById('test-input').dispatchEvent(new Event('focusin', { bubbles: true }));
        });
        
        // Wait for the UI container to be injected by the content script
        const uiElement = await page.waitForSelector('#anyfield-dictation-ui', { 
            visible: true, 
            timeout: 5000 
        });
        
        expect(uiElement).toBeTruthy();
    });
});
