/*
 * Exporta los datos de la base Postgres anterior (Railway) a un archivo respaldo.json,
 * que luego se importa desde el panel (sección "Respaldo").
 *
 * Uso en PowerShell, desde la carpeta del proyecto:
 *   $env:ORIGEN_URL="postgres://...la URL pública de Railway..."
 *   npm run exportar-datos
 *
 * - Solo lee: no modifica nada en la base de origen.
 * - Exporta todos los clientes y solicitudes, y las visitas de los últimos 30 días
 *   (para no gastar la cuota diaria gratis de Firestore). Con TODAS_LAS_VISITAS=1 exporta todas.
 * - El archivo tiene datos de clientes: no lo compartas ni lo subas a GitHub (.gitignore ya lo excluye).
 */
const fs = require("fs");
const path = require("path");
const { Client, types } = require("pg");

// Fechas sin hora como texto AAAA-MM-DD, igual que en el panel.
types.setTypeParser(1082, (v) => v);

const URL_ORIGEN = process.env.ORIGEN_URL;
if (!URL_ORIGEN) {
  console.error('Falta ORIGEN_URL. Ejemplo: $env:ORIGEN_URL="postgres://..." y luego npm run exportar-datos');
  process.exit(1);
}

const local = /@(localhost|127\.0\.0\.1)[:/]|sslmode=disable/.test(URL_ORIGEN);
const db = new Client({ connectionString: URL_ORIGEN, ssl: local ? false : { rejectUnauthorized: false } });

async function existe(tabla) {
  const { rows } = await db.query("SELECT to_regclass($1) AS t", [`public.${tabla}`]);
  return Boolean(rows[0].t);
}

async function main() {
  await db.connect();
  const datos = { formato: "tu-pagina-a-un-clic/respaldo", version: 1, exportado: new Date().toISOString() };

  datos.clientes = (await existe("clientes")) ? (await db.query("SELECT * FROM clientes ORDER BY id")).rows : [];
  datos.solicitudes = (await existe("solicitudes")) ? (await db.query("SELECT * FROM solicitudes ORDER BY id")).rows : [];
  datos.visitas = (await existe("visitas"))
    ? (
        await db.query(
          process.env.TODAS_LAS_VISITAS === "1"
            ? "SELECT id, creada, visitante, ruta, dispositivo, origen FROM visitas ORDER BY id"
            : "SELECT id, creada, visitante, ruta, dispositivo, origen FROM visitas WHERE creada >= NOW() - INTERVAL '30 days' ORDER BY id"
        )
      ).rows
    : [];

  const archivo = path.join(process.cwd(), "respaldo.json");
  fs.writeFileSync(archivo, JSON.stringify(datos, null, 1));
  console.log(`Listo: ${datos.clientes.length} clientes, ${datos.solicitudes.length} solicitudes y ${datos.visitas.length} visitas.`);
  console.log(`Archivo: ${archivo}`);
  console.log('Ahora ábrelo en el panel, en la sección "Respaldo" → "Importar".');
}

main()
  .catch((err) => {
    console.error("No se pudo exportar:", err.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());
