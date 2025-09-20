# Gym Ticker

A drop-in Next.js dashboard for tracking live Pokémon GO gym ownership, historical control trends, and defender statistics for a configured geofence. The project includes the database schema, data collection script, and UI needed to deploy gym history tracking end to end.

## Quick Start

1. **Apply the schema** – Run the bundled SQL script against your RocketMap/Monocle database: `mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < scripts/gym_history_schema.sql`.
2. **Configure environment variables** – Populate `.env.local` (or `.env`) with the values below. The collector loads the same files automatically, so no extra exports are required for PM2/cron runs.
3. **Install dependencies** – `npm install`.
4. **Start the history collector** – `pm2 start scripts/collectGymHistory.js --name gym-history --cron "*/5 * * * *"` or run the script with cron/systemd.
5. **Launch the dashboard** – `npm run dev` for development or `npm run build && npm run start` in production.

## Features

- **Historical Tracking** – Stores gym ownership snapshots every collector run and aggregates data for 6h/12h/24h/48h/7d views.
- **Live Chart** – Realtime area/line charts with hover details that auto-refresh every 30 seconds.
- **Most Contested Gyms** – Highlights gyms that flip teams most often with recent transition visuals.
- **Visual Team Changes** – Shows the last five team transitions per contested gym.
- **Automated Cleanup** – Keeps only the last seven days of history by default to prevent database bloat.
- **Defender Statistics** – Aggregates defender usage and surfaces the strongest defenders across all teams.

## Environment Variables

Create a `.env.local` file for Next.js (or `.env` in production). The collector reads the same files on startup, so the values only need to live in one place. Defaults are shown where applicable.

| Variable                     | Required | Default                 | Purpose                                                           |
| ---------------------------- | :------: | ----------------------- | ----------------------------------------------------------------- |
| `DB_HOST`                    |    ✅    | –                       | MySQL host for the RocketMap/Monocle database.                    |
| `DB_PORT`                    |    ✅    | `3306`                  | MySQL port.                                                       |
| `DB_USER`                    |    ✅    | –                       | Database user with read/write access to `DB_NAME`.                |
| `DB_PASS`                    |    ✅    | –                       | Password for `DB_USER`.                                           |
| `DB_NAME`                    |    ✅    | –                       | Main database containing the `gym` table.                         |
| `GEOFENCE_DB_NAME`           |    ✅    | –                       | Database storing geofences with `geometry` data.                  |
| `GEOFENCE_ID`                |    ✅    | –                       | Geofence ID that bounds the gyms being tracked.                   |
| `GYM_HISTORY_RETENTION_DAYS` |    ❌    | `7`                     | Number of days of history to retain before cleanup.               |
| `DB_POOL_SIZE`               |    ❌    | `10`                    | Maximum concurrent MySQL connections for the collector.           |
| `GYM_TIME_WINDOW`            |    ❌    | `3600`                  | Seconds of defender/gym data surfaced via the API.                |
| `INTERNAL_API_SECRET`        |    ❌    | –                       | Enables token-based access to `GET /api/gyms` for server actions. |
| `NEXT_PUBLIC_APP_URL`        |    ❌    | `http://localhost:3000` | Base URL used for server-side fetches in production.              |

## Database Schema

The `scripts/gym_history_schema.sql` file is idempotent and safe to rerun. It creates the `gym_history` and `gym_team_changes` tables plus the `contested_gyms_24h` view leveraged by the dashboard. Apply it to the database referenced by `DB_NAME`:

```bash
mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < scripts/gym_history_schema.sql
```
