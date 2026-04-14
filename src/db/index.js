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
        const targetPath = dbPath || process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
        
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

module.exports = {
    initDB,
    getDB
};
