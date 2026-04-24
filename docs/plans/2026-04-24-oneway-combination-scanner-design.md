# One-Way Flight Scanner + Combination Engine

## Goal

Replace the existing round-trip flight monitor with a one-way scanning + combination engine.
Scan all direct-flight airports from/to Shanghai, find cheapest one-way flights per month,
pair them into outbound+return combinations, and alert the top 5 deals.

## Architecture

```
src/scanner/
  ├── index.js              — Orchestrator
  ├── calendar-scanner.js   — Phase 1: Cheapest dates via Ctrip calendar
  ├── oneway-scanner.js     — Phase 2: Detailed one-way scrape
  └── combination-engine.js — Phase 3: Pair, rank, alert
```

## Database (Clean Slate)

Drop all old tables. Two new tables:

### oneway_flights
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| origin | TEXT | e.g., PVG or NRT |
| destination | TEXT | e.g., NRT or PVG |
| flight_date | TEXT | YYYY-MM-DD |
| price | REAL | One-way price in CNY |
| airline | TEXT | Airline name |
| flight_number | TEXT | e.g., MU523 |
| departure_time | TEXT | HH:mm |
| duration | TEXT | e.g., 2h30m |
| is_direct | INTEGER | 1=direct, 0=connecting |
| scrape_date | TEXT | When scraped |
| source | TEXT | ctrip, trip.com |
| month_key | TEXT | YYYY-MM for grouping |

UNIQUE(origin, destination, flight_date, flight_number)

### flight_combinations
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PK | Auto-increment |
| outbound_flight_id | INTEGER FK | → oneway_flights |
| return_flight_id | INTEGER FK | → oneway_flights |
| total_price | REAL | outbound + return price |
| gap_days | INTEGER | Days between flights |
| destination_code | TEXT | The non-Shanghai airport |
| destination_name | TEXT | Human-readable name |
| created_at | TEXT | Timestamp |
| alerted | INTEGER | 0=not yet, 1=sent |

## Three-Phase Flow

### Phase 1 — Calendar Scan (~576 requests, ~1.5h)
- For each airport (48) × direction (2) × month (6)
- Navigate to `flights.ctrip.com/online/list/oneway-pvg-nrt?depdate=YYYY-MM-DD`
- Intercept calendar/low-price API → identify cheapest 3 dates per month
- Store date candidates in memory

### Phase 2 — Detail Scan (~288 scrapes, ~1.5h)
- For each cheapest date from Phase 1
- Full one-way scrape, filter direct flights only
- Store in oneway_flights table

### Phase 3 — Combination Engine (in-memory, seconds)
- For each outbound (PVG→X on date D): find returns X→PVG on D+3..D+7
- For each inbound (X→PVG on date D): find outbounds PVG→X on D-7..D-3
- total_price = outbound.price + return.price
- Sort, pick top 5, alert

## Shanghai Airport Strategy
- Search FROM PVG as outbound
- Accept returns to PVG or SHA (both = Shanghai)
- Display actual arrival airport in alerts

## Direct Flight Filter
- API: flightSegments[0].flightList.length === 1
- Post-processing: reject any flight with stops > 0

## Curated Airport List (48 airports)
- China (21): CAN, SZX, CTU, TFU, CKG, XMN, XIY, KMG, SYX, FOC, KWL, LJG, HAK, URC, DLC, TNA, CGO, NNG, SJW, LHW, INC
- Japan (7): NRT, HND, KIX, NGO, FUK, CTS, OKA
- South Korea (3): ICN, PUS, CJU
- Thailand (4): BKK, DMK, HKT, CNX
- Vietnam (3): SGN, HAN, DAD
- Singapore (1): SIN
- Malaysia (1): KUL
- Philippines (2): MNL, CEB
- Cambodia (2): PNH, REP
- Indonesia (2): CGK, DPS
- UK (1): LHR
- France (1): CDG
- Germany (2): FRA, MUC
- Italy (2): FCO, MXP
- Spain (1): MAD
- Netherlands (1): AMS
- Switzerland (1): ZRH
- Belgium (1): BRU
- Austria (1): VIE
- UAE (2): DXB, AUH
- Qatar (1): DOH
- Australia (2): SYD, MEL

## Alert Format
```
✈️ Best Flight Deal #1 of 5

🔵 OUTBOUND: Shanghai Pudong → Tokyo Narita
📅 2026-06-15 (Mon) ⏰ 08:30
✈ MU523 | China Eastern | 💰 ¥1,280

🔴 RETURN: Tokyo Narita → Shanghai Pudong
📅 2026-06-20 (Sat) ⏰ 14:15
✈ NH919 | ANA | 💰 ¥1,450

💰 TOTAL: ¥2,730 (5-day trip)
```

## Dashboard
- Rebuilt to show: scan status, one-way results browser, top combinations
- Same Express + static HTML stack
- Auth middleware preserved

## Scheduling
- Full scan: once per day (configurable SCAN_INTERVAL_HOURS)
- ~3 hours total runtime per cycle
