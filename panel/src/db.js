const { Pool, types } = require("pg");

// Las fechas (sin hora) se manejan como texto AAAA-MM-DD para evitar corrimientos por zona horaria.
types.setTypeParser(1082, (v) => v);

if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL: el panel necesita la base de datos para funcionar.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 5,
});
pool.on("error", (err) => console.error("Error en la conexión a la base de datos:", err.message));

const ORIGENES = {
  web: "Página web",
  whatsapp: "WhatsApp",
  correo: "Correo",
  llamada: "Llamada",
  referido: "Referido",
  redes: "Redes sociales",
  otro: "Otro",
};

const ESTADOS = {
  nueva: "Nueva",
  contactada: "Contactada",
  cotizada: "Cotizada",
  ganada: "Ganada",
  perdida: "Perdida",
};

const TIPOS = [
  "una página web",
  "una aplicación móvil",
  "una página web y una app",
  "un sistema a la medida",
  "asesoría, todavía no lo tengo claro",
];

async function migrar() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id          SERIAL PRIMARY KEY,
      creado      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      actualizado TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      nombre      TEXT NOT NULL,
      negocio     TEXT,
      telefono    TEXT,
      correo      TEXT,
      ciudad      TEXT,
      notas       TEXT
    );

    -- La página pública crea esta tabla con sus columnas básicas; el panel le agrega el resto.
    CREATE TABLE IF NOT EXISTS solicitudes (
      id         SERIAL PRIMARY KEY,
      creada     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      nombre     TEXT NOT NULL,
      negocio    TEXT,
      tipo       TEXT NOT NULL,
      mensaje    TEXT,
      atendida   BOOLEAN NOT NULL DEFAULT FALSE
    );

    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS origen      TEXT NOT NULL DEFAULT 'web';
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS estado      TEXT NOT NULL DEFAULT 'nueva';
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS telefono    TEXT;
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS correo      TEXT;
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS valor       NUMERIC(14, 0);
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS seguimiento DATE;
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS notas       TEXT;
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS cliente_id  INTEGER REFERENCES clientes(id) ON DELETE SET NULL;
    ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS actualizada TIMESTAMPTZ NOT NULL DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS solicitudes_creada_idx  ON solicitudes (creada DESC);
    CREATE INDEX IF NOT EXISTS solicitudes_estado_idx  ON solicitudes (estado);
    CREATE INDEX IF NOT EXISTS solicitudes_cliente_idx ON solicitudes (cliente_id);
    CREATE INDEX IF NOT EXISTS clientes_nombre_idx     ON clientes (lower(nombre));
  `);

  // Solicitudes que ya se habían marcado como atendidas en la versión anterior.
  await pool.query(
    "UPDATE solicitudes SET estado = 'contactada' WHERE atendida = TRUE AND estado = 'nueva'"
  );
}

const HOY = "(NOW() AT TIME ZONE 'America/Bogota')::date";

/* ---------- Resumen ---------- */

async function resumen() {
  const [porEstado, seguimientos, recientes, totales] = await Promise.all([
    pool.query("SELECT estado, COUNT(*)::int AS n FROM solicitudes GROUP BY estado"),
    pool.query(
      `SELECT s.id, s.nombre, s.negocio, s.estado, s.seguimiento, s.origen,
              (s.seguimiento < ${HOY}) AS vencido
       FROM solicitudes s
       WHERE s.seguimiento IS NOT NULL AND s.seguimiento <= ${HOY} + 7
         AND s.estado NOT IN ('ganada', 'perdida')
       ORDER BY s.seguimiento ASC
       LIMIT 20`
    ),
    pool.query(
      `SELECT id, creada, nombre, negocio, origen, estado, tipo
       FROM solicitudes ORDER BY creada DESC LIMIT 6`
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM clientes) AS clientes,
         (SELECT COUNT(*)::int FROM solicitudes WHERE creada >= date_trunc('month', NOW() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota') AS mes,
         (SELECT COALESCE(SUM(valor), 0)::bigint FROM solicitudes WHERE estado = 'cotizada') AS cotizado,
         (SELECT COALESCE(SUM(valor), 0)::bigint FROM solicitudes WHERE estado = 'ganada') AS ganado`
    ),
  ]);
  const estados = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0]));
  porEstado.rows.forEach((r) => (estados[r.estado] = r.n));
  return { estados, seguimientos: seguimientos.rows, recientes: recientes.rows, totales: totales.rows[0] };
}

/* ---------- Solicitudes ---------- */

function filtrosSolicitudes({ estado, origen, q, cliente }) {
  const where = [];
  const params = [];
  if (estado && ESTADOS[estado]) {
    params.push(estado);
    where.push(`s.estado = $${params.length}`);
  } else if (estado === "abiertas") {
    where.push("s.estado NOT IN ('ganada', 'perdida')");
  }
  if (origen && ORIGENES[origen]) {
    params.push(origen);
    where.push(`s.origen = $${params.length}`);
  }
  if (cliente) {
    params.push(cliente);
    where.push(`s.cliente_id = $${params.length}`);
  }
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(
      `(s.nombre ILIKE $${i} OR s.negocio ILIKE $${i} OR s.mensaje ILIKE $${i} OR s.notas ILIKE $${i} OR s.telefono ILIKE $${i} OR s.correo ILIKE $${i})`
    );
  }
  return { sql: where.length ? "WHERE " + where.join(" AND ") : "", params };
}

async function listarSolicitudes(filtros = {}, limite = 300) {
  const { sql, params } = filtrosSolicitudes(filtros);
  params.push(limite);
  const { rows } = await pool.query(
    `SELECT s.*, c.nombre AS cliente_nombre,
            (s.seguimiento IS NOT NULL AND s.seguimiento < ${HOY} AND s.estado NOT IN ('ganada','perdida')) AS vencido
     FROM solicitudes s LEFT JOIN clientes c ON c.id = s.cliente_id
     ${sql}
     ORDER BY s.creada DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function obtenerSolicitud(id) {
  const { rows } = await pool.query(
    `SELECT s.*, c.nombre AS cliente_nombre
     FROM solicitudes s LEFT JOIN clientes c ON c.id = s.cliente_id
     WHERE s.id = $1`,
    [id]
  );
  return rows[0] || null;
}

const CAMPOS_SOLICITUD = ["nombre", "negocio", "telefono", "correo", "tipo", "mensaje", "origen", "estado", "valor", "seguimiento", "notas", "cliente_id"];

async function crearSolicitud(d) {
  const valores = CAMPOS_SOLICITUD.map((c) => d[c] ?? null);
  const { rows } = await pool.query(
    `INSERT INTO solicitudes (${CAMPOS_SOLICITUD.join(", ")}, atendida)
     VALUES (${CAMPOS_SOLICITUD.map((_, i) => `$${i + 1}`).join(", ")}, $${CAMPOS_SOLICITUD.length + 1})
     RETURNING id`,
    [...valores, d.estado !== "nueva"]
  );
  return rows[0].id;
}

async function actualizarSolicitud(id, d) {
  const sets = CAMPOS_SOLICITUD.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const { rowCount } = await pool.query(
    `UPDATE solicitudes SET ${sets}, atendida = $${CAMPOS_SOLICITUD.length + 2}, actualizada = NOW() WHERE id = $1`,
    [id, ...CAMPOS_SOLICITUD.map((c) => d[c] ?? null), d.estado !== "nueva"]
  );
  return rowCount > 0;
}

async function cambiarEstado(id, estado) {
  await pool.query(
    "UPDATE solicitudes SET estado = $2, atendida = ($2 <> 'nueva'), actualizada = NOW() WHERE id = $1",
    [id, estado]
  );
}

async function eliminarSolicitud(id) {
  await pool.query("DELETE FROM solicitudes WHERE id = $1", [id]);
}

/* ---------- Clientes ---------- */

async function listarClientes({ q } = {}, limite = 500) {
  const params = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = "WHERE c.nombre ILIKE $1 OR c.negocio ILIKE $1 OR c.telefono ILIKE $1 OR c.correo ILIKE $1 OR c.ciudad ILIKE $1";
  }
  params.push(limite);
  const { rows } = await pool.query(
    `SELECT c.*,
            COUNT(s.id)::int AS solicitudes,
            COALESCE(SUM(s.valor) FILTER (WHERE s.estado = 'ganada'), 0)::bigint AS ganado,
            MAX(s.creada) AS ultima
     FROM clientes c LEFT JOIN solicitudes s ON s.cliente_id = c.id
     ${where}
     GROUP BY c.id
     ORDER BY lower(c.nombre)
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function opcionesClientes() {
  const { rows } = await pool.query("SELECT id, nombre, negocio FROM clientes ORDER BY lower(nombre) LIMIT 2000");
  return rows;
}

async function obtenerCliente(id) {
  const { rows } = await pool.query("SELECT * FROM clientes WHERE id = $1", [id]);
  return rows[0] || null;
}

const CAMPOS_CLIENTE = ["nombre", "negocio", "telefono", "correo", "ciudad", "notas"];

async function crearCliente(d) {
  const { rows } = await pool.query(
    `INSERT INTO clientes (${CAMPOS_CLIENTE.join(", ")})
     VALUES (${CAMPOS_CLIENTE.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
    CAMPOS_CLIENTE.map((c) => d[c] ?? null)
  );
  return rows[0].id;
}

async function actualizarCliente(id, d) {
  const sets = CAMPOS_CLIENTE.map((c, i) => `${c} = $${i + 2}`).join(", ");
  const { rowCount } = await pool.query(
    `UPDATE clientes SET ${sets}, actualizado = NOW() WHERE id = $1`,
    [id, ...CAMPOS_CLIENTE.map((c) => d[c] ?? null)]
  );
  return rowCount > 0;
}

async function eliminarCliente(id) {
  await pool.query("DELETE FROM clientes WHERE id = $1", [id]);
}

// Crea un cliente con los datos de la solicitud y la deja vinculada.
async function clienteDesdeSolicitud(solicitudId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT * FROM solicitudes WHERE id = $1 FOR UPDATE", [solicitudId]);
    const s = rows[0];
    if (!s) throw new Error("La solicitud no existe.");
    if (s.cliente_id) {
      await client.query("COMMIT");
      return s.cliente_id;
    }
    const nuevo = await client.query(
      `INSERT INTO clientes (nombre, negocio, telefono, correo) VALUES ($1, $2, $3, $4) RETURNING id`,
      [s.nombre, s.negocio, s.telefono, s.correo]
    );
    const clienteId = nuevo.rows[0].id;
    await client.query("UPDATE solicitudes SET cliente_id = $2, actualizada = NOW() WHERE id = $1", [solicitudId, clienteId]);
    await client.query("COMMIT");
    return clienteId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function ping() {
  await pool.query("SELECT 1");
}

module.exports = {
  ORIGENES, ESTADOS, TIPOS,
  migrar, ping, resumen,
  listarSolicitudes, obtenerSolicitud, crearSolicitud, actualizarSolicitud, cambiarEstado, eliminarSolicitud,
  listarClientes, opcionesClientes, obtenerCliente, crearCliente, actualizarCliente, eliminarCliente,
  clienteDesdeSolicitud,
};
