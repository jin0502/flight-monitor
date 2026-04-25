const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { USER_AGENT } = require('../utils/config');

async function remoteLogin() {
    console.log('--- REMOTE LOGIN TOOL (JSON PERSISTENCE) ---');
    const userDataDir = path.join(process.cwd(), 'data/ctrip_session');
    const cookiesPath = path.join(process.cwd(), 'data/cookies.json');
    
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false, 
        userAgent: USER_AGENT,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await context.newPage();
    await page.goto('https://passport.ctrip.com/user/login');

    console.log('\n--- ACTION REQUIRED ---');
    console.log('1. Complete the login.');
    console.log('2. Type "save" here and press ENTER.');

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('\nType "save" to finish: ', async () => {
        console.log('Capturing and saving cookies to JSON...');
        
        // Go to homepage to ensure all cookies are set
        try {
            await page.goto('https://www.ctrip.com', { waitUntil: 'domcontentloaded' });
        } catch (e) {}

        const cookies = await context.cookies();
        const hasTicket = cookies.some(c => c.name.toLowerCase().includes('ticket'));
        
        fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
        console.log(`\nSUCCESS: ${cookies.length} cookies saved to ${cookiesPath}`);
        console.log(`Auth Token (cticket) Found: ${hasTicket ? 'YES ✅' : 'NO ❌'}`);

        await context.close();
        process.exit(0);
    });
}

remoteLogin().catch(console.error);
