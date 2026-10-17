const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
      max: 5,
    })
  : null;

if (pool) {
  pool.on("error", (err) => console.error("Error en la conexión a la base de datos:", err.message));
}

async function init() {
  if (!pool) {
    console.warn("DATABASE_URL no está definida: las solicitudes no se guardarán.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS solicitudes (
      id         SERIAL PRIMARY KEY,
      creada     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      nombre     TEXT NOT NULL,
      negocio    TEXT,
      tipo       TEXT NOT NULL,
      mensaje    TEXT,
      atendida   BOOLEAN NOT NULL DEFAULT FALSE
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS solicitudes_creada_idx ON solicitudes (creada DESC)");
}

function available() {
  return Boolean(pool);
}

async function crearSolicitud({ nombre, negocio, tipo, mensaje }) {
  const { rows } = await pool.query(
    `INSERT INTO solicitudes (nombre, negocio, tipo, mensaje)
     VALUES ($1, $2, $3, $4)
     RETURNING id, creada`,
    [nombre, negocio || null, tipo, mensaje || null]
  );
  return rows[0];
}

module.exports = { init, available, crearSolicitud };
