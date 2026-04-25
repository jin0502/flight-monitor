const { chromium } = require('playwright');

async function checkKixBotDetection() {
    console.log('--- CHECKING KIX BOT DETECTION (PVG -> KIX) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('batchSearch') || url.includes('search/pull')) {
            console.log(`API Found: ${url.split('?')[0]} (Status: ${response.status()})`);
        }
    });

    try {
        await page.goto('https://flights.ctrip.com/online/list/oneway-pvg-kix?depdate=2026-05-25', { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(10000);
        
        await page.screenshot({ path: 'scratch/kix-fail.png' });
        console.log('Screenshot saved to scratch/kix-fail.png');
        
        const content = await page.content();
        if (content.includes('验证码') || content.includes('机器人') || content.includes('verify')) {
            console.log('BOT DETECTION DETECTED!');
        } else {
            console.log('No obvious bot detection in HTML.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

checkKixBotDetection();
