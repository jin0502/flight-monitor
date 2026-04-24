# Implementation Plan: One-Way Flight Scanner & Combination Engine

This plan outlines the steps to migrate the existing round-trip flight monitor to a more efficient one-way scanning and combination engine, as specified in the [Design Document](./2026-04-24-oneway-combination-scanner-design.md).

## Phase 0: Database Overhaul
- [ ] Update `src/db/schema.sql` with `oneway_flights` and `flight_combinations` tables.
- [ ] Update `src/db/index.js` to support "clean slate" initialization.
- [ ] Implement database helper methods for the new tables in `src/db/index.js`.

## Phase 1: Core Scanners (src/scanner/)
- [ ] Create `src/scanner/` directory.
- [ ] Implement `calendar-scanner.js`: 
    - Use Ctrip calendar API to find cheapest 3 dates per month for each route.
    - Handle 48 airports × 2 directions × 6 months.
- [ ] Implement `oneway-scanner.js`:
    - Full scrape for identified candidate dates.
    - Filter for direct flights only.
    - Store in `oneway_flights`.

## Phase 2: Combination Engine
- [ ] Implement `src/scanner/combination-engine.js`:
    - Logic to pair outbound (PVG→X) and return (X→PVG) flights.
    - Gap range: 3 to 7 days.
    - Ranking and filtering (Top 5 deals).
    - Store in `flight_combinations`.

## Phase 3: Orchestration
- [ ] Implement `src/scanner/index.js`:
    - Main loop to run Phase 1, 2, and 3 sequentially.
    - Error handling and logging.
- [ ] Update `src/index.js`:
    - Point the monitor loop to the new scanner orchestrator.

## Phase 4: Alerts
- [ ] Update `src/alerts/index.js`:
    - Handle the new `flight_combinations` data structure.
    - Format messages according to the new alert design.

## Phase 5: Dashboard
- [ ] Update Express routes and frontend:
    - Display scan status.
    - One-way results browser.
    - Top flight combinations.

## Phase 6: Cleanup
- [ ] Remove legacy scraper code if no longer needed.
- [ ] Update `README.md` with new architecture and setup instructions.
