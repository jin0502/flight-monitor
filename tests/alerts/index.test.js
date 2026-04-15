const { checkAlerts } = require('../../src/alerts/index');
const { sendTelegramNotification } = require('../../src/alerts/channels/telegram');
const { sendDiscordNotification } = require('../../src/alerts/channels/discord');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

jest.mock('../../src/alerts/channels/telegram');
jest.mock('../../src/alerts/channels/discord');

describe('Alert Engine', () => {
    let db;

    beforeEach((done) => {
        jest.clearAllMocks();
        // Use an in-memory database for testing
        db = new sqlite3.Database(':memory:', (err) => {
            if (err) return done(err);
            
            const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            db.exec(schema, (err) => {
                if (err) return done(err);
                
                // Add test route
                db.run('INSERT INTO monitored_routes (origin, destination, region, search_type, alert_threshold) VALUES (?, ?, ?, ?, ?)', 
                    ['PVG', 'NRT', 'East Asia', 'one-way', 2000], (err) => {
                        if (err) return done(err);
                        done();
                    });
            });
        });
    });

    afterEach((done) => {
        db.close(done);
    });

    test('should trigger threshold-based alert', (done) => {
        const priceData = {
            route_id: 1,
            price: 1500,
            scrape_date: new Date().toISOString(),
            travel_date: '2026-05-01',
            airline: 'JAL',
            duration: '3h'
        };

        checkAlerts(priceData, db).then(alertTriggered => {
            expect(alertTriggered).toBe(true);
            
            // Check if alert was saved in the database
            db.get('SELECT * FROM alerts', (err, row) => {
                expect(row).toBeDefined();
                expect(row.type).toBe('THRESHOLD');
                done();
            });
        }).catch(done);
    });

    test('should trigger price drop alert based on historical average', (done) => {
        // Add historical data: average 2000
        const historyData = [
            [1, 2000, '2026-04-10', '2026-05-01'],
            [1, 2100, '2026-04-11', '2026-05-01'],
            [1, 1900, '2026-04-12', '2026-05-01']
        ];
        
        let completed = 0;
        historyData.forEach(data => {
            db.run('INSERT INTO price_history (route_id, price, scrape_date, travel_date) VALUES (?, ?, ?, ?)', data, () => {
                completed++;
                if (completed === historyData.length) {
                    // Average is 2000. 20% drop means price <= 1600.
                    const priceData = {
                        route_id: 1,
                        price: 1500,
                        scrape_date: new Date().toISOString(),
                        travel_date: '2026-05-01',
                        airline: 'JAL',
                        duration: '3h'
                    };

                    checkAlerts(priceData, db).then(alertTriggered => {
                        expect(alertTriggered).toBe(true);
                        
                        // Check if alert was saved in the database
                        db.all('SELECT * FROM alerts WHERE type = ?', ['PRICE_DROP'], (err, rows) => {
                            expect(rows.length).toBeGreaterThan(0);
                            done();
                        });
                    }).catch(done);
                }
            });
        });
    });

    test('should not trigger alert if the same price was already alerted recently', (done) => {
        const priceData = {
            route_id: 1,
            price: 1500,
            scrape_date: new Date().toISOString(),
            travel_date: '2026-05-01',
            airline: 'JAL',
            duration: '3h'
        };

        // First alert
        checkAlerts(priceData, db).then(alertTriggeredFirst => {
            expect(alertTriggeredFirst).toBe(true);
            
            // Second alert for the same data
            checkAlerts(priceData, db).then(alertTriggeredSecond => {
                expect(alertTriggeredSecond).toBe(false);
                
                // Total alerts should still be 1
                db.all('SELECT * FROM alerts', (err, rows) => {
                    expect(rows.length).toBe(1);
                    done();
                });
            }).catch(done);
        }).catch(done);
    });

    test('should send notifications when alert is triggered', (done) => {
        const priceData = {
            route_id: 1,
            price: 1500,
            scrape_date: new Date().toISOString(),
            travel_date: '2026-05-01',
            airline: 'JAL',
            duration: '3h',
            origin: 'PVG',
            destination: 'NRT'
        };

        checkAlerts(priceData, db).then(alertTriggered => {
            expect(alertTriggered).toBe(true);
            
            // Check if notifications were sent
            expect(sendTelegramNotification).toHaveBeenCalled();
            expect(sendDiscordNotification).toHaveBeenCalled();
            done();
        }).catch(done);
    });
});
