# Gym Ticker

Gym Ticker is a Next.js 15 dashboard for watching live Pokémon GO gym ownership and long-term control trends inside a configured geofence. It ships with everything needed to stand up the tracker: the SQL schema for persistence, a Node.js collection script that writes ownership snapshots, and a real-time web UI with history charts and defender statistics.

## Features

- **Live team ticker** – Streams the latest gyms owned by Mystic, Valor, and Instinct with defender previews, slot availability, and recency metadata.
- **Ownership history** – Persists aggregate team counts on an interval and renders them as 6h/12h/24h/48h/7d charts alongside the most contested gyms.
- **Defender analytics** – Surfaces per-team defender counts, CP totals, and the most common/strongest Pokémon observed in the geofence.
- **Token-gated API** – Optional secret-based access control for internal refreshes or external dashboards consuming `/api/gyms`.
- **Drop-in deployment** – Works with RocketMap/Monocle-style databases that expose `gym` and `geofence` tables.

## Prerequisites

- **Node.js 18.18+** (Next.js 15 and React 19 require an up-to-date runtime).
- **MySQL-compatible database** populated by RocketMap, Monocle, RDM, or a similar scanner that exposes a `gym` table with `defenders` JSON and a `geofence` table containing polygon geometry.
- Ability to schedule the collector script via cron, systemd, PM2, or another process manager.

## Quick start

1. **Install dependencies**
   ```bash
   npm install
   ```
2. **Configure the database schema** – Run the bundled SQL against the RocketMap/Monocle database referenced by `DB_NAME`:
   ```bash
   mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < scripts/gym_history_schema.sql
   ```
3. **Create an environment file** – Copy `env.example` to `.env.local` (Next.js) and/or `.env` (collector) and fill in the values below.
4. **Prime the history tables** – Execute the collector once to capture an initial snapshot:
   ```bash
   node scripts/collectGymHistory.js
   ```
5. **Start the development server** –
   ```bash
   npm run dev
   ```
   The dashboard becomes available at [http://localhost:3000](http://localhost:3000). Use `npm run build && npm run start` for production deployments.

### Environment variables

| Variable | Required | Default | Description |
| --- | :---: | --- | --- |
| `DB_HOST` | ✅ | – | MySQL host that stores the `gym` and supporting tables. |
| `DB_PORT` | ✅ | `3306` | Port for the MySQL server. |
| `DB_USER` | ✅ | – | Database user with read/write access to `DB_NAME`. |
| `DB_PASS` | ✅ | – | Password for `DB_USER`. |
| `DB_NAME` | ✅ | – | Database containing the RocketMap/Monocle `gym` table. |
| `GEOFENCE_DB_NAME` | ✅ | – | Database that stores the `geofence` table used for spatial filtering. |
| `GEOFENCE_ID` | ✅ | – | Identifier of the geofence polygon that bounds tracked gyms. |
| `NEXT_PUBLIC_APP_URL` | ❌ | `http://localhost:3000` | Public base URL used when the app makes server-side fetches in production. |
| `GYM_HISTORY_RETENTION_DAYS` | ❌ | `7` | Number of days of history and team-change records retained by the collector. |
| `GYM_TIME_WINDOW` | ❌ | `3600` | Seconds of gym updates exposed to the ticker/UI API. |
| `DB_POOL_SIZE` | ❌ | `10` | Maximum MySQL connections for the collector when inserting history rows. |
| `INTERNAL_API_SECRET` | ❌ | – | Enables token-gated access to `POST /api/gyms` for secure refreshes. Leave empty to expose the API without authentication. |

The collector automatically reads `.env`, `.env.local`, and their mode-specific variants on startup. The Next.js app reads `.env.local` during build/dev just like any other Next project.

### Scheduling the history collector

Running `node scripts/collectGymHistory.js` records the current team counts, tracks gym flips, and prunes data older than `GYM_HISTORY_RETENTION_DAYS`. To keep history current, schedule the script every five minutes (or your preferred cadence):

```cron
*/5 * * * * cd /path/to/gym-ticker && /usr/bin/env NODE_ENV=production /usr/bin/node scripts/collectGymHistory.js >> /var/log/gym-collector.log 2>&1
```

A PM2 alternative looks like:

```bash
pm2 start scripts/collectGymHistory.js --name gym-history --cron "*/5 * * * *"
```

### API endpoints

The web app exposes JSON endpoints that mirror the UI data requirements:

- `GET /api/gyms` – Returns the latest ticker snapshot. If `INTERNAL_API_SECRET` is defined, request a one-minute token via `POST /api/gyms` with header `x-internal-secret` before calling this endpoint and supply the token through `x-access-token`.
- `GET /api/gym-history?period=24h` – Provides chart data, contested gyms, and aggregate counts for the selected period (`6h`, `12h`, `24h`, `48h`, or `7d`).
- `GET /api/defender-stats` – Aggregated defender counts and CP breakdowns per team.

These APIs are leveraged internally by the App Router components but can also power external signage or alerting tools.

## Development tooling

- `npm run dev` – Launches the Next.js development server with Turbopack.
- `npm run build` / `npm run start` – Production build and serve commands.
- `npm run lint` – Runs ESLint with the Next.js configuration.

Feel free to open issues or PRs for feature requests, bug fixes, or documentation improvements.
