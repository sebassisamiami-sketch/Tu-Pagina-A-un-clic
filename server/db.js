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
  // Fecha en que la persona autorizó el tratamiento de sus datos (Ley 1581 de 2012).
  await pool.query("ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS autorizacion_datos TIMESTAMPTZ");
  await pool.query(SQL_VISITAS);
}

// Visitas: no se guardan IP ni datos personales. "visitante" es una huella anónima que cambia cada día.
const SQL_VISITAS = `
  CREATE TABLE IF NOT EXISTS visitas (
    id          BIGSERIAL PRIMARY KEY,
    creada      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    visitante   TEXT NOT NULL,
    ruta        TEXT NOT NULL,
    dispositivo TEXT,
    origen      TEXT
  );
  CREATE INDEX IF NOT EXISTS visitas_creada_idx ON visitas (creada DESC);
  CREATE TABLE IF NOT EXISTS presencia (
    visitante TEXT PRIMARY KEY,
    ruta      TEXT,
    visto     TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

async function registrarVisita({ visitante, ruta, dispositivo, origen }) {
  await pool.query(
    "INSERT INTO visitas (visitante, ruta, dispositivo, origen) VALUES ($1, $2, $3, $4)",
    [visitante, ruta, dispositivo, origen]
  );
  await marcarPresencia({ visitante, ruta });
}

async function marcarPresencia({ visitante, ruta }) {
  await pool.query(
    `INSERT INTO presencia (visitante, ruta, visto) VALUES ($1, $2, NOW())
     ON CONFLICT (visitante) DO UPDATE SET ruta = EXCLUDED.ruta, visto = NOW()`,
    [visitante, ruta]
  );
}

async function limpiarPresencia() {
  await pool.query("DELETE FROM presencia WHERE visto < NOW() - INTERVAL '1 day'");
}

function available() {
  return Boolean(pool);
}

async function crearSolicitud({ nombre, negocio, tipo, mensaje }) {
  const { rows } = await pool.query(
    `INSERT INTO solicitudes (nombre, negocio, tipo, mensaje, autorizacion_datos)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, creada`,
    [nombre, negocio || null, tipo, mensaje || null]
  );
  return rows[0];
}

module.exports = { init, available, crearSolicitud, registrarVisita, marcarPresencia, limpiarPresencia };
