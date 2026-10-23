/*
 * Copia los datos de la base de datos anterior (Railway) a la nueva (Neon).
 *
 * Uso, desde la raíz del proyecto:
 *   ORIGEN_URL="postgres://...railway..." DESTINO_URL="postgres://...neon..." npm run migrar-datos
 *
 * - Crea las tablas en la base nueva si no existen.
 * - Copia clientes, solicitudes y visitas conservando sus números (id).
 * - Se detiene si la base nueva ya tiene datos, para no duplicar nada.
 * - No modifica ni borra nada en la base de origen.
 * Las URL se pasan por variable de entorno para que no queden en el código ni en el historial.
 */
const { Client } = require("pg");

const ORIGEN = process.env.ORIGEN_URL;
const DESTINO = process.env.DESTINO_URL;

if (!ORIGEN || !DESTINO) {
  console.error("Faltan ORIGEN_URL y DESTINO_URL. Mira las instrucciones al inicio de este archivo.");
  process.exit(1);
}
if (ORIGEN === DESTINO) {
  console.error("ORIGEN_URL y DESTINO_URL son la misma base de datos.");
  process.exit(1);
}

// En orden: solicitudes depende de clientes.
const TABLAS = [
  { nombre: "clientes", secuencia: true },
  { nombre: "solicitudes", secuencia: true },
  { nombre: "visitas", secuencia: true },
];

// Las bases en la nube exigen SSL; una base local de pruebas no.
const local = (url) => /@(localhost|127\.0\.0\.1)[:/]|sslmode=disable/.test(url);
const conectar = (url) => new Client({ connectionString: url, ssl: local(url) ? false : { rejectUnauthorized: false } });

async function columnas(db, tabla) {
  const { rows } = await db.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
    [tabla]
  );
  return rows.map((r) => r.column_name);
}

async function main() {
  // Crea el esquema completo en la base nueva usando el mismo código del panel.
  process.env.DATABASE_URL = DESTINO;
  process.env.DATABASE_SSL = local(DESTINO) ? "false" : "true";
  const panelDb = require("../panel/src/db");
  await panelDb.migrar();
  console.log("Tablas listas en la base nueva.");

  const origen = conectar(ORIGEN);
  const destino = conectar(DESTINO);
  await origen.connect();
  await destino.connect();

  try {
    for (const { nombre } of TABLAS) {
      const { rows } = await destino.query(`SELECT COUNT(*)::int AS n FROM ${nombre}`);
      if (rows[0].n > 0) {
        throw new Error(`La tabla "${nombre}" de la base nueva ya tiene ${rows[0].n} registros. No se copió nada para no duplicar datos.`);
      }
    }

    await destino.query("BEGIN");
    for (const { nombre } of TABLAS) {
      const enOrigen = await columnas(origen, nombre);
      if (!enOrigen.length) {
        console.log(`- ${nombre}: no existe en la base anterior, se omite.`);
        continue;
      }
      const enDestino = new Set(await columnas(destino, nombre));
      const comunes = enOrigen.filter((c) => enDestino.has(c));
      const lista = comunes.map((c) => `"${c}"`).join(", ");

      const { rows } = await origen.query(`SELECT ${lista} FROM ${nombre} ORDER BY id`);
      // Inserta en lotes para no armar consultas gigantes.
      for (let i = 0; i < rows.length; i += 500) {
        const lote = rows.slice(i, i + 500);
        const valores = [];
        const filas = lote.map((fila, f) => {
          const marcas = comunes.map((c, k) => {
            valores.push(fila[c]);
            return `$${f * comunes.length + k + 1}`;
          });
          return `(${marcas.join(", ")})`;
        });
        await destino.query(`INSERT INTO ${nombre} (${lista}) VALUES ${filas.join(", ")}`, valores);
      }
      // Los números nuevos continúan después del último copiado.
      await destino.query(
        `SELECT setval(pg_get_serial_sequence('${nombre}', 'id'), COALESCE((SELECT MAX(id) FROM ${nombre}), 0) + 1, false)`
      );
      console.log(`- ${nombre}: ${rows.length} registros copiados.`);
    }
    await destino.query("COMMIT");
    console.log("Listo: datos copiados. La base anterior quedó intacta.");
  } catch (err) {
    await destino.query("ROLLBACK").catch(() => {});
    console.error("No se completó la copia:", err.message);
    process.exitCode = 1;
  } finally {
    await origen.end();
    await destino.end();
    process.exit();
  }
}

main();
