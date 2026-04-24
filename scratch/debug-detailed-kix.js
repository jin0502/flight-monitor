const { chromium } = require('playwright');

async function debugDetailedKIX() {
    console.log('--- DEBUG DETAILED (PVG -> KIX) ---');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    let capturedResponse = null;
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/getFlightList') || url.includes('/search/pull/')) {
            try {
                capturedResponse = await response.json();
                console.log(`Captured API: ${url}`);
            } catch (e) {}
        }
    });

    try {
        const url = 'https://flights.ctrip.com/online/list/oneway-pvg-kix?depdate=2026-05-25';
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(10000); // Give it extra time
        
        if (capturedResponse) {
            const list = capturedResponse.data?.flightItineraryList || capturedResponse.result?.flightItineraryList || capturedResponse.flightItineraryList;
            if (list && list.length > 0) {
                console.log(`Total flights: ${list.length}`);
                console.log('First flight price list:', JSON.stringify(list[0].priceList, null, 2));
            } else {
                console.log('API found but flight list is empty.');
                console.log('Response structure keys:', Object.keys(capturedResponse));
            }
        } else {
            console.log('No detailed API captured.');
            // Check if page shows any error
            const content = await page.content();
            if (content.includes('验证码') || content.includes('机器人')) {
                console.log('Detected: Captcha/Bot detection active.');
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await browser.close();
    }
}

debugDetailedKIX();
