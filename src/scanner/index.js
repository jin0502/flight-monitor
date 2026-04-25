const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const DirectCalendarScanner = require('./direct-calendar-scanner');
const OneWayScanner = require('./oneway-scanner');
const CombinationEngine = require('./combination-engine');
const airports = require('../data/airports');
const database = require('../db');
const { USER_AGENT } = require('../utils/config');

const { sendTopDealAlerts, sendAuthAlert, sendCaptchaAlert } = require('../alerts');

async function runFullScan(targetOrigin = 'PVG', targetDest = null) {
    console.log(`[Orchestrator] Starting LITE scan (Stealth Mode). Origin: ${targetOrigin}`);
    
    let isHeadless = process.env.HEADLESS === 'true' || process.argv.includes('--headless');
    if (process.env.HEADLESS === undefined && process.platform === 'linux' && !process.env.DISPLAY) {
        isHeadless = true;
    }

    const userDataDir = path.resolve(__dirname, '../../data/ctrip_session');
    let context;
    let browser;

    try {
        const launchOptions = {
            headless: isHeadless,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--use-gl=desktop'
            ]
        };

        // 1. Browser Check (Captcha Detection)
        console.log(`[Orchestrator] Performing anti-bot check...`);
        if (fs.existsSync(userDataDir)) {
            context = await chromium.launchPersistentContext(userDataDir, launchOptions);
        } else {
            browser = await chromium.launch(launchOptions);
            context = await browser.newContext({ userAgent: USER_AGENT });
        }

        const page = await context.newPage();
        
        // Add random jitter
        const jitter = Math.floor(Math.random() * 2000) + 1000;
        await new Promise(r => setTimeout(r, jitter));

        let captchaFound = false;
        page.on('console', msg => {
            if (msg.text().includes('showCaptchaModal2')) captchaFound = true;
        });

        await page.goto('https://flights.ctrip.com/', { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 5000)); // Wait for stealth scripts

        if (captchaFound) {
            console.log(`[Orchestrator] CRITICAL: showCaptchaModal2 detected. Stopping.`);
            await sendCaptchaAlert();
            throw new Error('CAPTCHA_TRIGGERED');
        }

        // 2. Phase 1: Calendar Scan
        const calendarScanner = new DirectCalendarScanner();
        
        if (targetDest) {
            const airport = airports.find(a => a.code === targetDest);
            if (airport) await processAirportLite(calendarScanner, airport, targetOrigin);
        } else {
            for (const airport of airports) {
                if (airport.code === targetOrigin) continue;
                await processAirportLite(calendarScanner, airport, targetOrigin);
            }
        }

    } catch (err) {
        if (err.message === 'CAPTCHA_TRIGGERED') return;
        if (err.message === 'AUTH_REQUIRED') {
            await sendAuthAlert();
            return;
        }
        console.error(`[Orchestrator] Error: ${err.message}`);
    } finally {
        if (context) await context.close();
        if (browser) await browser.close();
    }
}

async function processAirportLite(scanner, airport, origin) {
    const db = database.getDB();
    
    // 1. Scan Outbound (Shanghai -> Destination)
    const outItems = await scanner.findCheapDates(origin, airport.code);
    for (const item of outItems) {
        await saveFlightPlaceholder(db, origin, airport.code, item.date, item.price);
    }
    
    // 2. Scan Inbound (Destination -> Shanghai)
    const inItems = await scanner.findCheapDates(airport.code, origin);
    for (const item of inItems) {
        await saveFlightPlaceholder(db, airport.code, origin, item.date, item.price);
    }
}

async function saveFlightPlaceholder(db, origin, dest, date, price) {
    return new Promise((resolve, reject) => {
        const scrapeDate = new Date().toISOString();
        const sql = `
            INSERT INTO flights (origin, dest, date, price, updated_at, flight_no, airline)
            VALUES (?, ?, ?, ?, ?, 'CAL', 'Ctrip Calendar')
            ON CONFLICT(origin, dest, date, flight_no) DO UPDATE SET
                price = excluded.price,
                updated_at = excluded.updated_at
        `;
        db.run(sql, [origin, dest, date, price, scrapeDate], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { runFullScan };
