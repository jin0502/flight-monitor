# Shanghai Flight Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a budget traveler tool that tracks flight prices from PVG/SHA to East Asia, SE Asia, and Europe using Playwright and Node.js.

**Architecture:** A modular Node.js application with a Playwright-based scraper, a SQLite data store, an alert engine for price drops, and an Express-based visual dashboard.

**Tech Stack:** Node.js, Express, Playwright, SQLite3, Telegram/Discord API.

---

### Task 1: Project Initialization & Environment Setup

**Files:**
- Create: `package.json`
- Create: `.env`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json` with dependencies**
- [ ] **Step 2: Install dependencies**
- [ ] **Step 3: Create `.env` for configuration**
- [ ] **Step 4: Update `.gitignore`**
- [ ] **Step 5: Commit**

### Task 2: Database Schema & Connection

**Files:**
- Create: `src/db/schema.sql`
- Create: `src/db/index.js`
- Test: `tests/db/index.test.js`

- [ ] **Step 1: Define SQLite schema**
- [ ] **Step 2: Implement database connection and table initialization**
- [ ] **Step 3: Write tests for database operations**
- [ ] **Step 4: Run tests and verify**
- [ ] **Step 5: Commit**

### Task 3: Base Scraper with Playwright

**Files:**
- Create: `src/scraper/index.js`
- Create: `src/scraper/providers/google-flights.js`
- Test: `tests/scraper/google-flights.test.js`

- [ ] **Step 1: Setup Playwright base class**
- [ ] **Step 2: Implement Google Flights scraper logic (PVG/SHA focus)**
- [ ] **Step 3: Write tests for scraping a specific route**
- [ ] **Step 4: Run tests and verify**
- [ ] **Step 5: Commit**

### Task 4: Price Analysis & Alert Engine

**Files:**
- Create: `src/alerts/index.js`
- Test: `tests/alerts/index.test.js`

- [ ] **Step 1: Implement price comparison logic (historical vs current)**
- [ ] **Step 2: Implement threshold-based alerting**
- [ ] **Step 3: Write tests for alert triggering**
- [ ] **Step 4: Run tests and verify**
- [ ] **Step 5: Commit**

### Task 5: Notification Channels (Telegram/Discord)

**Files:**
- Create: `src/alerts/channels/telegram.js`
- Create: `src/alerts/channels/discord.js`

- [ ] **Step 1: Implement Telegram notification channel**
- [ ] **Step 2: Implement Discord notification channel**
- [ ] **Step 3: Commit**

### Task 6: Dashboard API

**Files:**
- Create: `src/dashboard/index.js`
- Test: `tests/dashboard/index.test.js`

- [ ] **Step 1: Implement Express server and basic routes**
- [ ] **Step 2: Implement data retrieval endpoints for prices and routes**
- [ ] **Step 3: Write tests for API endpoints**
- [ ] **Step 4: Run tests and verify**
- [ ] **Step 5: Commit**

### Task 7: Dashboard UI (Frontend)

**Files:**
- Create: `src/dashboard/public/index.html`
- Create: `src/dashboard/public/app.js`

- [ ] **Step 1: Create basic dashboard layout with HTML/CSS**
- [ ] **Step 2: Implement price heatmap and chart visualization**
- [ ] **Step 3: Implement route configuration UI**
- [ ] **Step 4: Commit**

### Task 8: Integration & Orchestration

**Files:**
- Create: `src/index.js`

- [x] **Step 1: Implement the main execution loop (scheduling searches)**
- [x] **Step 2: Integrate scraper, db, alerts, and dashboard**
- [x] **Step 3: Final E2E manual test**
- [x] **Step 4: Commit**

### Task 9: Ctrip Scraper Provider

**Files:**
- Create: `src/scraper/providers/ctrip.js`
- Test: `tests/scraper/ctrip.test.js`

- [ ] **Step 1: Implement Ctrip scraper logic in `src/scraper/providers/ctrip.js`**
- [ ] **Step 2: Write tests for Ctrip scraping in `tests/scraper/ctrip.test.js`**
- [ ] **Step 3: Run tests and verify (including headless mode check)**
- [ ] **Step 4: Update `src/index.js` to optionally use the Ctrip provider**
- [ ] **Step 5: Commit**

