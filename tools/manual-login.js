const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function launchManualLogin() {
    console.log('--- CTRIP MANUAL LOGIN ASSISTANT ---');
    console.log('1. A visible browser will open shortly.');
    console.log('2. Please log in to your Ctrip account.');
    console.log('3. Complete any captchas or SMS verifications.');
    console.log('4. Once you see flight results, simply CLOSE THE BROWSER.');
    console.log('------------------------------------');

    const userDataDir = path.join(process.cwd(), 'data/ctrip_session');
    
    // Ensure the directory exists
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, // Make it visible
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    
    console.log('Navigating to Ctrip... please wait for the window.');
    
    try {
        // Relaxed wait condition and longer timeout for slow VPS networks
        await page.goto('https://flights.ctrip.com/international/search/oneway-pvg-kix?depdate=2026-10-06', {
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });
    } catch (err) {
        console.log('Note: Page took a long time to load, but the browser should be open now.');
    }

    console.log('------------------------------------');
    console.log('Waiting for you to finish login in the browser window...');
    console.log('CLOSE THE BROWSER only after you are logged in.');
    
    // Keep process alive until browser is closed
    await new Promise(resolve => {
        context.on('close', resolve);
    });
    
    console.log('Browser closed. Session saved to data/ctrip_session.');
}

launchManualLogin().catch(err => {
    console.error('Failed to launch browser:', err.message);
});
