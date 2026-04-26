const { sendTelegramNotification } = require('./channels/telegram');
const { sendDiscordNotification } = require('./channels/discord');
const cityNames = require('../data/city-names');
const airports = require('../data/airports');

/**
 * Sends alerts for the top flight deals identified by the combination engine.
 */
async function sendTopDealAlerts(deals, db) {
    if (deals.length === 0) return {};
    
    const counts = {};

    for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];
        
        // 1. Resolve Data
        const outInfo = airports.find(a => a.code === deal.out_city_code || a.cityCode === deal.out_city_code);
        if (!outInfo) continue;

        // 2. Routing Logic
        const categoryName = outInfo.region;
        let channelName;

        if (deal.match_level === 'category') {
            channelName = 'general';
        } else {
            // Channel Level Match
            channelName = (outInfo.region === 'Europe' || outInfo.region === 'Southeast Asia') ? outInfo.country : outInfo.city;
        }

        counts[categoryName] = (counts[categoryName] || 0) + 1;

        // 3. Name Resolution
        const originCityName = cityNames['SHA']; 
        const destCityName = cityNames[deal.out_city_code] || deal.out_city_code;
        const retCityName = cityNames[deal.ret_city_code] || deal.ret_city_code;
        const isOpenJaw = deal.out_city_code !== deal.ret_city_code;
        
        let discordMsg = `### ✈️ Deal #${i + 1}: ${destCityName}${isOpenJaw ? ' / ' + retCityName : ''}\n`;
        discordMsg += `> 💰 **TOTAL: ¥${deal.total_price}** (${deal.gap_days} days)\n`;
        discordMsg += `> \n`;
        discordMsg += `> 🛫 **OUT:** ${originCityName} → ${destCityName} (${deal.out_date})\n`;
        discordMsg += `> 🛬 **RET:** ${retCityName} → ${originCityName} (${deal.ret_date})\n\n`;
        
        // 4. Persistence & Notification
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(process.cwd(), 'data/latest_alerts.txt');
        const logEntry = `\n--- [${categoryName} > ${channelName}] Deal #${i+1} ---\n${discordMsg}\n------------------------------------------\n`;
        fs.appendFileSync(logPath, logEntry);

        await sendDiscordNotification(discordMsg, channelName, categoryName).catch(e => {});

        await new Promise((resolve) => {
            db.run('UPDATE flight_combinations SET alerted = 1 WHERE id = ?', [deal.id], () => resolve());
        });
    }

    return counts;
}

async function sendAuthAlert() {
    await sendDiscordNotification(`⚠️ **ACTION REQUIRED: Ctrip Re-authentication Needed**`, 'general', 'System');
}

async function sendCaptchaAlert() {
    await sendDiscordNotification(`🛡️ **ANTI-BOT TRIGGERED: Captcha Detected**`, 'general', 'System');
}

async function sendVerificationAlert(origin, dest) {
    const airportInfo = airports.find(a => a.code === dest || a.cityCode === dest);
    const category = airportInfo?.region || 'System';
    const channel = airportInfo ? ((airportInfo.region === 'Europe' || airportInfo.region === 'Southeast Asia') ? airportInfo.country : airportInfo.city) : 'Verification';
    await sendDiscordNotification(`📉 **API VERIFICATION FAILED: Zero Flights Found for ${dest}**`, channel, category).catch(e => {});
}

module.exports = { sendTopDealAlerts, sendAuthAlert, sendCaptchaAlert, sendVerificationAlert, sendTelegramNotification };
