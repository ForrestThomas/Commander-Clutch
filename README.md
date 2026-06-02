# Commander Clutch — Warzone AI Coach 

## Deploy to Vercel (10 minutes)

### Step 1 — Get a free Vercel account  
Go to https://vercel.com and sign up free. No credit card needed.

### Step 2 — Install Vercel CLI (or use the web UI)
```
npm install -g vercel
```

### Step 3 — Deploy
In this folder, run:
```
vercel
```
Follow the prompts. When asked for project settings, accept all defaults.

### Step 4 — Add your Anthropic API key
1. Go to https://console.anthropic.com and copy your API key
2. In your Vercel project dashboard go to Settings → Environment Variables
3. Add: ANTHROPIC_API_KEY = your key here
4. Redeploy: `vercel --prod`

### Step 5 — Share!
You'll get a URL like https://commander-clutch.vercel.app
Generate a QR code at https://qr.io and share with friends tonight.

## Files
- /public/index.html — Frontend UI
- /api/clutch.js — Serverless API (calls Anthropic securely)
- /vercel.json — Routing config
