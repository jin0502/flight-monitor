# VPS Deployment Guide: Shanghai Flight Monitor

This guide explains how to deploy the Shanghai Flight Monitor to a Linux-based VPS (optimized for 2GB RAM environments).

## 1. Prerequisites
- A VPS with at least 1GB RAM (2GB strongly recommended for stability).
- SSH access to your server.
- **Node.js 18+** (LTS recommended).

## 2. Server Setup

### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

## 3. Application Deployment

### Clone & Install
```bash
git clone <your-repository-url>
cd shanghai-flight-monitor
npm install
```

### Install Playwright (Chromium)
We use **Chromium** for its superior resource management flags.
```bash
npx playwright install chromium
sudo npx playwright install-deps chromium
```

## 4. Resource Optimization ("Ultra-Lightweight Mode")
The system is pre-configured to run on low-end VPS hardware by using a **Single Shared Browser Page** and aggressive memory capping.

### JS Flag Configuration
When running on a 2GB VPS, it is recommended to cap the Node.js memory. You can do this via PM2 or environment variables:
```bash
export NODE_OPTIONS="--max-old-space-size=256"
```

## 5. Configuration

### Environment Variables (.env)
```env
PORT=3000
DB_PATH=./data/flights.db
SCRAPE_INTERVAL_HOURS=6
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_id
DISCORD_WEBHOOK_URL=your_url
```

### Database Migration
The system now supports **Round-Trip** flights. Ensure your database schema is up to date:
```bash
# If you have an existing database, apply these migrations:

# First, ensure sqlite3 is installed:
sudo apt-get install -y sqlite3

sqlite3 ./data/flights.db "ALTER TABLE price_history ADD COLUMN return_date TEXT;"
sqlite3 ./data/flights.db "ALTER TABLE price_history ADD COLUMN return_flight_number TEXT;"
sqlite3 ./data/flights.db "ALTER TABLE price_history ADD COLUMN return_departure_time TEXT;"
```

## 6. Running the App

### Start with PM2 (Recommended for 2GB VPS)
```bash
pm2 start src/index.js --name flight-monitor --node-args="--max-old-space-size=256"
```

### Time Zone Note
The system is standardized to **GMT+8 (China Standard Time)**. All `scrape_date` entries and logs will follow this time zone regardless of the VPS location.

## 7. Management
- **Logs:** `pm2 logs flight-monitor`
- **Resource Monitor:** `pm2 monit` (Watch for the 256MB memory cap)
- **Restart:** `pm2 restart flight-monitor`

## 8. Nginx Setup (Optional)
Set up Nginx as a reverse proxy pointing to `http://localhost:3000` to access the dashboard.
