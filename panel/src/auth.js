const crypto = require("crypto");

const USER = process.env.ADMIN_USER || "";
const PASSWORD = process.env.ADMIN_PASSWORD || "";
// Firebase Hosting solo deja pasar una cookie, y debe llamarse "__session".
const COOKIE = "__session";
const DURACION_MS = 7 * 24 * 60 * 60 * 1000;

// Clave para firmar las sesiones. Si no se define SESSION_SECRET, se deriva de la contraseña
// y de la conexión a la base de datos: así se mantiene entre reinicios, y cambiar la
// contraseña cierra todas las sesiones abiertas.
const SECRET =
  (process.env.SESSION_SECRET || "").length >= 32
    ? process.env.SESSION_SECRET
    : crypto
        .createHash("sha256")
        .update(`panel-sesion\u0000${PASSWORD}\u0000${process.env.DATABASE_URL || ""}`)
        .digest("hex");

const configurado = () => Boolean(USER) && PASSWORD.length >= 12;

function iguales(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function credencialesValidas(usuario, clave) {
  // Se comparan las dos siempre, para no revelar cuál de las dos falló por el tiempo de respuesta.
  const u = iguales(usuario || "", USER);
  const p = iguales(clave || "", PASSWORD);
  return configurado() && u && p;
}

function firmar(datos) {
  return crypto.createHmac("sha256", SECRET).update(datos).digest("base64url");
}

function crearToken() {
  const payload = Buffer.from(JSON.stringify({ u: USER, exp: Date.now() + DURACION_MS })).toString("base64url");
  return `${payload}.${firmar(payload)}`;
}

function tokenValido(token) {
  if (!token || typeof token !== "string") return false;
  const [payload, firma] = token.split(".");
  if (!payload || !firma) return false;
  const esperada = firmar(payload);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return false;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return u === USER && typeof exp === "number" && exp > Date.now();
  } catch (_) {
    return false;
  }
}

function leerCookie(req, nombre) {
  const header = req.get("cookie") || "";
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i > -1 && parte.slice(0, i).trim() === nombre) return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return "";
}

function opcionesCookie(req) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: req.secure,
    path: "/",
  };
}

function iniciarSesion(req, res) {
  res.cookie(COOKIE, crearToken(), { ...opcionesCookie(req), maxAge: DURACION_MS });
}

function cerrarSesion(req, res) {
  res.clearCookie(COOKIE, opcionesCookie(req));
}

function requiereSesion(req, res, next) {
  if (tokenValido(leerCookie(req, COOKIE))) return next();
  const destino = req.method === "GET" ? `?volver=${encodeURIComponent(req.originalUrl)}` : "";
  res.redirect(303, `/entrar${destino}`);
}

// Los formularios del panel solo se aceptan si vienen del mismo panel.
function mismoOrigen(req, res, next) {
  if (req.method !== "POST") return next();
  const origen = req.get("origin") || req.get("referer") || "";
  try {
    // Detrás de Firebase Hosting el dominio original llega en X-Forwarded-Host.
    const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    if (new URL(origen).host === host) return next();
  } catch (_) {}
  res.status(403).type("text/plain; charset=utf-8").send("Acción no permitida.");
}

module.exports = { configurado, credencialesValidas, iniciarSesion, cerrarSesion, requiereSesion, mismoOrigen };
