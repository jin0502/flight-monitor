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
 * @param {string} [priceData.return_date] The return travel date.
 * @param {string} [priceData.return_flight_number] The return flight number.
 * @param {string} [priceData.return_departure_time] The return departure time.
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
                const params = [
                    priceData.route_id,
                    priceData.price,
                    priceData.scrape_date,
                    priceData.travel_date,
                    priceData.airline,
                    priceData.duration,
                    priceData.flight_number,
                    priceData.departure_time,
                    priceData.return_date,
                    priceData.return_flight_number,
                    priceData.return_departure_time
                ];

                const insertPriceSql = `
                    INSERT INTO price_history (
                        route_id, price, scrape_date, travel_date, airline, duration, flight_number, departure_time,
                        return_date, return_flight_number, return_departure_time
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.run(insertPriceSql, params, async function(err) {
                    if (err) return reject(err);
                    
                    const priceHistoryId = this.lastID;
                    const alertsToCreate = [];

                    // 4. Compare with threshold
                    if (row.alert_threshold && priceData.price <= row.alert_threshold) {
                        alertsToCreate.push({ type: 'THRESHOLD' });
                    }

                    // 5. Compare with Day-Specific Minimum (PRICE_DROP)
                    // We query the lowest price ever seen for this specific travel date
                    const getMinForDateSql = `
                        SELECT MIN(price) as min_price 
                        FROM price_history 
                        WHERE route_id = ? AND travel_date = ?
                    `;
                    
                    await new Promise((res, rej) => {
                        db.get(getMinForDateSql, [priceData.route_id, priceData.travel_date], (err, minRow) => {
                            if (err) return rej(err);
                            
                            // If no history for this date yet, we don't alert PRICE_DROP 
                            // (it will be the baseline for next time)
                            if (minRow && minRow.min_price && priceData.price < minRow.min_price) {
                                alertsToCreate.push({ type: 'PRICE_DROP' });
                            }
                            res();
                        });
                    });

                    if (alertsToCreate.length === 0) {
                        // Still insert to DB so it becomes the new baseline if it's the lowest
                        return resolve(false);
                    }

                    // 6. Create alerts and send notifications
                    const originCode = priceData.origin_airport || row.origin;
                    const destinationCode = priceData.destination_airport || row.destination;

                    // Construct alert message (HTML for Telegram)
                    let alertMsg = `🚀 <b>Flight Alert!</b>\n\n`;
                    alertMsg += `📍 <b>Route:</b> ${originCode} ✈️ ${destinationCode}\n`;
                    
                    const priceLabel = priceData.return_date ? '(Round-Trip)' : '';
                    alertMsg += `💰 <b>Price:</b> <b>¥${priceData.price}</b> ${priceLabel}\n`;
                    alertMsg += `📅 <b>Date:</b> ${priceData.travel_date}\n`;
                    
                    if (priceData.departure_time && priceData.departure_time !== 'N/A') {
                        alertMsg += `⏰ <b>Takeoff:</b> ${priceData.departure_time}\n`;
                    }
                    
                    if (priceData.flight_number && priceData.flight_number !== 'N/A') {
                        alertMsg += `🔢 <b>Flight No:</b> ${priceData.flight_number}\n`;
                    }
                    
                    alertMsg += `🏢 <b>Airline:</b> ${priceData.airline || 'Unknown'}\n`;
                    
                    // Return Flight info for Round Trips
                    if (priceData.return_date) {
                        alertMsg += `\n--- <b>RETURN FLIGHT</b> ---\n`;
                        alertMsg += `📅 <b>Date:</b> ${priceData.return_date}\n`;
                        
                        const hasReturnDetails = priceData.return_flight_number && 
                            priceData.return_flight_number !== 'N/A' && 
                            priceData.return_flight_number !== '';
                            
                        if (hasReturnDetails) {
                            if (priceData.return_departure_time && priceData.return_departure_time !== 'N/A') {
                                alertMsg += `⏰ <b>Takeoff:</b> ${priceData.return_departure_time}\n`;
                            }
                            alertMsg += `🔢 <b>Flight No:</b> ${priceData.return_flight_number}\n`;
                            alertMsg += `🏢 <b>Airline:</b> ${priceData.return_airline || 'Unknown'}\n`;
                        } else {
                            alertMsg += `🔄 <b>Status:</b> Auto-selected by system for best price\n`;
                        }
                    }
                    
                    alertMsg += `\n⚠️ <b>Type:</b> ${alertsToCreate.map(a => a.type).join(', ')}\n`;

                    // Simple YYYY-MM-DD HH:mm format for Scraped At
                    const simpleScrapedAt = priceData.scrape_date
                        .replace('T', ' ')
                        .substring(0, 16);
                    alertMsg += `📅 <b>Scraped At:</b> ${simpleScrapedAt}`;

                    // Discord message (Markdown, plain text formatting)
                    const discordMsg = alertMsg.replace(/<b>/g, '**').replace(/<\/b>/g, '**');

                    for (const alert of alertsToCreate) {
                        const insertAlertSql = `INSERT INTO alerts (price_history_id, sent_at, type) VALUES (?, ?, ?)`;
                        const now = new Date();
                        const gmt8SentAt = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().replace('Z', '+08:00');
                        
                        await new Promise((res, rej) => {
                            db.run(insertAlertSql, [priceHistoryId, gmt8SentAt, alert.type], (err) => {
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
