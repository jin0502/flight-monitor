const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

let db;

/**
 * Initializes the database and creates tables if they don't exist.
 * @param {string} [dbPath] - Optional path for the database file. If not provided, it can be set via env.
 * @returns {Promise<sqlite3.Database>} - The initialized database instance.
 */
function initDB(dbPath) {
    return new Promise((resolve, reject) => {
        const targetPath = path.resolve(dbPath || process.env.DB_PATH || path.join(__dirname, '../../database.sqlite'));
        
        db = new sqlite3.Database(targetPath, (err) => {
            if (err) {
                console.error('Error connecting to the database:', err.message);
                return reject(err);
            }
            
            // Read and execute schema
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

/**
 * Gets the current database instance.
 * @returns {sqlite3.Database}
 */
function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call initDB() first.');
    }
    return db;
}

function saveFlight(flight) {
    return new Promise((resolve, reject) => {
        const query = `INSERT OR REPLACE INTO flights 
            (origin, dest, date, flight_no, airline, depart_time, arrival_time, price, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`;
        db.run(query, [
            flight.origin, flight.dest, flight.date, 
            flight.flight_no, flight.airline, 
            flight.depart_time, flight.arrival_time, flight.price
        ], function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
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
    getLatestPrices
};
