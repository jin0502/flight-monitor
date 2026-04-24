# VPS Deployment Guide

This guide covers how to deploy the Shanghai Flight Monitor on a resource-constrained VPS (e.g., 2GB RAM).

## 🛡️ Resource Management

The scanner is designed to be lightweight, but Playwright (headless browser) can still consume significant memory. The application uses the following optimizations:
- **Shared Browser Instance**: The orchestrator launches one browser and reuses it for the entire cycle.
- **Resource Blocking**: Images, CSS (optional), and media are blocked to save bandwidth and memory.
- **Sequential Execution**: Airports are scanned one by one to prevent CPU spikes.

## 🚀 Deployment Steps

### 1. Prerequisites

Ensure you have Node.js (v18+) and SQLite3 installed on your server.

### 2. PM2 Installation

We recommend using **PM2** to manage the process and ensure it restarts on failure or reboot.

```bash
npm install -g pm2
```

### 3. Deploy the Code

```bash
git clone <repository_url>
cd shanghai-flight-monitor
npm install
npx playwright install --with-deps firefox
```

### 4. Configuration

Create your `.env` file based on the `README.md` instructions.

### 5. Start with PM2

To start the application with memory limits:

```bash
pm2 start src/index.js --name "flight-monitor" --max-memory-restart 1500M
```

### 6. Cron (Optional)

The application has a built-in scheduler (`setInterval`). However, if you prefer using system cron:
1. Set `SCRAPE_INTERVAL_HOURS=0` in `.env`.
2. Add a crontab entry:
   ```bash
   0 */12 * * * cd /path/to/app && /usr/bin/node src/index.js >> /var/log/flight-monitor.log 2>&1
   ```

## 📈 Monitoring

- **Logs**: `pm2 logs flight-monitor`
- **Dashboard**: Access via `http://<your-vps-ip>:3000` (Ensure port 3000 is open in your firewall).

## 🧹 Maintenance

- **DB Cleanup**: The database can grow over time. The system uses `INSERT OR REPLACE`, but you may want to periodically clear old one-way results:
  ```bash
  sqlite3 data/flights.db "DELETE FROM oneway_flights WHERE scrape_date < date('now', '-30 days');"
  ```
