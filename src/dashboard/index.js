const express = require('express');
const path = require('path');
const { getDB, initDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

// Basic Authentication Middleware
const basicAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Flight Monitor Dashboard"');
        return res.status(401).send('Authentication required');
    }

    try {
        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];

        const adminUser = process.env.ADMIN_USERNAME || 'admin';
        const adminPass = process.env.ADMIN_PASSWORD;

        if (!adminPass) {
            console.warn('WARNING: ADMIN_PASSWORD not set in .env. Authentication disabled for safety.');
            return next();
        }

        if (user === adminUser && pass === adminPass) {
            next();
        } else {
            res.setHeader('WWW-Authenticate', 'Basic realm="Flight Monitor Dashboard"');
            res.status(401).send('Invalid credentials');
        }
    } catch (e) {
        res.status(400).send('Malformed Authorization header');
    }
};

// Apply auth middleware to all routes and static files
app.use(basicAuth);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes

/**
 * @route GET /api/oneway
 * @description Retrieves all scanned one-way flights.
 */
app.get('/api/oneway', (req, res) => {
    const db = getDB();
    db.all('SELECT * FROM flights ORDER BY updated_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * @route GET /api/combinations
 * @description Retrieves all paired flight combinations.
 */
app.get('/api/combinations', (req, res) => {
    const db = getDB();
    const query = `
        SELECT c.*, 
               o.date as out_date, o.price as out_price, o.airline as out_airline, o.flight_no as out_fn, o.depart_time as out_time,
               r.date as ret_date, r.price as ret_price, r.airline as ret_airline, r.flight_no as ret_fn, r.depart_time as ret_time
        FROM flight_combinations c
        JOIN flights o ON c.outbound_id = o.id
        JOIN flights r ON c.return_id = r.id
        ORDER BY c.total_price ASC
        LIMIT 50
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

/**
 * @route GET /api/airports
 * @description Retrieves the curated list of 48 airports.
 */
app.get('/api/airports', (req, res) => {
    const airports = require('../data/airports');
    res.json(airports);
});

// Start server only if run directly
if (require.main === module) {
    const port = process.env.PORT || 3000;
    initDB().then(() => {
        app.listen(port, () => {
            console.log(`Dashboard API running at http://localhost:${port}`);
        });
    }).catch(err => {
        console.error('Failed to initialize database:', err);
    });
}

module.exports = app;
