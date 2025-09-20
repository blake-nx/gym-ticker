#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function setEnvValue(key, value, { override }) {
  if (!override && process.env[key] !== undefined) {
    return;
  }
  process.env[key] = value;
}

function parseValue(raw) {
  let value = raw.trim();

  const isDoubleQuoted = value.startsWith("\"") && value.endsWith("\"");
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'");

  if (isDoubleQuoted || isSingleQuoted) {
    value = value.slice(1, -1);
  } else {
    const commentIndex = value.indexOf("#");
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex).trim();
    }
  }

  return value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
}

function loadEnvFile(filePath, { override }) {
  const contents = fs.readFileSync(filePath, "utf8");
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_\.]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    const value = parseValue(rawValue);
    setEnvValue(key, value, { override });
  }
}

function loadEnv() {
  const cwd = process.cwd();
  const mode = process.env.NODE_ENV || "development";

  const baseFiles = [`.env`, `.env.${mode}`];
  const overrideFiles = [`.env.local`, `.env.${mode}.local`];

  for (const file of baseFiles) {
    const filePath = path.join(cwd, file);
    if (fs.existsSync(filePath)) {
      loadEnvFile(filePath, { override: false });
    }
  }

  for (const file of overrideFiles) {
    const filePath = path.join(cwd, file);
    if (fs.existsSync(filePath)) {
      loadEnvFile(filePath, { override: true });
    }
  }
}

loadEnv();


function ensure(value, name) {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function ensureIdentifier(value, name) {
  const identifier = ensure(value, name);
  if (!/^\w+$/.test(identifier)) {
    throw new Error(`${name} contains unsupported characters`);
  }
  return identifier;
}

async function trackTeamChanges(connection, config) {
  const { dbName, geofenceDbName, geofenceId } = config;

  const [currentRows] = await connection.query(
    `
      SELECT id, team_id
      FROM ${dbName}.gym
      WHERE enabled = 1
        AND ST_CONTAINS(
          ST_GeomFromGeoJSON(
            (SELECT geometry FROM ${geofenceDbName}.geofence WHERE id = ?), 2, 0
          ),
          POINT(lon, lat)
        )
    `,
    [geofenceId],
  );

  const [lastStateRows] = await connection.query(
    `
      SELECT gtc.gym_id, gtc.new_team_id
      FROM gym_team_changes gtc
      JOIN (
        SELECT gym_id, MAX(changed_at) AS last_changed
        FROM gym_team_changes
        GROUP BY gym_id
      ) latest ON latest.gym_id = gtc.gym_id AND latest.last_changed = gtc.changed_at
    `,
  );

  const lastStateMap = new Map();
  for (const row of lastStateRows) {
    lastStateMap.set(row.gym_id, row.new_team_id);
  }

  const timestamp = Math.floor(Date.now() / 1000);

  for (const row of currentRows) {
    const currentTeam = row.team_id ?? null;
    const lastTeam = lastStateMap.get(row.id);

    if (lastTeam === undefined) {
      await connection.execute(
        `
          INSERT INTO gym_team_changes (gym_id, old_team_id, new_team_id, changed_at)
          VALUES (?, ?, ?, ?)
        `,
        [row.id, null, currentTeam, timestamp],
      );
      lastStateMap.set(row.id, currentTeam);
    } else if (lastTeam !== currentTeam) {
      await connection.execute(
        `
          INSERT INTO gym_team_changes (gym_id, old_team_id, new_team_id, changed_at)
          VALUES (?, ?, ?, ?)
        `,
        [row.id, lastTeam, currentTeam, timestamp],
      );
      lastStateMap.set(row.id, currentTeam);
    }
  }
}

async function collectGymHistory() {
  const dbHost = ensure(process.env.DB_HOST, "DB_HOST");
  const dbPort = Number(process.env.DB_PORT || 3306);
  const dbUser = ensure(process.env.DB_USER, "DB_USER");
  const dbPass = ensure(process.env.DB_PASS, "DB_PASS");
  const dbName = ensureIdentifier(process.env.DB_NAME, "DB_NAME");
  const geofenceDbName = ensureIdentifier(
    process.env.GEOFENCE_DB_NAME,
    "GEOFENCE_DB_NAME",
  );
  const geofenceId = ensure(process.env.GEOFENCE_ID, "GEOFENCE_ID");

  const retentionDays = Number(process.env.GYM_HISTORY_RETENTION_DAYS || 7);
  const retentionSeconds = Math.max(Math.floor(retentionDays * 24 * 60 * 60), 1);

  const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPass,
    database: dbName,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
    queueLimit: 0,
  });

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [countRows] = await connection.query(
      `
        SELECT
          SUM(CASE WHEN team_id = 1 THEN 1 ELSE 0 END) AS mystic,
          SUM(CASE WHEN team_id = 2 THEN 1 ELSE 0 END) AS valor,
          SUM(CASE WHEN team_id = 3 THEN 1 ELSE 0 END) AS instinct,
          COUNT(*) AS total
        FROM ${dbName}.gym
        WHERE enabled = 1
          AND ST_CONTAINS(
            ST_GeomFromGeoJSON(
              (SELECT geometry FROM ${geofenceDbName}.geofence WHERE id = ?), 2, 0
            ),
            POINT(lon, lat)
          )
      `,
      [geofenceId],
    );

    const countsRow = countRows[0] || {};
    const mysticCount = Number(countsRow.mystic || 0);
    const valorCount = Number(countsRow.valor || 0);
    const instinctCount = Number(countsRow.instinct || 0);
    const totalCount = Number(countsRow.total || 0);

    await connection.execute(
      `
        INSERT INTO gym_history (timestamp, team_mystic, team_valor, team_instinct, total_gyms)
        VALUES (UNIX_TIMESTAMP(), ?, ?, ?, ?)
      `,
      [mysticCount, valorCount, instinctCount, totalCount],
    );

    await trackTeamChanges(connection, { dbName, geofenceDbName, geofenceId });

    await connection.execute(
      `DELETE FROM gym_history WHERE timestamp < UNIX_TIMESTAMP() - ?`,
      [retentionSeconds],
    );
    await connection.execute(
      `DELETE FROM gym_team_changes WHERE changed_at < UNIX_TIMESTAMP() - ?`,
      [retentionSeconds],
    );

    await connection.commit();

    console.log(
      `[${new Date().toISOString()}] Gym history collected successfully`,
    );
  } catch (error) {
    await connection.rollback();
    console.error("Error collecting gym history:", error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  collectGymHistory()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}

module.exports = collectGymHistory;
