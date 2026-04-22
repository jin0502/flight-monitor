const { chromium } = require('playwright');
const fs = require('fs');

async function inspectBookingFlow() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    await page.goto('https://flights.ctrip.com/online/list/round-sha-tyo?depdate=2026-06-10_2026-06-15', { waitUntil: 'domcontentloaded' });
    
    try { await page.waitForSelector('.flight-item', { timeout: 20000 }); } catch(e) {}
    await page.waitForTimeout(5000);
    
    const items = await page.$$('.flight-item');
    console.log(`Found ${items.length} flight items`);
    
    if (items.length > 0) {
        const item = items[0];
        
        // Find the book/price button
        const btn = await item.$('.btn-book, [class*="price"] button, .flight-operate .btn');
        if (btn) {
            console.log('Clicking the book/price button on the first flight item...');
            await btn.click({ force: true });
            
            // Wait for whatever happens next
            await page.waitForTimeout(5000);
            
            // Dump the visible text of the page to see if we transitioned to a new step
            const bodyText = await page.evaluate(() => document.body.innerText);
            fs.writeFileSync('scratch/step2_body.txt', bodyText);
            
            // Look for return flight indicators
            const returnInfo = await page.evaluate(() => {
                const results = [];
                // Look for flight items again (maybe it's a new list of return flights)
                const newItems = document.querySelectorAll('.flight-item');
                results.push(`Found ${newItems.length} flight items on current view`);
                
                // Look for selected outbound flight sticky header
                const sticky = document.querySelectorAll('.selected-flight, [class*="selected"], [class*="step"]');
                for (const el of sticky) {
                    if (el.offsetHeight > 0 && el.innerText) {
                        results.push(`Sticky/Step info: ${el.innerText.substring(0, 200).replace(/\n/g, ' ')}`);
                    }
                }
                
                // Look for anything mentioning "回程"
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    if (el.offsetHeight > 0 && el.children.length === 0 && el.innerText.includes('回程')) {
                        let parent = el.parentElement;
                        while(parent && parent.children.length < 5 && parent.innerText.length < 300) {
                            parent = parent.parentElement;
                        }
                        if (parent) {
                            results.push(`Found 回程 in context: ${parent.innerText.substring(0, 300).replace(/\n/g, ' ')}`);
                        }
                    }
                }
                return [...new Set(results)]; // unique
            });
            
            console.log('\nWhat happened after click:');
            for (const r of returnInfo) {
                console.log(r);
            }
        } else {
            console.log('Could not find book button');
        }
    }
    
    await browser.close();
}

inspectBookingFlow().catch(console.error);
