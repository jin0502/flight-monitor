const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { USER_AGENT } = require('../utils/config');

/**
 * HEADLESS REMOTE LOGIN TOOL
 * Designed for VPS environments without X11.
 * Works by:
 * 1. Opening the login page headlessly.
 * 2. Taking periodic screenshots of the page.
 * 3. Letting the user type text or click by coordinates if needed (advanced).
 * 4. Most importantly, it waits for the user to login via SMS/QR code (if visible in screenshot).
 */
async function headlessLogin() {
    console.log('--- HEADLESS REMOTE LOGIN TOOL ---');
    const userDataDir = path.join(process.cwd(), 'data/ctrip_session');
    const cookiesPath = path.join(process.cwd(), 'data/cookies.json');
    const screenshotPath = path.join(process.cwd(), 'login-preview.png');
    
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

    const isHeadless = process.env.HEADLESS === 'true' || !process.env.DISPLAY;
    console.log(`[1/3] Launching browser (Headless: ${isHeadless})...`);

    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: isHeadless, 
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 800 },
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await context.newPage();
    console.log('[2/3] Navigating to Ctrip Login...');
    await page.goto('https://passport.ctrip.com/user/login', { waitUntil: 'networkidle' });

    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const loop = async () => {
        await page.screenshot({ path: screenshotPath });
        console.log(`\n📸 Screenshot updated: ${screenshotPath}`);
        console.log('Current URL:', page.url());
        
        console.log('\nCommands:');
        console.log('  s            - Refresh screenshot');
        console.log('  t <text>     - Type text into active element');
        console.log('  k <key>      - Press key (e.g. "Enter", "Tab")');
        console.log('  c <x> <y>    - Click at coordinates');
        console.log('  save         - Save session and exit');
        console.log('  quit         - Exit without saving');

        readline.question('\nCommand: ', async (input) => {
            const [cmd, ...args] = input.split(' ');

            try {
                if (cmd === 's') {
                    // Just loop
                } else if (cmd === 't') {
                    await page.keyboard.insertText(args.join(' '));
                } else if (cmd === 'k') {
                    await page.keyboard.press(args[0]);
                } else if (cmd === 'c') {
                    await page.mouse.click(parseInt(args[0]), parseInt(args[1]));
                } else if (cmd === 'save') {
                    console.log('Capturing cookies...');
                    await page.goto('https://www.ctrip.com', { waitUntil: 'domcontentloaded' });
                    const cookies = await context.cookies();
                    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
                    console.log(`SUCCESS: ${cookies.length} cookies saved.`);
                    await context.close();
                    process.exit(0);
                } else if (cmd === 'quit') {
                    await context.close();
                    process.exit(0);
                }
            } catch (err) {
                console.error('Error:', err.message);
            }
            
            await loop();
        });
    };

    await loop();
}

headlessLogin().catch(console.error);
