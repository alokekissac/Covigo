# Covigo — Deployment Guide

## Files

```
covigo-deploy/
├── index.html                  ← Full app (map + AI assistant)
├── netlify.toml                ← Netlify config
├── netlify/functions/ai.js     ← Serverless Gemini proxy
└── README.md
```

---

## Step 1 — Get a FREE Gemini API key

1. Go to https://aistudio.google.com
2. Sign in with any Google account
3. Click **Get API key** → **Create API key**
4. Copy it — looks like `AIzaSy...`

Free tier: **1,500 requests/day** — plenty for personal use.

---

## Step 2 — Deploy to Netlify

1. Go to https://app.netlify.com and log in (free account)
2. Drag the entire **`covigo-deploy` folder** onto the deploy zone
3. Wait ~30 seconds — you'll get a live URL like `https://your-site.netlify.app`

---

## Step 3 — Add your API key

1. In Netlify → your site → **Site configuration** → **Environment variables**
2. Click **Add a variable**
   - Key: `GEMINI_API_KEY`
   - Value: `AIzaSy...` (your key from Step 1)
3. Click **Save**
4. Go to **Deploys** → **Trigger deploy** → **Deploy site**

Done! The AI assistant is now live and fully working for free.

---

## How it works

Browser → `/api/ai` (Netlify Function) → Gemini API → response back

Your API key stays on the server — never visible in the browser.
