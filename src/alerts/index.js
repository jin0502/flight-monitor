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
 * @param {string} [priceData.flight_number] The flight number.
 * @param {string} [priceData.departure_time] The departure time.
 * @param {string} [priceData.origin_airport_name] Full name of origin airport.
 * @param {string} [priceData.destination_airport_name] Full name of destination airport.
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
              AND (ph.flight_number = ? OR (ph.flight_number IS NULL AND ? IS NULL))
              AND a.sent_at > datetime('now', '-24 hours')
        `;

        db.get(dedupeSql, [
            priceData.route_id, 
            priceData.price, 
            priceData.travel_date, 
            priceData.airline || null,
            priceData.airline || null,
            priceData.flight_number || null,
            priceData.flight_number || null
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
                const insertPriceSql = `INSERT INTO price_history (route_id, price, scrape_date, travel_date, airline, duration, flight_number, departure_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
                const params = [
                    priceData.route_id,
                    priceData.price,
                    priceData.scrape_date,
                    priceData.travel_date,
                    priceData.airline,
                    priceData.duration,
                    priceData.flight_number,
                    priceData.departure_time
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
                    const originName = priceData.origin_airport_name || row.origin;
                    const destinationName = priceData.destination_airport_name || row.destination;

                    // Construct alert message (HTML for Telegram)
                    let alertMsg = `🚀 <b>Flight Alert!</b>\n\n`;
                    alertMsg += `📍 <b>Route:</b> ${originName} ✈️ ${destinationName}\n`;
                    alertMsg += `💰 <b>Price:</b> <b>¥${priceData.price}</b>\n`;
                    alertMsg += `📅 <b>Date:</b> ${priceData.travel_date}\n`;
                    
                    if (priceData.departure_time && priceData.departure_time !== 'N/A') {
                        alertMsg += `⏰ <b>Takeoff:</b> ${priceData.departure_time}\n`;
                    }
                    
                    if (priceData.flight_number && priceData.flight_number !== 'N/A') {
                        alertMsg += `🔢 <b>Flight No:</b> ${priceData.flight_number}\n`;
                    }
                    
                    alertMsg += `🏢 <b>Airline:</b> ${priceData.airline || 'Unknown'}\n\n`;
                    alertMsg += `⚠️ <b>Type:</b> ${alertsToCreate.map(a => a.type).join(', ')}`;

                    // Discord message (Markdown, plain text formatting)
                    const discordMsg = alertMsg.replace(/<b>/g, '**').replace(/<\/b>/g, '**');

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
                    sendTelegramNotification(alertMsg).catch(e => console.error('Telegram Error:', e.message));
                    
                    // Route Discord by country
                    sendDiscordNotification(discordMsg, row.destination).catch(e => console.error('Discord Error:', e.message));

                    resolve(true);
                });
            });
        });
    });
}

module.exports = {
    checkAlerts
};
