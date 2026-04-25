# Remote Login Guide (VPS Authentication)

If the scraper starts receiving `needUserLogin` blocks on the VPS, you need to refresh your session directly on the server.

## Prerequisites
- SSH access to your VPS.
- Your local machine must have a Chrome-based browser.
- Your local machine must have an SSH client installed.

## Step-by-Step Instructions

### 1. Start the Login Tool on VPS
SSH into your VPS and run:
```bash
cd shanghai-flight-monitor
npm run login
```
The terminal will say `Browser is running...` and wait.

### 2. Create the SSH Tunnel (Local Machine)
Open a **new terminal window** on your local machine and run:
```bash
# Replace with your VPS IP and path to your private key
ssh -i "path/to/your/key.pem" -L 9222:localhost:9222 root@YOUR_VPS_IP
```
*Keep this window open.*

### 3. Open Chrome locally
- Open Chrome and navigate to: `chrome://inspect/#devices`
- Ensure "Discover network targets" is checked.
- Click **"Configure..."** and add `localhost:9222` if it's not already there.

### 4. Inspect and Authenticate
- Under **"Remote Target"**, find the Ctrip login page.
- Click **"inspect"**.
- A window will pop up showing the VPS browser's screen.
- **Log in manually** (QR code scan or SMS).

### 5. Finalize
- Once logged in and you see your profile, close the inspect window.
- Go back to the **VPS terminal** and press **Ctrl+C** to stop the login tool.
- Restart your monitor: `node src/index.js`

The session is now updated in `data/ctrip_session` on the VPS.
