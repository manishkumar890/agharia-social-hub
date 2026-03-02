# Supabase Proxy for Jio ISP Bypass

This is a simple Vercel serverless function that proxies requests to your Supabase backend, bypassing ISP-level domain blocking.

## Setup Instructions

### 1. Create a GitHub repo
- Go to https://github.com/new
- Create a new repo (e.g., `supabase-proxy`)
- Push ONLY the contents of this `vercel-proxy` folder to that repo

### 2. Deploy on Vercel (Free)
- Go to https://vercel.com and sign in with GitHub
- Click "Add New" → "Project"
- Import your `supabase-proxy` repo
- Click "Deploy" (no configuration needed)

### 3. Get your proxy URL
- After deployment, Vercel gives you a URL like: `https://supabase-proxy-xxxxx.vercel.app`
- Your proxy endpoint will be: `https://supabase-proxy-xxxxx.vercel.app/api/proxy`

### 4. (Optional) Add custom domain
- In Vercel project settings → Domains
- Add `api.aghariasamaj.com` or any subdomain
- Follow Vercel's DNS instructions

### 5. Update the app
- In `src/lib/polyfills.ts`, update `PROXY_ORIGIN` to your Vercel URL
- Example: `const PROXY_ORIGIN = 'https://supabase-proxy-xxxxx.vercel.app/api/proxy';`

## How it works
All Supabase API requests are routed through this proxy. For example:
- `https://your-proxy.vercel.app/api/proxy/rest/v1/profiles` → `https://xxx.supabase.co/rest/v1/profiles`
- `https://your-proxy.vercel.app/api/proxy/auth/v1/token` → `https://xxx.supabase.co/auth/v1/token`
