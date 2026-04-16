# VPS Deployment Guide: Shanghai Flight Monitor

This guide explains how to deploy the Shanghai Flight Monitor to a Linux-based VPS (e.g., Ubuntu 22.04).

## 1. Prerequisites
- A VPS with at least 1GB RAM (2GB recommended for Playwright).
- SSH access to your server.

## 2. Server Setup

### Install Node.js (LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

## 3. Application Deployment

### Clone the Repository
```bash
git clone <your-repository-url>
cd shanghai-flight-monitor
```

### Install Dependencies
```bash
npm install
```

### Install Playwright Browsers & Dependencies
This is the most important step for the scraper to work on Linux.
```bash
npx playwright install firefox
sudo npx playwright install-deps firefox
```

## 4. Configuration

### Create Environment File
```bash
nano .env
```
Paste and update the following:
```env
PORT=3000
DB_PATH=./data/flights.db
SCRAPE_INTERVAL_HOURS=12
TELEGRAM_BOT_TOKEN=your_token
TELEGRAM_CHAT_ID=your_id
DISCORD_WEBHOOK_URL=your_url
```

### Create Data Directory
```bash
mkdir -p data
```

## 5. Running the App

### Start with PM2
```bash
pm2 start src/index.js --name flight-monitor
```

### Enable Auto-restart on Reboot
```bash
pm2 save
pm2 startup
```
(Follow the instruction printed by the startup command to complete the setup).

## 6. Management Commands

- **View Logs:** `pm2 logs flight-monitor`
- **Restart App:** `pm2 restart flight-monitor`
- **Stop App:** `pm2 stop flight-monitor`
- **Monitor Performance:** `pm2 monit`

## 7. Nginx Setup (Optional)
To access the dashboard via a domain name on port 80/443, set up Nginx as a reverse proxy pointing to `http://localhost:3000`.
