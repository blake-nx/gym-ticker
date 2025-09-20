# Gym Ticker

Gym Ticker is a Pogo gym control tracker. It combines a MySQL schema, a Node.js history collector, and a real-time dashboard so you can display a ticker of gyms by team within a chosen geofence.

## Features

- **Live ticker** – See which team currently owns each gym along with defender previews and slot availability.
- **History charts** – Track long-term Mystic, Valor, and Instinct control across multiple time windows.
- **Defender stats** – Review the Pokémon species, counts, and combined CP that appear most often in the fence.
- **Contested gym list** – Surface gyms that flip teams the most so you can focus response efforts.

## Prerequisites

- Node.js **18.18 or newer** and npm.
- A Unown stack (Golbat) database with `gym` data (including defender JSON) and a koji/geofence table.
- Permission to create tables inside the database that will store the history records.
- A way to run scheduled jobs such as cron, systemd timers, or PM2.

## Requirements

Create `.env` for the Next.js app based on `env.example`. At minimum you must provide:

| Variable                                                                   | Description                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`                      | Connection details for the database that contains the RocketMap/Monocle `gym` table.                    |
| `GEOFENCE_DB_NAME`, `GEOFENCE_ID`                                          | Point the collector and dashboard to the geofence polygon that bounds the gyms you care about.          |
| `NEXT_PUBLIC_APP_URL`                                                      | Public base URL used for server-side fetches in production. Keep `http://localhost:3000` for local dev. |
| `NEXT_PUBLIC_MAP_URL` (optional)                                           | Adds "View map" links that hand off to your live scanner map.                                           |
| `GYM_HISTORY_RETENTION_DAYS`, `GYM_TIME_WINDOW`, `DB_POOL_SIZE` (optional) | Tune history retention, UI window, and collector connection pool sizes.                                 |

## Installing

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/your-org/gymticker.git
   cd gymticker
   npm install
   ```
2. Copy `env.example` to `.env`, then fill in the variables listed above.
3. Create the history tables inside your RocketMap/Monocle database:
   ```bash
   mysql -h $DB_HOST -u $DB_USER -p$DB_PASS $DB_NAME < scripts/gym_history_schema.sql
   ```

## Running

### Collect gym history

Run the collector once to populate the tables and verify connectivity:

```bash
node scripts/collectGymHistory.js
```

Schedule the same command every five minutes (or your preferred cadence) to keep the history current. A cron entry looks like:

```cron
*/5 * * * * cd /path/to/gymticker && /usr/bin/env NODE_ENV=production /usr/bin/node scripts/collectGymHistory.js >> /var/log/gymticker.log 2>&1
```

### Start the dashboard

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the dashboard. For production builds run `npm run build` followed by `npm run start` on your server.
