# OpenAlgo Netlify Deployment Guide

## Quick Deploy (One-Click)

### Option 1: Netlify UI (Easiest)
1. Push your code to GitHub
2. Go to [Netlify Dashboard](https://app.netlify.com)
3. Click "Add new site" → "Import an existing project"
4. Select your GitHub repository
5. Build settings will auto-detect from `netlify.toml`:
   - Build command: `cd src/ui && npm run build`
   - Publish directory: `src/ui/.next`
6. Click "Deploy site"

### Option 2: Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

### Option 3: GitHub Actions (Automated)
Already configured in `.github/workflows/netlify-deploy.yml`
- Push to `main` → Auto-deploy to production
- Push to other branches → Deploy preview

## Environment Variables

Set these in Netlify Dashboard → Site settings → Environment variables:

**Required:**
- `NEXT_PUBLIC_API_URL` - Your backend API URL
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` - From [WalletConnect Cloud](https://cloud.walletconnect.com)

**Optional:**
- `NEXT_PUBLIC_ALCHEMY_KEY` - For Ethereum data
- `NEXT_PUBLIC_ENABLE_TRADING` - Feature flag

See `.env.netlify.example` for full list.

## Build Verification

The build will fail if:
- `npm run build` errors
- Tests fail (non-blocking)
- Node modules missing

To test locally:
```bash
cd src/ui
npm ci --legacy-peer-deps
npm run build
```

## Troubleshooting

**Build fails with "Cannot find module"**
→ Run `npm ci --legacy-peer-deps` in `src/ui/`

**Environment variables not working**
→ Must use `NEXT_PUBLIC_` prefix for client-side vars

**API calls fail after deploy**
→ Check `NEXT_PUBLIC_API_URL` points to live backend

**Wallet connection issues**
→ Verify `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is set

## Files Created

- `netlify.toml` - Netlify configuration
- `.env.netlify.example` - Environment variable template
- `.github/workflows/netlify-deploy.yml` - CI/CD workflow
- `scripts/deploy-netlify.sh` - Manual deployment script
