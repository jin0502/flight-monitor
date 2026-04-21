const express = require('express');
const path = require('path');
const { getDB, initDB } = require('../db');
const dotenv = require('dotenv');
const countryAirports = require('../data/country-airports');

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
 * @route GET /api/countries
 * @description Retrieves the list of countries from the mapping data.
 */
app.get('/api/countries', (req, res) => {
    const countries = Object.keys(countryAirports).sort();
    res.json(countries);
});

/**
 * @route GET /api/routes
 * @description Retrieves a list of all monitored routes from the database.
 * @returns {Array<Object>} List of monitored routes.
 */
app.get('/api/routes', (req, res) => {
    const db = getDB();
    db.all('SELECT * FROM monitored_routes', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

/**
 * @route POST /api/routes
 * @description Adds a new route to monitor.
 */
app.post('/api/routes', (req, res) => {
    const { origin, destination, destination_type, region, search_type, alert_threshold } = req.body;

    if (!origin || !destination || !region || !search_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDB();
    const query = `INSERT INTO monitored_routes (origin, destination, destination_type, region, search_type, alert_threshold)
                   VALUES (?, ?, ?, ?, ?, ?)`;
    const params = [origin, destination, destination_type || 'country', region, search_type, alert_threshold];

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            id: this.lastID,
            origin,
            destination,
            destination_type: destination_type || 'country',
            region,
            search_type,
            alert_threshold
        });
    });
});

/**
 * @route DELETE /api/routes/:id
 * @description Removes a monitored route by its ID.
 */
app.delete('/api/routes/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    db.run('DELETE FROM monitored_routes WHERE id = ?', id, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Route not found' });
        }
        res.status(204).end();
    });
});

/**
 * @route GET /api/prices/:route_id
 * @description Retrieves the price history for a specific monitored route.
 */
app.get('/api/prices/:route_id', (req, res) => {
    const { route_id } = req.params;
    const db = getDB();
    db.all('SELECT * FROM price_history WHERE route_id = ? ORDER BY scrape_date DESC', [route_id], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
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
