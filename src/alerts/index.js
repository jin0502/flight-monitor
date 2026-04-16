const { sendTelegramNotification } = require('./channels/telegram');
const { sendDiscordNotification } = require('./channels/discord');

/**
 * Checks current price against historical data and triggers alerts if necessary.
 *
 * Compares the scraped price with user-defined thresholds and historical averages.
 * Triggers alerts for significant price drops or when a price is below a threshold.
 * Limits duplicate alerts for the same price/route combination within 24 hours.
 *
 * @param {Object} priceData The scraped flight data.
 * @param {number} priceData.route_id The ID of the monitored route.
 * @param {number} priceData.price The scraped flight price.
 * @param {string} priceData.scrape_date The ISO string of the scrape date.
 * @param {string} priceData.travel_date The ISO string of the travel date.
 * @param {string} [priceData.airline] The airline name.
 * @param {string} [priceData.duration] The flight duration.
 * @param {import('sqlite3').Database} db The database instance.
 * @returns {Promise<boolean>} True if an alert was triggered, false otherwise.
 */
async function checkAlerts(priceData, db) {
    return new Promise((resolve, reject) => {
        // 1. Deduplication: Check if same alert was sent recently (last 24h)
        const dedupeSql = `
            SELECT a.id 
            FROM alerts a 
            JOIN price_history ph ON a.price_history_id = ph.id 
            WHERE ph.route_id = ? 
              AND ph.price = ? 
              AND ph.travel_date = ? 
              AND (ph.airline = ? OR (ph.airline IS NULL AND ? IS NULL))
              AND a.sent_at > datetime('now', '-24 hours')
        `;

        db.get(dedupeSql, [
            priceData.route_id, 
            priceData.price, 
            priceData.travel_date, 
            priceData.airline || null,
            priceData.airline || null
        ], (err, existingAlert) => {
            if (err) return reject(err);
            if (existingAlert) {
                return resolve(false); // Already alerted
            }

            // 2. Get route threshold and historical average
            const getRouteInfoSql = `
                SELECT 
                    mr.origin,
                    mr.destination,
                    mr.alert_threshold,
                    AVG(ph.price) as avg_price,
                    COUNT(ph.price) as history_count
                FROM monitored_routes mr
                LEFT JOIN price_history ph ON mr.id = ph.route_id
                WHERE mr.id = ?
                GROUP BY mr.id
            `;

            db.get(getRouteInfoSql, [priceData.route_id], (err, row) => {
                if (err) return reject(err);
                if (!row) return reject(new Error('Route not found'));

                // 3. Insert into price_history
                const insertPriceSql = `INSERT INTO price_history (route_id, price, scrape_date, travel_date, airline, duration) VALUES (?, ?, ?, ?, ?, ?)`;
                const params = [
                    priceData.route_id,
                    priceData.price,
                    priceData.scrape_date,
                    priceData.travel_date,
                    priceData.airline,
                    priceData.duration
                ];

                db.run(insertPriceSql, params, async function(err) {
                    if (err) return reject(err);
                    
                    const priceHistoryId = this.lastID;
                    const alertsToCreate = [];

                    // 4. Compare with threshold
                    if (row.alert_threshold && priceData.price <= row.alert_threshold) {
                        alertsToCreate.push({ type: 'THRESHOLD' });
                    }

                    // 5. Compare with historical average (Price Drop > 20%)
                    if (row.history_count >= 3 && row.avg_price) {
                        const priceDropRatio = (row.avg_price - priceData.price) / row.avg_price;
                        if (priceDropRatio >= 0.20) {
                            alertsToCreate.push({ type: 'PRICE_DROP' });
                        }
                    }

                    if (alertsToCreate.length === 0) {
                        return resolve(false);
                    }

                    // 6. Create alerts and send notifications
                    let completed = 0;
                    let hasError = false;
                    
                    // Construct alert message
                    const alertMsg = `<b>Flight Alert!</b>\nRoute: ${row.origin} -> ${row.destination}\nPrice: <b>¥${priceData.price}</b>\nDate: ${priceData.travel_date}\nAirline: ${priceData.airline || 'Unknown'}\nType: ${alertsToCreate.map(a => a.type).join(', ')}`;

                    for (const alert of alertsToCreate) {
                        const insertAlertSql = `INSERT INTO alerts (price_history_id, sent_at, type) VALUES (?, ?, ?)`;
                        await new Promise((res, rej) => {
                            db.run(insertAlertSql, [priceHistoryId, new Date().toISOString(), alert.type], (err) => {
                                if (err) rej(err);
                                else res();
                            });
                        });
                    }

                    // Send notifications (async, don't block the loop)
                    const telegramPromise = sendTelegramNotification(alertMsg);
                    if (telegramPromise && typeof telegramPromise.catch === 'function') {
                        telegramPromise.catch(e => console.error('Telegram Error:', e.message));
                    }
                    
                    const discordPromise = sendDiscordNotification(alertMsg);
                    if (discordPromise && typeof discordPromise.catch === 'function') {
                        discordPromise.catch(e => console.error('Discord Error:', e.message));
                    }

                    resolve(true);
                });
            });
        });
    });
}

module.exports = {
    checkAlerts
};
