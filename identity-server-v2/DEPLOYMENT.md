# Deployment Guide - Identity Server v2

## Server Details
- **Domain**: iscan.logicatechnology.com
- **Hosting**: cPanel Shared Hosting (LiteSpeed)
- **Node.js Version**: 20.20.0
- **Application Root**: `/home/thevifco/repositories/identity-recognition-and-liveliness/identity-server-v2`

---

## Quick Deploy (After Code Changes)

### 1. Local - Commit and Push
```bash
cd C:\Users\Janna Robillos\OneDrive\Documents\GitHub\identity-recognition-and-liveliness\identity-server-v2
git add .
git commit -m "your commit message"
git push origin main
```

### 2. Server - Pull and Restart
```bash
# SSH into server, then:
cd /home/thevifco/repositories/identity-recognition-and-liveliness
git pull origin main

# Restart via cPanel Node.js App Manager (recommended)
# OR kill processes to trigger auto-restart:
ps aux | grep identity
kill <PID1> <PID2>
```

---

## Full Deployment Steps

### Step 1: SSH into Server
```bash
ssh thevifco@s10801.usc1.stableserver.net
# Or use cPanel Terminal
```

### Step 2: Navigate to Project
```bash
cd /home/thevifco/repositories/identity-recognition-and-liveliness/identity-server-v2
```

### Step 3: Activate Node.js Environment
```bash
source /home/thevifco/nodevenv/repositories/identity-recognition-and-liveliness/identity-server-v2/20/bin/activate
```

### Step 4: Pull Latest Code
```bash
git pull origin main
```

### Step 5: Install Dependencies (if package.json changed)
```bash
npm install
```

### Step 6: Build Frontend (if frontend files changed)
```bash
npm run build
```

### Step 7: Restart Application
**Option A - Via cPanel (Recommended):**
1. Go to cPanel → Node.js App Manager
2. Find `iscan.logicatechnology.com`
3. Click the restart button (↻)

**Option B - Via Terminal:**
```bash
# Find process IDs
ps aux | grep identity

# Kill them (cPanel will auto-restart)
kill <PID1> <PID2>

# Verify restart
ps aux | grep identity
```

---

## Environment Setup (First Time Only)

### Create .env file on server
```bash
cd /home/thevifco/repositories/identity-recognition-and-liveliness/identity-server-v2
nano .env
```

Add the following (update with your credentials):
```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
SSL_ENABLED=false

IDENTITY_EXPECTED_ORIGIN=https://iscan.logicatechnology.com
VITE_EXPECTED_ORIGIN=https://iscan.logicatechnology.com

VERIFY_SESSION_TTL_SECONDS=3600

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_DEBUG=false

DB_HOST=localhost
DB_PORT=3306
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

---

## Useful Commands

### Check if app is running
```bash
ps aux | grep identity
```

### View live logs (manual start)
```bash
cd /home/thevifco/repositories/identity-recognition-and-liveliness/identity-server-v2
source /home/thevifco/nodevenv/repositories/identity-recognition-and-liveliness/identity-server-v2/20/bin/activate
node server.js
```

### Test API health
```bash
curl https://iscan.logicatechnology.com/api/health
```

### Check git status
```bash
cd /home/thevifco/repositories/identity-recognition-and-liveliness
git status
```

### Discard local changes on server
```bash
git checkout -- .
git pull origin main
```

---

## Troubleshooting

### App shows "started" but not responding
1. Check if process is actually running: `ps aux | grep identity`
2. If not running, check logs by starting manually: `node server.js`
3. Look for missing dependencies or syntax errors

### 404 Not Found on domain
- App is not running - start it from cPanel Node.js App Manager

### API returns HTTP instead of HTTPS
- Ensure `app.set('trust proxy', true)` is in server.js
- Restart the app after changes

### Cannot git pull (untracked files)
```bash
# These files should stay untracked:
# .env, node_modules/, tmp/
# They won't block git pull
git status
git pull origin main
```

### Permission denied on .env
```bash
chmod 644 .env
```

---

## File Structure on Server
```
/home/thevifco/
├── repositories/
│   └── identity-recognition-and-liveliness/
│       └── identity-server-v2/
│           ├── server.js          # Main backend
│           ├── .env               # Environment config (NOT in git)
│           ├── node_modules/      # Dependencies (NOT in git)
│           ├── dist/              # Built frontend
│           │   └── client/
│           └── public/
│               ├── models/        # Face detection models
│               └── js/            # Scanning algorithms
└── nodevenv/                      # Node.js virtual environments
```
