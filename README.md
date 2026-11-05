# Fairway

A full-stack golf course conditions platform built with React, TypeScript, Express, and SQLite. Requires Node.js **22.13 or later** (uses built-in `node:sqlite`).

## Run locally

```sh
npm install
npm run dev
```

Open port **3000**. The server binds to `0.0.0.0`; Vite and the API share one origin. For production: `npm run build && npm start`, behind an HTTPS reverse proxy. Production session cookies are Secure and require HTTPS.

```sh
npm test             # seven rating integrity tests
npm run typecheck
npm run build
npm run seed         # idempotent initial database setup
```

## Features

- Search the curated 20-course US catalog by course, city, state, and ZIP.
- Interactive Leaflet map, rating markers, course previews, regional filters.
- Quick and detailed reports, photo uploads, category ratings, aeration and pace notes.
- Current, latest, and historical scores; condition history charts and report timeline.
- Recent-average and latest-report rankings, location/time/rating/distance filters.
- Up to four-course comparison, favorites, following, in-app update feed, editable profiles.
- Public browsing, salted scrypt authentication, hashed cookie session tokens.
- Helpful voting, flag collection, authenticated uploads, rate limits, same-origin checks, and a 12-hour per-user/per-course report guard.
- Responsive mobile layout and persistent bottom navigation.

## Data honesty

The first run creates `data/fairway.db` and seeds a **curated catalog**, not a live Google Places feed. Catalog references are recorded in `server/verifiedCourses.ts`. Official website and Google Maps direction links go to real external destinations; map tiles use CARTO/OpenStreetMap. Third-party fonts and map tiles require browser internet connectivity. Prices are published reference ranges, not live quotes; confirm directly with the course.

The interface starts in **explicit demonstration mode** with labeled sample reports. All seeded reports and sample photos are marked as demonstration data. Every generated course image is labeled illustrative, not an actual photograph of the named course. The **Live reports only** switch removes demonstration reports from ratings, rankings, photos, and timelines. The initial live-only experience has no condition reports. Sample reviewer accounts cannot sign in.

Current ratings use exponential decay with a seven-day half-life and exclude reports older than 30 days. Historical all-time scores are not presented as current conditions. A single recent report is labeled limited; old-only data is stale. Period filters affect rankings and report history; category summaries on course pages represent current 30-day conditions.

## Storage and operations

SQLite foreign keys are enabled, with WAL journaling. Runtime database and uploaded files are ignored by Git. Persist **both `data/` and `uploads/`** across deployments, and back them up. Run one application instance against the local database; use a managed relational database and object storage before horizontal scaling. Uploaded images are limited to four 5 MB JPEG/PNG/WebP files with signature checks. Uploaded photos are public by design.

Security hardening for a public launch should include: TLS, verified-email/reset-password delivery, a production distributed rate limiter, monitoring/backups, photo scanning/re-encoding, a moderation dashboard for collected flags, and a privacy/retention policy. The current sliding-window limiter is in-process. No email or push notifications are sent: followed-course updates are an in-app feed. The catalog does not yet provide worldwide course import or continuous official-information synchronization. No Google API key is required or configured.

## Publish a public website from GitHub

This repository includes a **Render Blueprint** (`render.yaml`) for the entire app, not a static-only GitHub Pages deployment.

1. Merge the deployment pull request into `main`.
2. Open https://render.com/deploy?repo=https://github.com/CorbinPlayz/Golf-quality-
3. Sign in to Render and authorize access to this GitHub repository. Select `main` if prompted.
4. Review the proposed **Starter web service and 1 GB persistent disk** and their current price. Hosting is paid; no service is purchased by adding this configuration.
5. Approve deployment. When its health check passes, open the HTTPS address displayed in the Render dashboard. The actual hostname is assigned by Render; do not assume a particular `onrender.com` address before deployment completes.

The blueprint installs build tools, runs checks, builds the frontend, and starts Express on Render's `PORT`. SQLite and uploaded photos reside under `/var/data/fairway` on the attached persistent disk. Keep a single instance. Use the provider's backups/snapshots and test restoration before collecting important user data. Subsequent GitHub deployments should preserve the disk. Deleting the disk destroys stored accounts/reports/photos.

**Environment variables:** `PORT` (default 3000), `DATA_DIR` (default `./data`), `UPLOADS_DIR` (default `./uploads`), `NODE_ENV` (`production` for hosting). `/api/health` checks database availability. SIGTERM/SIGINT stop accepting connections and close the database.

### Verify after deployment

- Open `/api/health` on your new domain: expect `{"status":"ok"}`.
- Open the homepage and a deep link such as `/rankings`.
- Create a new account, sign out/in, submit a report and photo, and save a course.
- Switch to **Live reports only** and confirm that demonstration reports disappear.
- Redeploy once, then verify the account/report/photo still exist.

The deploy link opens provider setup; it is **not** an already-live Fairway website. GitHub merging alone does not provision hosting.
