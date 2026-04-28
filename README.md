# Zoodealio Office Dashboard

Live office TV dashboard for the Zoodealio real estate team. Landscape 16:9, kiosk-mode, refreshes every 5 minutes.

Metrics come from two Google Sheets — see [`docs/sheet-mapping.md`](docs/sheet-mapping.md) for the full spec.

## Architecture

- **Frontend**: static HTML/CSS/JS in `public/`, served by Vercel's CDN.
- **Backend**: one Vercel serverless function at `/api/metrics` that reads the sheets and returns a JSON blob.
- **Auth to Sheets**: Google service account, read-only.
- **Refresh**: browser polls `/api/metrics` every 5 minutes; Vercel edge-caches the response for 4 minutes.

## First-time setup

Walk through [`docs/setup-checklist.md`](docs/setup-checklist.md) once: Google service account, share the sheets, drop env vars into Vercel, kiosk mode on the mini-PC.

## Local development

```bash
cp .env.example .env.local   # then fill in service account creds
npm install
npx vercel dev
```

Open http://localhost:3000.

## Deploy

Linked to https://zoodealio-dashboard.vercel.app — push to `main` to auto-deploy, or run `npx vercel deploy --prod`.

## Brand assets

Drop real SVGs into `public/assets/` — file names must match the slots documented in `public/assets/README.md` (added in the UI pass).
