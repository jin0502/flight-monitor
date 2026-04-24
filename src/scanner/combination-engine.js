const { getDB } = require('../db');

class CombinationEngine {
    constructor() {}

    /**
     * Generates flight combinations from stored one-way flights.
     * Picks top 5 deals for alerts.
     */
    async generateCombinations() {
        console.log('[CombinationEngine] Generating combinations...');
        const db = getDB();

        // 1. Get all outbound flights (PVG/SHA -> Any)
        const outbounds = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM oneway_flights WHERE origin IN ('PVG', 'SHA')", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 2. Get all inbound flights (Any -> PVG/SHA)
        const inbounds = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM oneway_flights WHERE destination IN ('PVG', 'SHA')", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        const combinations = [];

        for (const outbound of outbounds) {
            const outDate = new Date(outbound.flight_date);
            
            // Find matching inbounds
            const matches = inbounds.filter(inbound => {
                if (inbound.origin !== outbound.destination) return false;
                
                const inDate = new Date(inbound.flight_date);
                const diffTime = inDate - outDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                return diffDays >= 3 && diffDays <= 9;
            });

            matches.forEach(inbound => {
                const inDate = new Date(inbound.flight_date);
                const gapDays = Math.ceil((inDate - outDate) / (1000 * 60 * 60 * 24));

                combinations.push({
                    outbound_flight_id: outbound.id,
                    return_flight_id: inbound.id,
                    total_price: outbound.price + inbound.price,
                    gap_days: gapDays,
                    destination_code: outbound.destination,
                    destination_name: '', // Will be filled by alerts/dashboard
                    created_at: new Date().toISOString()
                });
            });
        }

        console.log(`[CombinationEngine] Found ${combinations.length} potential combinations.`);
        
        await this.saveCombinations(combinations);
        return this.getTopDeals(5);
    }

    async saveCombinations(combinations) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO flight_combinations 
            (outbound_flight_id, return_flight_id, total_price, gap_days, destination_code, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const c of combinations) {
            await new Promise((resolve, reject) => {
                stmt.run(
                    c.outbound_flight_id, c.return_flight_id, c.total_price, 
                    c.gap_days, c.destination_code, c.created_at,
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });
        }
        stmt.finalize();
    }

    async getTopDeals(limit = 5) {
        const db = getDB();
        return new Promise((resolve, reject) => {
            const query = `
                SELECT c.*, 
                       o.flight_date as out_date, o.price as out_price, o.airline as out_airline, o.flight_number as out_fn, o.departure_time as out_time,
                       r.flight_date as ret_date, r.price as ret_price, r.airline as ret_airline, r.flight_number as ret_fn, r.departure_time as ret_time
                FROM flight_combinations c
                JOIN oneway_flights o ON c.outbound_flight_id = o.id
                JOIN oneway_flights r ON c.return_flight_id = r.id
                WHERE c.alerted = 0
                ORDER BY c.total_price ASC
                LIMIT ?
            `;
            db.all(query, [limit], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

module.exports = CombinationEngine;
