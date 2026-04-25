const { chromium } = require('playwright');
const path = require('path');

async function analyzeCookies() {
    const userDataDir = path.join(process.cwd(), 'data/ctrip_session');
    console.log(`Analyzing session in: ${userDataDir}`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true
    });

    const cookies = await context.cookies();
    console.log(`\nFound ${cookies.length} total cookies.`);

    // Group by domain
    const ctripCookies = cookies.filter(c => c.domain.includes('ctrip.com'));
    console.log(`Ctrip.com specific cookies: ${ctripCookies.length}`);

    console.log('\n--- KEY CTRIP COOKIES ---');
    const now = Math.floor(Date.now() / 1000);

    ctripCookies.forEach(c => {
        const expiresAt = c.expires === -1 ? 'SESSION' : new Date(c.expires * 1000).toISOString();
        if (c.expires === -1 || c.name.toLowerCase().includes('ticket') || c.name.toLowerCase().includes('uid')) {
            console.log(`[${c.domain}] ${c.name.padEnd(25)} | Expires: ${expiresAt}`);
        }
    });

    const page = await context.newPage();
    await page.goto('https://www.ctrip.com', { waitUntil: 'networkidle' });
    
    console.log('\n--- LOCAL STORAGE (CTRIP) ---');
    const storage = await page.evaluate(() => {
        const items = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.includes('auth') || key.includes('user') || key.includes('login') || key.includes('Ticket')) {
                items[key] = localStorage.getItem(key).substring(0, 50) + '...';
            }
        }
        return items;
    });
    console.log(JSON.stringify(storage, null, 2));

    await context.close();
}

analyzeCookies().catch(console.error);
