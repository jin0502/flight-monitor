const { getDB } = require('../db');

class CombinationEngine {
    constructor() {}

    /**
     * Generates flight combinations from memory arrays.
     */
    combine(outbounds, inbounds) {
        const combinations = [];
        for (const out of outbounds) {
            const outDate = new Date(out.flight_date);
            const matches = inbounds.filter(inbound => {
                const inDate = new Date(inbound.flight_date);
                const diffTime = inDate - outDate;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return diffDays >= 3 && diffDays <= 9;
            });

            matches.forEach(inbound => {
                combinations.push({
                    outbound_id: out.id || 0, // Placeholder if not yet in DB
                    return_id: inbound.id || 0,
                    outbound: out,
                    inbound: inbound,
                    total_price: out.price + inbound.price,
                    gap_days: Math.ceil((new Date(inbound.flight_date) - outDate) / (1000 * 60 * 60 * 24)),
                    created_at: new Date().toISOString()
                });
            });
        }
        return combinations.sort((a, b) => a.total_price - b.price);
    }
    async generateCombinations() {
        console.log('[CombinationEngine] Generating combinations...');
        const db = getDB();

        // 1. Get all outbound flights (PVG/SHA -> Any)
        const outbounds = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM flights WHERE origin IN ('PVG', 'SHA')", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // 2. Get all inbound flights (Any -> PVG/SHA)
        const inbounds = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM flights WHERE dest IN ('PVG', 'SHA')", [], (err, rows) => {
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
                const inDate = new Date(inbound.date);
                const gapDays = Math.ceil((inDate - outDate) / (1000 * 60 * 60 * 24));

                combinations.push({
                    outbound_id: outbound.id,
                    return_id: inbound.id,
                    total_price: outbound.price + inbound.price,
                    gap_days: gapDays,
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
        try {
            const stmt = db.prepare(`
                INSERT INTO flight_combinations 
                (outbound_id, return_id, total_price, gap_days, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(outbound_id, return_id) DO UPDATE SET
                total_price = excluded.total_price,
                created_at = excluded.created_at
            `);

            for (const c of combinations) {
                await new Promise((resolve, reject) => {
                    stmt.run(
                        c.outbound_id, c.return_id, c.total_price, 
                        c.gap_days, c.created_at,
                        (err) => {
                            if (err) {
                                console.error('[CombinationEngine] DB Error saving combination:', err);
                                reject(err);
                            } else {
                                resolve();
                            }
                        }
                    );
                });
            }
            stmt.finalize();
        } catch (err) {
            console.error('[CombinationEngine] Prepare/Execution Error:', err.message);
            throw err;
        }
    }

    async getTopDeals(limit = 5) {
        const db = getDB();
        return new Promise((resolve, reject) => {
            const query = `
                SELECT c.*, 
                       o.date as out_date, o.price as out_price, o.airline as out_airline, o.flight_no as out_fn, o.depart_time as out_time,
                       r.date as ret_date, r.price as ret_price, r.airline as ret_airline, r.flight_no as ret_fn, r.depart_time as ret_time
                FROM flight_combinations c
                JOIN flights o ON c.outbound_id = o.id
                JOIN flights r ON c.return_id = r.id
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
