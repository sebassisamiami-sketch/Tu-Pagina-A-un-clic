const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("./db");

const router = express.Router();

const USER = process.env.ADMIN_USER || "";
const PASSWORD = process.env.ADMIN_PASSWORD || "";

function iguales(a, b) {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

router.use((req, res, next) => {
  res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });

  if (!USER || PASSWORD.length < 12) {
    return res
      .status(503)
      .type("text/plain; charset=utf-8")
      .send("El panel está desactivado. Define ADMIN_USER y ADMIN_PASSWORD (mínimo 12 caracteres).");
  }

  const header = req.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    const u = decoded.slice(0, sep);
    const p = decoded.slice(sep + 1);
    if (sep > -1 && iguales(u, USER) && iguales(p, PASSWORD)) return next();
  }

  res.set("WWW-Authenticate", 'Basic realm="Panel de solicitudes", charset="UTF-8"');
  res.status(401).type("text/plain; charset=utf-8").send("Necesitas usuario y contraseña para ver el panel.");
});

router.use((req, res, next) => {
  if (!db.available()) {
    return res.status(503).type("text/plain; charset=utf-8").send("No hay base de datos conectada (falta DATABASE_URL).");
  }
  next();
});

// Las acciones solo se aceptan desde el propio panel.
function mismoOrigen(req, res, next) {
  const origen = req.get("origin") || req.get("referer") || "";
  try {
    if (new URL(origen).host === req.get("host")) return next();
  } catch (_) {}
  res.status(403).type("text/plain; charset=utf-8").send("Acción no permitida.");
}

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fecha = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
  timeStyle: "short",
});

const tipoLegible = (tipo) =>
  tipo.startsWith("asesoría") ? "Necesita asesoría (aún no sabe qué necesita)" : `Necesita ${tipo}`;

const FILTROS = { todas: "Todas", pendientes: "Pendientes", atendidas: "Atendidas" };

router.get("/", async (req, res, next) => {
  try {
    const filtro = FILTROS[req.query.filtro] ? req.query.filtro : "pendientes";
    const [filas, conteo] = await Promise.all([db.listarSolicitudes({ filtro }), db.contarSolicitudes()]);
    res.type("html").send(pagina({ filas, conteo, filtro }));
  } catch (err) {
    next(err);
  }
});

router.post("/solicitudes/:id", mismoOrigen, express.urlencoded({ extended: false, limit: "2kb" }), async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).send("Solicitud no válida.");
    await db.marcarAtendida(id, req.body.atendida === "1");
    const filtro = FILTROS[req.body.filtro] ? req.body.filtro : "pendientes";
    res.redirect(303, `/admin?filtro=${filtro}#s${id}`);
  } catch (err) {
    next(err);
  }
});

router.get("/solicitudes.csv", async (req, res, next) => {
  try {
    const filas = await db.listarSolicitudes({ filtro: "todas", limite: 10000 });
    const csvCelda = (v) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lineas = [
      ["id", "fecha", "nombre", "negocio", "necesita", "mensaje", "atendida"].join(","),
      ...filas.map((f) =>
        [f.id, fecha.format(f.creada), f.nombre, f.negocio, f.tipo, f.mensaje, f.atendida ? "sí" : "no"].map(csvCelda).join(",")
      ),
    ];
    res
      .type("text/csv; charset=utf-8")
      .set("Content-Disposition", 'attachment; filename="solicitudes.csv"')
      .send("﻿" + lineas.join("\r\n"));
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, next) => {
  console.error("Error en el panel:", err.message);
  res.status(500).type("text/plain; charset=utf-8").send("Algo falló al consultar la base de datos.");
});

function pagina({ filas, conteo, filtro }) {
  const tabs = Object.entries(FILTROS)
    .map(([k, v]) => `<a href="?filtro=${k}"${k === filtro ? ' aria-current="page"' : ""}>${v}</a>`)
    .join("");

  const lista = filas.length
    ? filas
        .map(
          (f) => `
      <article class="s${f.atendida ? " is-done" : ""}" id="s${f.id}">
        <header>
          <h2>${esc(f.nombre)}${f.negocio ? ` <span>${esc(f.negocio)}</span>` : ""}</h2>
          <time datetime="${f.creada.toISOString()}">${esc(fecha.format(f.creada))}</time>
        </header>
        <p class="tipo">${esc(tipoLegible(f.tipo))}</p>
        ${f.mensaje ? `<p class="msg">${esc(f.mensaje)}</p>` : ""}
        <form method="post" action="/admin/solicitudes/${f.id}">
          <input type="hidden" name="filtro" value="${filtro}">
          <input type="hidden" name="atendida" value="${f.atendida ? "0" : "1"}">
          <button type="submit">${f.atendida ? "Marcar como pendiente" : "Marcar como atendida"}</button>
        </form>
      </article>`
        )
        .join("")
    : `<p class="vacio">${
        filtro === "pendientes"
          ? "No tienes solicitudes pendientes. Las nuevas aparecerán aquí."
          : "Todavía no hay solicitudes en esta vista."
      }</p>`;

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Solicitudes | Tu Página a un Clic</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=Unbounded:wght@700&display=swap" rel="stylesheet">
<style>
  :root { --azul:#2433D9; --hondo:#121A6B; --tinta:#161A3D; --papel:#F5F6FB; --mango:#FFB627; --lila:#CDD2FF; --gris:#555A7C; --linea:#DCDFEE; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--papel); color:var(--tinta); font:400 1rem/1.5 "Familjen Grotesk", Arial, sans-serif; }
  .top { background:var(--azul); color:#fff; }
  .wrap { max-width:880px; margin:0 auto; padding:0 16px; }
  .top .wrap { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; min-height:72px; }
  h1 { margin:0; font:700 1.15rem/1.1 Unbounded, Arial, sans-serif; letter-spacing:-.02em; }
  .top p { margin:0; color:#E3E6FF; }
  .top strong { color:var(--mango); }
  nav { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; margin:28px 0 20px; }
  .tabs { display:inline-flex; padding:4px; border-radius:999px; background:#E4E6F4; }
  .tabs a { padding:8px 14px; border-radius:999px; color:var(--tinta); text-decoration:none; font-weight:500; }
  .tabs a[aria-current] { background:var(--tinta); color:#fff; }
  .csv { color:var(--azul); font-weight:600; }
  .s { background:#fff; border:1px solid var(--linea); border-radius:14px; padding:18px 20px; margin-bottom:12px; }
  .s.is-done { opacity:.7; }
  .s header { display:flex; flex-wrap:wrap; justify-content:space-between; gap:4px 16px; align-items:baseline; }
  .s h2 { margin:0; font-size:1.15rem; font-weight:600; }
  .s h2 span { color:var(--gris); font-weight:400; }
  time { color:var(--gris); font-size:.92rem; }
  .tipo { margin:6px 0 0; color:var(--azul); font-weight:500; }
  .msg { margin:10px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; }
  form { margin-top:14px; }
  button { border:1.5px solid var(--tinta); background:transparent; color:var(--tinta); border-radius:999px; padding:8px 14px; font-family:inherit; font-size:.92rem; font-weight:500; line-height:1; cursor:pointer; }
  .s:not(.is-done) button { background:var(--mango); border-color:var(--mango); }
  button:hover { filter:brightness(.95); }
  :focus-visible { outline:3px solid var(--mango); outline-offset:3px; }
  .vacio { padding:48px 0; text-align:center; color:var(--gris); }
  main { padding-bottom:48px; }
</style>
</head>
<body>
  <header class="top"><div class="wrap">
    <h1>Solicitudes</h1>
    <p><strong>${conteo.pendientes}</strong> ${conteo.pendientes === 1 ? "pendiente" : "pendientes"} de ${conteo.total} en total</p>
  </div></header>
  <main class="wrap">
    <nav aria-label="Filtrar"><div class="tabs">${tabs}</div><a class="csv" href="/admin/solicitudes.csv">Descargar CSV</a></nav>
    ${lista}
  </main>
</body>
</html>`;
}

module.exports = { router };
