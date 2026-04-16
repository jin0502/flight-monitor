const express = require('express');
const path = require('path');
const { getDB, initDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes

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
 * @param {Object} req.body - The route details.
 * @param {string} req.body.origin - The origin airport code.
 * @param {string} req.body.destination - The destination airport code.
 * @param {string} req.body.region - The region of the destination.
 * @param {string} req.body.search_type - The type of search (e.g., 'WEEKEND', 'FLEXIBLE').
 * @param {number} [req.body.alert_threshold] - Optional price threshold for alerts.
 * @returns {Object} The created route.
 */
app.post('/api/routes', (req, res) => {
    const { origin, destination, region, search_type, alert_threshold } = req.body;
    
    if (!origin || !destination || !region || !search_type) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const db = getDB();
    const query = `INSERT INTO monitored_routes (origin, destination, region, search_type, alert_threshold)
                   VALUES (?, ?, ?, ?, ?)`;
    const params = [origin, destination, region, search_type, alert_threshold];

    db.run(query, params, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
            id: this.lastID,
            origin,
            destination,
            region,
            search_type,
            alert_threshold
        });
    });
});

/**
 * @route DELETE /api/routes/:id
 * @description Removes a monitored route by its ID.
 * @param {string} req.params.id - The ID of the route to remove.
 * @returns {void}
 */
app.delete('/api/routes/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    db.run('DELETE FROM monitored_routes WHERE id = ?', id, function(err) {
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
 * @param {string} req.params.route_id - The ID of the route.
 * @returns {Array<Object>} List of historical price data.
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
