const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const express = require("express");
const rateLimit = require("express-rate-limit");

const db = require("./db");

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

/* Responsable de los datos en la política de privacidad: se define con RESPONSABLE_DATOS */
const responsable = (process.env.RESPONSABLE_DATOS || "Tu Página a un Clic")
  .replace(/[<>&"]/g, "")
  .trim()
  .slice(0, 200);
const politicaPrivacidad = fs
  .readFileSync(path.join(PUBLIC_DIR, "politica-de-privacidad", "index.html"), "utf8")
  .replace(/__RESPONSABLE__/g, responsable);
app.get("/politica-de-privacidad/", (req, res) => {
  // Sin la barra final, los enlaces relativos de la página no funcionarían.
  if (!req.path.endsWith("/")) return res.redirect(301, "/politica-de-privacidad/");
  res.type("html").set("Cache-Control", "no-cache").send(politicaPrivacidad);
});

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
  if (body.autoriza !== true) {
    return res.status(400).json({ ok: false, error: "Para enviar tu solicitud, autoriza el tratamiento de tus datos." });
  }

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

/* Visitas: contador para el panel. Sin IP ni datos personales guardados. */
const BOTS = /bot|crawl|spider|slurp|preview|lighthouse|headless|monitor|uptime|facebookexternalhit|whatsapp\//i;
const RUTA = /^\/[A-Za-z0-9\-_/]{0,120}$/;

function huellaVisitante(req) {
  // Cambia cada día: permite contar visitantes únicos del día sin poder seguir a nadie.
  const dia = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  return crypto
    .createHash("sha256")
    .update(`visita\u0000${process.env.DATABASE_URL || ""}\u0000${dia}\u0000${req.ip}\u0000${req.get("user-agent") || ""}`)
    .digest("base64url")
    .slice(0, 22);
}

function dispositivoDe(ua) {
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|iPod|Android/i.test(ua)) return "celular";
  return "computador";
}

function origenDe(ref, ua, host) {
  if (/Instagram/i.test(ua)) return "instagram.com";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook.com";
  if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "tiktok.com";
  try {
    const h = new URL(ref).hostname.replace(/^(www|m|l|lm)\./, "");
    if (!h || h === host.replace(/^www\./, "")) return null;
    return h.slice(0, 80);
  } catch (_) {
    return null;
  }
}

function leerVisita(req) {
  const ua = req.get("user-agent") || "";
  if (!ua || BOTS.test(ua)) return null;
  const body = req.body || {};
  const ruta = typeof body.ruta === "string" && RUTA.test(body.ruta) ? body.ruta : "/";
  return { ua, ruta, visitante: huellaVisitante(req) };
}

const limiteVisitas = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: false, legacyHeaders: false, message: { ok: false } });

app.post("/api/visita", limiteVisitas, express.json({ limit: "2kb" }), (req, res) => {
  res.status(204).end();
  const v = leerVisita(req);
  if (!v || !db.available()) return;
  const ref = typeof req.body?.ref === "string" ? req.body.ref.slice(0, 300) : "";
  db.registrarVisita({ ...v, dispositivo: dispositivoDe(v.ua), origen: origenDe(ref, v.ua, req.hostname || "") })
    .catch((err) => console.error("No se pudo registrar la visita:", err.message));
});

app.post("/api/presencia", limiteVisitas, express.json({ limit: "2kb" }), (req, res) => {
  res.status(204).end();
  const v = leerVisita(req);
  if (!v || !db.available()) return;
  db.marcarPresencia(v).catch(() => {});
});

if (db.available()) setInterval(() => db.limpiarPresencia().catch(() => {}), 6 * 3600 * 1000).unref();

app.use("/api", (req, res) => res.status(404).json({ ok: false, error: "Ruta no encontrada." }));

app.use("/api", (err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(400).json({ ok: false, error: "La solicitud no tiene un formato válido." });
  }
  console.error("Error en la API:", err.message);
  res.status(500).json({ ok: false, error: "Ocurrió un error inesperado." });
});

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
