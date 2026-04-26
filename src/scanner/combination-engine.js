const { getDB } = require('../db');
const airports = require('../data/airports');

class CombinationEngine {
    constructor() {}

    async generateCombinations(targetCityCode = null) {
        console.log(`[CombinationEngine] Generating combinations... ${targetCityCode ? `(City: ${targetCityCode})` : ''}`);
        const db = getDB();

        // 1. Load all flights with metadata
        const flights = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM flights WHERE price > 0 AND updated_at > datetime('now', '-24 hours')", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Enrich flights with hierarchy info
        const enriched = flights.map(f => {
            const info = airports.find(a => a.cityCode === f.origin || a.code === f.origin || a.cityCode === f.dest || a.code === f.dest);
            return { ...f, info };
        }).filter(f => f.info);

        const outbounds = enriched.filter(f => f.origin === 'SHA' || f.origin === 'PVG');
        const inbounds = enriched.filter(f => f.dest === 'SHA' || f.dest === 'PVG');

        const combinations = [];
        for (const out of outbounds) {
            const outDate = new Date(out.date);
            
            for (const inbound of inbounds) {
                const outInfo = out.info;
                const inInfo = inbound.info;

                let isChannelMatch = false;
                let isCategoryMatch = false;

                if (outInfo.region === 'Europe' || outInfo.region === 'Southeast Asia') {
                    // Rule: Channel is Country level
                    isChannelMatch = outInfo.country === inInfo.country;
                    if (outInfo.region === 'Europe') {
                        isCategoryMatch = outInfo.region === inInfo.region && outInfo.country !== inInfo.country;
                    }
                } else if (outInfo.region === 'China') {
                    // Rule: Channel is City level. NO CROSS-CITY for China.
                    isChannelMatch = outInfo.cityCode === inInfo.cityCode;
                    isCategoryMatch = false; 
                } else {
                    // Rule: Others (Japan, Australia, etc.)
                    isChannelMatch = outInfo.cityCode === inInfo.cityCode;
                    isCategoryMatch = outInfo.region === inInfo.region && outInfo.cityCode !== inInfo.cityCode;
                }

                if (isChannelMatch || isCategoryMatch) {
                    const inDate = new Date(inbound.date);
                    const diffDays = Math.ceil((inDate - outDate) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays >= 3 && diffDays <= 9) {
                        combinations.push({
                            outbound_id: out.id,
                            return_id: inbound.id,
                            total_price: out.price + inbound.price,
                            gap_days: diffDays,
                            created_at: new Date().toISOString(),
                            match_level: isChannelMatch ? 'channel' : 'category'
                        });
                    }
                }
            }
        }

        if (combinations.length > 0) await this.saveCombinations(combinations);
        
        // Final filter for return
        const cityAirports = targetCityCode ? airports.filter(a => a.cityCode === targetCityCode).map(a => a.code) : [];
        const cityCodes = targetCityCode ? [targetCityCode] : [];
        
        return this.getTopDeals(5, [...cityAirports, ...cityCodes]);
    }

    async saveCombinations(combinations) {
        const db = getDB();
        const stmt = db.prepare(`
            INSERT INTO flight_combinations 
            (outbound_id, return_id, total_price, gap_days, created_at, match_level)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(outbound_id, return_id) DO UPDATE SET
            total_price = excluded.total_price,
            created_at = excluded.created_at,
            match_level = excluded.match_level
        `);
        for (const c of combinations) {
            await new Promise(r => stmt.run(c.outbound_id, c.return_id, c.total_price, c.gap_days, c.created_at, c.match_level, r));
        }
        stmt.finalize();
    }

    async getTopDeals(limit = 10, targetCodes = []) {
        const db = getDB();
        return new Promise((resolve, reject) => {
            let query = `
                SELECT c.*, 
                       o.date as out_date, o.price as out_price, o.dest as out_city_code,
                       r.date as ret_date, r.price as ret_price, r.origin as ret_city_code
                FROM flight_combinations c
                JOIN flights o ON c.outbound_id = o.id
                JOIN flights r ON c.return_id = r.id
                WHERE c.alerted = 0 
                  AND o.price > 0 AND r.price > 0
                  AND c.created_at > datetime('now', '-2 hours')
            `;
            const params = [];
            if (targetCodes.length > 0) {
                const codesStr = targetCodes.map(c => `'${c}'`).join(',');
                query += ` AND o.dest IN (${codesStr})`;
            }
            query += ` ORDER BY c.total_price ASC LIMIT ?`;
            params.push(limit);

            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
}

module.exports = CombinationEngine;
