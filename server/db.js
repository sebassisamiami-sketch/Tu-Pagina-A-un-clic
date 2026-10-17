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

async function listarSolicitudes({ filtro = "todas", limite = 200 } = {}) {
  const where =
    filtro === "pendientes" ? "WHERE atendida = FALSE" :
    filtro === "atendidas" ? "WHERE atendida = TRUE" : "";
  const { rows } = await pool.query(
    `SELECT id, creada, nombre, negocio, tipo, mensaje, atendida
     FROM solicitudes ${where}
     ORDER BY creada DESC
     LIMIT $1`,
    [limite]
  );
  return rows;
}

async function contarSolicitudes() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE atendida = FALSE)::int AS pendientes
     FROM solicitudes`
  );
  return rows[0];
}

async function marcarAtendida(id, atendida) {
  const { rowCount } = await pool.query("UPDATE solicitudes SET atendida = $2 WHERE id = $1", [id, atendida]);
  return rowCount > 0;
}

module.exports = { init, available, crearSolicitud, listarSolicitudes, contarSolicitudes, marcarAtendida };
