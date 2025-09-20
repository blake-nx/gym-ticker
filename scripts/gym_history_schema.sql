-- Gym history schema
-- Run this script against the golbat DB, configured via DB_NAME.
-- It creates the gym_history and gym_team_changes tables along with the
-- contested_gyms_24h helper view used by the Gym History dashboard.

CREATE TABLE IF NOT EXISTS gym_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  timestamp INT UNSIGNED NOT NULL,
  team_mystic INT UNSIGNED NOT NULL DEFAULT 0,
  team_valor INT UNSIGNED NOT NULL DEFAULT 0,
  team_instinct INT UNSIGNED NOT NULL DEFAULT 0,
  total_gyms INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS gym_team_changes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  gym_id VARCHAR(35) NOT NULL,
  old_team_id TINYINT UNSIGNED NULL,
  new_team_id TINYINT UNSIGNED NULL,
  changed_at INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  KEY idx_gym_id (gym_id),
  KEY idx_changed_at (changed_at),
  CONSTRAINT fk_gym_team_changes_gym FOREIGN KEY (gym_id)
    REFERENCES gym (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP VIEW IF EXISTS contested_gyms_24h;

CREATE VIEW contested_gyms_24h AS
SELECT
  gtc.gym_id,
  g.name AS gym_name,
  g.lat,
  g.lon,
  g.url,
  COUNT(gtc.id) AS change_count,
  MAX(gtc.changed_at) AS last_changed
FROM gym_team_changes gtc
JOIN gym g ON gtc.gym_id = g.id
WHERE gtc.changed_at > UNIX_TIMESTAMP() - 86400
GROUP BY gtc.gym_id, g.name, g.lat, g.lon, g.url
ORDER BY change_count DESC;
