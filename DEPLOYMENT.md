# TRUTH-NET Deployment Guide

Get TRUTH-NET live on a custom domain so others can access it.

## Architecture

```
[Your Domain] → Vercel (Frontend SPA)
                    ↓ (API proxy)
               Railway (Backend API + WebSocket + PostgreSQL)
```

## Step 1: Deploy Backend to Railway

Railway gives you a production URL with SSL, database, and auto-deploys from GitHub.

### 1a. Connect Repository
1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `agentic-consensus-infra`
4. Railway auto-detects Node.js and uses the `railway.json` config

### 1b. Add PostgreSQL
1. In your Railway project, click **+ New Service** → **Database** → **PostgreSQL**
2. Railway auto-injects `DATABASE_URL` into your backend service

### 1c. Set Environment Variables
In the Railway dashboard, add these to your backend service:

```env
NODE_ENV=production
PORT=3000
WS_PORT=3001

# Stripe (get from dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Frontend URL (update after Vercel deploy)
FRONTEND_URL=https://truthnet.io

# Rating Engine
MIN_TRADES_FOR_RATING=20
MIN_TRADES_FOR_CERTIFICATION=50
CERTIFICATION_VALIDITY_DAYS=90
```

### 1d. Get Your Railway URL
Railway gives you a URL like `truthnet-backend-production.up.railway.app`.
Save this — you'll need it for the frontend proxy.

## Step 2: Deploy Frontend to Vercel

### 2a. Connect Repository
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New** → **Project** → Select `agentic-consensus-infra`
3. Set the **Root Directory** to `ui`
4. Set **Framework Preset** to `Vite`
5. Set **Build Command** to `npm run build`
6. Set **Output Directory** to `dist`

### 2b. Set Environment Variables
```env
VITE_API_URL=https://truthnet-backend-production.up.railway.app
VITE_WS_URL=wss://truthnet-backend-production.up.railway.app/ws
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

### 2c. Update vercel.json
Edit `ui/vercel.json` and replace `your-railway-app.railway.app` with your actual Railway URL.

### 2d. Deploy
Push to `main` and Vercel auto-deploys.

## Step 3: Custom Domain

### Option A: Vercel Domain (Easiest)
1. In Vercel dashboard → your project → **Settings** → **Domains**
2. Add `truthnet.io` (or your domain)
3. Vercel gives you DNS records (A record or CNAME)
4. Add these to your domain registrar (Namecheap, Cloudflare, GoDaddy, etc.)

### Option B: Cloudflare (Recommended for production)
1. Add your domain to Cloudflare
2. Point nameservers to Cloudflare
3. Add DNS records:
   - `@` → CNAME to `cname.vercel-dns.com` (proxied)
   - `api` → CNAME to your Railway URL (proxied)
4. Enable "Full (Strict)" SSL

### DNS Records Example:
```
Type    Name    Value                                       Proxy
CNAME   @       cname.vercel-dns.com                        Yes
CNAME   api     truthnet-backend.up.railway.app             Yes
CNAME   www     cname.vercel-dns.com                        Yes
```

## Step 4: Stripe Webhook

1. Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://api.truthnet.io/v1/payments/webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to Railway env vars as `STRIPE_WEBHOOK_SECRET`

## Step 5: Initialize Database

SSH into Railway or use the Railway CLI:

```bash
railway run psql $DATABASE_URL < src/db/schema.sql
```

Or use the Railway database plugin's SQL editor to paste and run the schema.

## Step 6: Verify

1. Visit `https://truthnet.io` — should see the onboarding page
2. Visit `https://truthnet.io/public/leaderboard` — public leaderboard (no auth)
3. Test API: `curl https://api.truthnet.io/v1/health`
4. Test WebSocket: connect to `wss://api.truthnet.io/ws`

## Quick Deploy Checklist

- [ ] Railway backend deployed and running
- [ ] PostgreSQL provisioned and schema loaded
- [ ] Stripe keys configured
- [ ] Vercel frontend deployed
- [ ] Custom domain DNS configured
- [ ] SSL certificates active
- [ ] Stripe webhook endpoint registered
- [ ] CORS origins updated in backend
- [ ] Test: onboarding flow works
- [ ] Test: demo mode works
- [ ] Test: public leaderboard loads
- [ ] Test: embeddable badge renders
