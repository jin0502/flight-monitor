const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function remoteLogin() {
    console.log('--- REMOTE LOGIN TOOL ---');
    const userDataDir = path.join(process.cwd(), 'data/ctrip_session');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    console.log('Launching browser with remote debugging on port 9222...');
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: true, // Keep it headless on VPS
        args: [
            '--remote-debugging-port=9222',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    const page = await context.newPage();
    await page.goto('https://passport.ctrip.com/user/login');

    console.log('\nSUCCESS: Browser is running.');
    console.log('1. On your LOCAL machine, run: ssh -L 9222:localhost:9222 root@YOUR_VPS_IP');
    console.log('2. Open Chrome locally and go to: chrome://inspect/#devices');
    console.log('3. Click "inspect" on the Ctrip page and perform the login.');
    console.log('\nPress Ctrl+C here once you have finished logging in to save the session.');

    // Keep the process alive
    process.stdin.resume();
}

remoteLogin().catch(console.error);
