const path = require("path");
const fs = require("fs");
const express = require("express");
const rateLimit = require("express-rate-limit");

const db = require("./db");
const admin = require("./admin");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const TIPOS = [
  "una página web",
  "una aplicación móvil",
  "una página web y una app",
  "un sistema a la medida",
  "asesoría, todavía no lo tengo claro",
];

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
});

/* Datos de contacto: se insertan desde variables de entorno, nunca desde el repositorio */
const scriptTemplate = fs.readFileSync(path.join(PUBLIC_DIR, "script.js"), "utf8");
const whatsapp = (process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
const email = (process.env.CONTACT_EMAIL || "").trim();
const scriptConDatos = scriptTemplate
  .replace("__WHATSAPP_NUMBER__", /^[0-9]{8,15}$/.test(whatsapp) ? whatsapp : "")
  .replace("__CONTACT_EMAIL__", /^[^\s@"'<>]+@[^\s@"'<>]+\.[A-Za-z]{2,}$/.test(email) ? email : "");

app.get("/script.js", (req, res) => {
  res.type("application/javascript").set("Cache-Control", "no-cache").send(scriptConDatos);
});

/* API */
app.get("/api/salud", (req, res) => {
  res.json({ ok: true, baseDeDatos: db.available() });
});

const limiteSolicitudes = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, error: "Enviaste varias solicitudes seguidas. Intenta de nuevo en unos minutos." },
});

function texto(valor, max) {
  if (typeof valor !== "string") return "";
  return valor.replace(/\u0000/g, "").trim().slice(0, max);
}

app.post("/api/solicitudes", limiteSolicitudes, express.json({ limit: "10kb" }), async (req, res) => {
  const body = req.body || {};

  // Campo trampa para bots: las personas no lo ven ni lo llenan.
  if (body.sitio) return res.status(201).json({ ok: true });

  const nombre = texto(body.nombre, 100);
  const negocio = texto(body.negocio, 120);
  const tipo = texto(body.tipo, 60);
  const mensaje = texto(body.mensaje, 2000);

  if (!nombre) return res.status(400).json({ ok: false, error: "Escribe tu nombre para poder responderte." });
  if (!TIPOS.includes(tipo)) return res.status(400).json({ ok: false, error: "Elige qué necesitas." });

  if (!db.available()) {
    return res.status(503).json({ ok: false, error: "No pudimos guardar tu solicitud en este momento." });
  }

  try {
    const { id } = await db.crearSolicitud({ nombre, negocio, tipo, mensaje });
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error("No se pudo guardar la solicitud:", err.message);
    res.status(500).json({ ok: false, error: "No pudimos guardar tu solicitud en este momento." });
  }
});

app.use("/api", (req, res) => res.status(404).json({ ok: false, error: "Ruta no encontrada." }));

app.use("/api", (err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(400).json({ ok: false, error: "La solicitud no tiene un formato válido." });
  }
  console.error("Error en la API:", err.message);
  res.status(500).json({ ok: false, error: "Ocurrió un error inesperado." });
});

/* Panel privado */
app.use("/admin", admin.router);

/* Sitio */
app.use(
  express.static(PUBLIC_DIR, {
    index: "index.html",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.set("Cache-Control", "no-cache");
      else res.set("Cache-Control", "public, max-age=3600");
    },
  })
);

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC_DIR, "index.html")));

db.init()
  .catch((err) => console.error("No se pudo preparar la base de datos:", err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`Servidor escuchando en el puerto ${PORT}`));
  });
