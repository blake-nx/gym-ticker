import mysql from "mysql2/promise";

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,

  // Connection pool settings
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

pool
  .getConnection()
  .then((connection) => {
    console.log("Database connection pool established");
    connection.release();
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
  });

export default pool;
