/*
 * Prepara la carpeta dist/ que se publica en Firebase Hosting.
 * Copia public/ e inserta los datos de contacto desde .env (o desde variables de entorno),
 * para que nunca queden escritos en el repositorio.
 * Se ejecuta solo antes de "firebase deploy" (ver firebase.json).
 */
const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..");
const ORIGEN = path.join(RAIZ, "public");
const DESTINO = path.join(RAIZ, "dist");

// Lee .env si existe (formato CLAVE=valor). Las variables de entorno tienen prioridad.
const archivoEnv = path.join(RAIZ, ".env");
const env = {};
if (fs.existsSync(archivoEnv)) {
  for (const linea of fs.readFileSync(archivoEnv, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const leer = (clave) => (process.env[clave] ?? env[clave] ?? "").trim();

const whatsapp = leer("WHATSAPP_NUMBER").replace(/\D/g, "");
const correo = leer("CONTACT_EMAIL");
const responsable = (leer("RESPONSABLE_DATOS") || "Tu Página a un Clic").replace(/[<>&"|]/g, "").slice(0, 200);

if (whatsapp && !/^[0-9]{8,15}$/.test(whatsapp)) {
  console.error("WHATSAPP_NUMBER debe tener solo dígitos, con indicativo de país y sin '+'.");
  process.exit(1);
}
if (correo && !/^[^\s@"'<>]+@[^\s@"'<>]+\.[A-Za-z]{2,}$/.test(correo)) {
  console.error("CONTACT_EMAIL no tiene un formato de correo válido.");
  process.exit(1);
}
if (!whatsapp) console.warn("Aviso: no hay WHATSAPP_NUMBER; el botón de WhatsApp no aparecerá.");

fs.rmSync(DESTINO, { recursive: true, force: true });
fs.cpSync(ORIGEN, DESTINO, { recursive: true });

const script = path.join(DESTINO, "script.js");
fs.writeFileSync(
  script,
  fs.readFileSync(script, "utf8").replace("__WHATSAPP_NUMBER__", whatsapp).replace("__CONTACT_EMAIL__", correo)
);

const politica = path.join(DESTINO, "politica-de-privacidad", "index.html");
fs.writeFileSync(politica, fs.readFileSync(politica, "utf8").replace(/__RESPONSABLE__/g, responsable));

console.log("Carpeta dist/ lista para publicar.");
