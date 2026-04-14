CREATE TABLE IF NOT EXISTS monitored_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    region TEXT NOT NULL,
    search_type TEXT NOT NULL,
    alert_threshold REAL,
    UNIQUE(origin, destination, search_type)
);

CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    price REAL NOT NULL,
    scrape_date TEXT NOT NULL,
    travel_date TEXT NOT NULL,
    airline TEXT,
    duration TEXT,
    FOREIGN KEY (route_id) REFERENCES monitored_routes (id)
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_history_id INTEGER NOT NULL,
    sent_at TEXT NOT NULL,
    type TEXT NOT NULL,
    FOREIGN KEY (price_history_id) REFERENCES price_history (id)
);
