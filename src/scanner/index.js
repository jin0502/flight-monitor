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

const { sendTopDealAlerts, sendAuthAlert, sendCaptchaAlert, sendVerificationAlert } = require('../alerts');

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

        // 2. Phase 1: Calendar Scan (GROUPED BY CITY)
        const calendarScanner = new DirectCalendarScanner();
        
        if (targetDest) {
            const airport = airports.find(a => a.code === targetDest);
            if (airport) {
                await processAirportLite(calendarScanner, airport, targetOrigin).catch(e => {
                    if (e.message === 'ZERO_RESULTS') {
                        console.log(`[Orchestrator] Verification Failed for ${airport.code}. Skipping.`);
                    } else {
                        throw e;
                    }
                });
            }
        } else {
            // Identify UNIQUE city codes to avoid redundant scanning
            const uniqueCities = [];
            const seenCityCodes = new Set();

            for (const airport of airports) {
                if (airport.code === targetOrigin) continue;
                if (!seenCityCodes.has(airport.cityCode)) {
                    seenCityCodes.add(airport.cityCode);
                    uniqueCities.push(airport);
                }
            }

            console.log(`[Orchestrator] Starting scans for ${uniqueCities.length} unique cities (${airports.length} total airports)...`);

            for (const cityInfo of uniqueCities) {
                try {
                    await processAirportLite(calendarScanner, cityInfo, targetOrigin);
                } catch (e) {
                    if (e.message === 'ZERO_RESULTS') {
                        console.log(`[Orchestrator] Verification Failed for city: ${cityInfo.city}. Sending alert and continuing.`);
                        await sendVerificationAlert(targetOrigin, cityInfo.code);
                    } else {
                        console.error(`[Orchestrator] Error processing ${cityInfo.city}: ${e.message}`);
                    }
                }
            }
        }

    } catch (err) {
        if (err.message === 'CAPTCHA_TRIGGERED') return;
        if (err.message === 'AUTH_REQUIRED') {
            await sendAuthAlert();
            return;
        }
        console.error(`[Orchestrator] Fatal Error: ${err.message}`);
    } finally {
        if (context) await context.close();
        if (browser) await browser.close();
    }
}

async function processAirportLite(scanner, cityInfo, origin) {
    const db = database.getDB();
    const isDomestic = scanner.isDomesticRoute(origin, cityInfo.code);
    
    // API CALLS:
    // For domestic, use raw code (e.g. CAN). For intl, use city code (e.g. TYO).
    const scanCode = isDomestic ? cityInfo.code : cityInfo.cityCode;
    
    // DB STORAGE:
    // Origin is always SHA (City level). Dest is always cityInfo.cityCode.
    const dbOrigin = 'SHA'; 
    const dbDest = cityInfo.cityCode;

    // 1. Scan Outbound (Shanghai -> Destination)
    console.log(`[Orchestrator] ${isDomestic ? 'Domestic' : 'City'} Scan: ${origin} -> ${cityInfo.city} (${scanCode})`);
    const outItems = await scanner.findCheapDates(origin, scanCode);
    
    for (const item of outItems) {
        await saveFlightPlaceholder(db, dbOrigin, dbDest, item.date, item.price);
    }
    
    // 2. Scan Inbound (Destination -> Shanghai)
    console.log(`[Orchestrator] ${isDomestic ? 'Domestic' : 'City'} Scan: ${cityInfo.city} (${scanCode}) -> ${origin}`);
    const inItems = await scanner.findCheapDates(scanCode, origin);
    
    for (const item of inItems) {
        await saveFlightPlaceholder(db, dbDest, dbOrigin, item.date, item.price);
    }
}

async function saveFlightPlaceholder(db, origin, dest, date, price) {
    if (!price || price <= 0) return; // Ignore invalid data

    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO flights (origin, dest, date, price, updated_at, flight_no, airline)
            VALUES (?, ?, ?, ?, datetime('now'), 'CAL', 'Ctrip Calendar')
            ON CONFLICT(origin, dest, date, flight_no) DO UPDATE SET
                price = excluded.price,
                updated_at = excluded.updated_at
        `;
        db.run(sql, [origin, dest, date, price], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { runFullScan };
