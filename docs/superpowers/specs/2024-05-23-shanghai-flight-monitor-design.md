# Shanghai Flight Monitor Design Specification

## Overview
The **Shanghai Flight Monitor** is a budget traveler tool designed to track and alert users of flight price drops from Shanghai's major airports (PVG/SHA) to target regions (East Asia, Southeast Asia, and Europe). It supports extreme travel date flexibility (next 6 months) and short-term weekend getaways (3-day trips in the next month).

## Target Regions
- **East Asia:** Japan, South Korea, Taiwan, Hong Kong, Macau.
- **Southeast Asia:** Thailand, Vietnam, Singapore, Malaysia, Philippines, Indonesia.
- **Europe:** Major European hubs (London, Paris, Frankfurt, etc.).

## Core Features
- **Flexible Search:** Monitor the cheapest flights for the next 6 months.
- **Weekend Search:** Monitor 3-day weekend trips in the next month.
- **Instant Alerts:** Telegram or Discord notifications when a price drops below a threshold.
- **Daily/Weekly Digest:** A summary email or report of the best deals found.
- **Visual Dashboard:** A web-based interface for price heatmaps, history, and monitoring settings.

## System Architecture
The application uses a modular Node.js architecture:

### 1. Scraper Service (Playwright)
- **Engine:** Playwright (headless browser).
- **Sources:** Web scraping from providers like Google Flights or Ctrip.
- **Workflow:** Iterates through a list of monitoring jobs, extracting prices, airlines, and dates.

### 2. Data Store (SQLite)
- **Database:** SQLite for local storage of historical price data and monitoring preferences.
- **Tables:**
    - `monitored_routes`: `id, origin, destination, region, search_type, alert_threshold`
    - `price_history`: `id, route_id, price, scrape_date, travel_date, airline, duration`
    - `alerts`: `id, price_history_id, sent_at, type`

### 3. Alert Engine
- **Threshold Logic:**
    - **Manual:** User-defined "Buy Now" price.
    - **Automated:** 20% drop below historical average.
- **Deduplication:** Only alerts on new lows or significant drops.

### 4. Dashboard API & UI (Express)
- **Server:** Express.js.
- **UI:** A web interface for visualizing data and managing monitoring jobs.
- **Visuals:** Price heatmaps and historical trend charts.

## Error Handling & Reliability
- **Scraper Resilience:** Logging of selector changes and scraper failures.
- **Retry Logic:** Automatic retry for failed search jobs.
- **Deduplication:** Prevents spamming alerts for the same price.

## Testing Strategy
- **Unit Tests:** For alert logic, price parsing, and data modeling.
- **Integration Tests:** For database operations and API endpoints.
- **E2E Tests:** For verifying Playwright scraper functionality on target websites.

## Technical Stack
- **Backend:** Node.js, Express.
- **Scraper:** Playwright.
- **Database:** SQLite.
- **Notifications:** Telegram/Discord API, Node-mailer.
