const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

let db;

function initDB(dbPath) {
    return new Promise((resolve, reject) => {
        let targetPath = dbPath || process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
        if (targetPath !== ':memory:') {
            targetPath = path.resolve(targetPath);
        }
        
        db = new sqlite3.Database(targetPath, (err) => {
            if (err) {
                console.error('Error connecting to the database:', err.message);
                return reject(err);
            }
            
            const schemaPath = path.join(__dirname, 'schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            db.exec(schema, (err) => {
                if (err) {
                    console.error('Error initializing tables:', err.message);
                    return reject(err);
                }
                resolve(db);
            });
        });
    });
}

function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call initDB() first.');
    }
    return db;
}

function saveFlight(f) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO flights 
            (origin, dest, date, flight_no, airline, depart_time, arrival_time, price, 
             aircraft_type, seat_pitch, has_wifi, has_entertainment, has_power, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(origin, dest, date, flight_no) DO UPDATE SET
            price = excluded.price,
            aircraft_type = COALESCE(excluded.aircraft_type, flights.aircraft_type),
            seat_pitch = COALESCE(excluded.seat_pitch, flights.seat_pitch),
            has_wifi = COALESCE(excluded.has_wifi, flights.has_wifi),
            has_entertainment = COALESCE(excluded.has_entertainment, flights.has_entertainment),
            has_power = COALESCE(excluded.has_power, flights.has_power),
            updated_at = datetime('now')`;
        
        const date = f.date || f.flight_date;
        const flightNo = f.flightNo || f.flight_no;
        
        const params = [
            f.origin, f.destination, date, 
            flightNo, f.airline, 
            f.departTime || f.depart_time, 
            f.arrivalTime || f.arrival_time, 
            f.price,
            f.aircraftType || f.aircraft_type || null,
            f.seatPitch || f.seat_pitch || null,
            f.hasWifi !== undefined ? f.hasWifi : (f.has_wifi !== undefined ? f.has_wifi : null),
            f.hasEntertainment !== undefined ? f.hasEntertainment : (f.has_entertainment !== undefined ? f.has_entertainment : null),
            f.hasPower !== undefined ? f.hasPower : (f.has_power !== undefined ? f.has_power : null)
        ];
        
        db.run(query, params, function(err) {
            if (err) return reject(err);
            
            // Always query the ID because ON CONFLICT UPDATE doesn't provide it via this.lastID
            db.get("SELECT id FROM flights WHERE origin=? AND dest=? AND date=? AND flight_no=?", 
                [f.origin, f.destination, date, flightNo], (err, row) => {
                    if (err) reject(err);
                    else if (row) resolve(row.id);
                    else reject(new Error('Failed to retrieve flight ID after save'));
                });
        });
    });
}

function saveRoutePrice(data) {
    return new Promise((resolve, reject) => {
        const query = `INSERT OR REPLACE INTO route_prices 
            (origin, dest, date, price, updated_at) 
            VALUES (?, ?, ?, ?, datetime('now'))`;
        db.run(query, [data.origin, data.dest, data.date, data.price], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

async function saveCombinations(combinations) {
    const query = `INSERT OR REPLACE INTO flight_combinations 
        (outbound_id, return_id, total_price, gap_days, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))`;
    
    for (const c of combinations) {
        // We need real IDs here. If we don't have them, we must save flights first.
        const outId = await saveFlight(c.outbound);
        const retId = await saveFlight(c.inbound);
        
        await new Promise((resolve, reject) => {
            db.run(query, [outId, retId, c.total_price, c.gap_days], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

function getLatestPrices(origin, dest) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM route_prices WHERE origin = ? AND dest = ? AND date >= date('now') ORDER BY date ASC`;
        db.all(query, [origin, dest], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

module.exports = {
    initDB,
    getDB,
    saveFlight,
    saveRoutePrice,
    saveCombinations,
    getLatestPrices
};
