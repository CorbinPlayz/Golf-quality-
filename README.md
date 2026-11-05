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
