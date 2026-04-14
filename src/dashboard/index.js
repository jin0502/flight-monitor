const express = require('express');
const path = require('path');
const { getDB, initDB } = require('../db');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes

// List all monitored routes
app.get('/api/routes', (req, res) => {
    const db = getDB();
    db.all('SELECT * FROM monitored_routes', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// Add a new route to monitor
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

// Remove a route
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

// Get price history for a specific route
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
