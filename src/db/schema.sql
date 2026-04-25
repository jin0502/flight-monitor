-- Phase 1: Calendar prices (High level)
CREATE TABLE IF NOT EXISTS route_prices (
    origin TEXT NOT NULL,
    dest TEXT NOT NULL,
    date TEXT NOT NULL,
    price REAL NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (origin, dest, date)
);

-- Phase 2: Detailed flight info
CREATE TABLE IF NOT EXISTS flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    origin TEXT NOT NULL,
    dest TEXT NOT NULL,
    date TEXT NOT NULL,
    flight_no TEXT NOT NULL,
    airline TEXT,
    depart_time TEXT,
    arrival_time TEXT,
    price REAL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(origin, dest, date, flight_no)
);

-- Phase 3: Best combinations for alerting
CREATE TABLE IF NOT EXISTS flight_combinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outbound_id INTEGER NOT NULL,
    return_id INTEGER NOT NULL,
    total_price REAL NOT NULL,
    gap_days INTEGER NOT NULL,
    alerted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (outbound_id) REFERENCES flights (id),
    FOREIGN KEY (return_id) REFERENCES flights (id),
    UNIQUE(outbound_id, return_id)
);
