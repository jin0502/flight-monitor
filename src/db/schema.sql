CREATE TABLE IF NOT EXISTS oneway_flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    flight_date TEXT NOT NULL,
    price REAL NOT NULL,
    airline TEXT,
    flight_number TEXT,
    departure_time TEXT,
    duration TEXT,
    is_direct INTEGER DEFAULT 1,
    scrape_date TEXT NOT NULL,
    source TEXT NOT NULL,
    month_key TEXT NOT NULL,
    UNIQUE(origin, destination, flight_date, flight_number)
);

CREATE TABLE IF NOT EXISTS flight_combinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outbound_flight_id INTEGER NOT NULL,
    return_flight_id INTEGER NOT NULL,
    total_price REAL NOT NULL,
    gap_days INTEGER NOT NULL,
    destination_code TEXT NOT NULL,
    destination_name TEXT,
    created_at TEXT NOT NULL,
    alerted INTEGER DEFAULT 0,
    FOREIGN KEY (outbound_flight_id) REFERENCES oneway_flights (id),
    FOREIGN KEY (return_flight_id) REFERENCES oneway_flights (id)
);
