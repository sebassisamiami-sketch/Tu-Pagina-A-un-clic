const path = require("path");
const express = require("express");
const rateLimit = require("express-rate-limit");

const db = require("./db");
const auth = require("./auth");
const views = require("./views");
const excel = require("./excel");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);

// La base de datos se prepara una sola vez por instancia, antes de la primera petición.
let preparada = null;
app.use((req, res, next) => {
  if (!preparada) {
    preparada = db
      .migrar()
      .then(() => console.log("Base de datos lista."))
      .catch((err) => {
        console.error("No se pudo preparar la base de datos:", err.message);
        preparada = null; // se reintenta en la siguiente petición
      });
  }
  Promise.resolve(preparada).then(() => next());
});

app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "X-Robots-Tag": "noindex, nofollow",
  });
  next();
});

app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "1h", index: false }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));
app.use(auth.mismoOrigen);

app.get("/salud", async (req, res) => {
  try {
    await db.ping();
    res.json({ ok: true });
  } catch (_) {
    res.status(503).json({ ok: false });
  }
});

app.get("/robots.txt", (req, res) => res.type("text/plain").send("User-agent: *\nDisallow: /\n"));

/* ---------- Sesión ---------- */

const destinoSeguro = (v) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") ? v : "/");

app.get("/entrar", (req, res) => {
  res.set("Cache-Control", "no-store").send(views.entrar({ volver: destinoSeguro(req.query.volver), desactivado: !auth.configurado() }));
});

const limiteEntrar = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => (req.get("x-forwarded-for") || req.ip || "").split(",")[0].trim(),
  validate: false,
  handler: (req, res) =>
    res.status(429).send(views.entrar({ error: "Demasiados intentos. Espera unos minutos e intenta de nuevo.", volver: "/" })),
});

app.post("/entrar", limiteEntrar, (req, res) => {
  const volver = destinoSeguro(req.body.volver);
  if (!auth.credencialesValidas(req.body.usuario, req.body.clave)) {
    return res.status(401).send(views.entrar({ error: "Usuario o contraseña incorrectos.", volver }));
  }
  auth.iniciarSesion(req, res);
  res.redirect(303, volver);
});

app.post("/salir", (req, res) => {
  auth.cerrarSesion(req, res);
  res.redirect(303, "/entrar");
});

/* ---------- Todo lo demás requiere sesión ---------- */

app.use(auth.requiereSesion);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

const id = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const texto = (v, max) => {
  const s = typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "";
  return s || null;
};

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function leerSolicitud(body) {
  const errores = {};
  const d = {
    nombre: texto(body.nombre, 120),
    negocio: texto(body.negocio, 120),
    telefono: texto(body.telefono, 30),
    correo: texto(body.correo, 160),
    tipo: db.TIPOS.includes(body.tipo) ? body.tipo : db.TIPOS[0],
    mensaje: texto(body.mensaje, 4000),
    origen: db.ORIGENES[body.origen] ? body.origen : "otro",
    estado: db.ESTADOS[body.estado] ? body.estado : "nueva",
    valor: null,
    seguimiento: /^\d{4}-\d{2}-\d{2}$/.test(body.seguimiento || "") ? body.seguimiento : null,
    notas: texto(body.notas, 4000),
    cliente_id: id(body.cliente_id),
  };
  if (!d.nombre) errores.nombre = "Escribe el nombre de la persona.";
  if (d.correo && !CORREO.test(d.correo)) errores.correo = "Revisa el correo, no parece válido.";
  const valorTexto = String(body.valor || "").trim();
  if (valorTexto) {
    const valor = valorTexto.replace(/[\s.,$]/g, "");
    if (!/^\d+$/.test(valor)) errores.valor = "Escribe el valor en números, por ejemplo 1500000.";
    else if (valor.length > 13) errores.valor = "El valor es demasiado grande.";
    else d.valor = Number(valor);
  }
  return { d, errores: Object.keys(errores).length ? errores : null };
}

function leerCliente(body) {
  const errores = {};
  const d = {
    nombre: texto(body.nombre, 120),
    negocio: texto(body.negocio, 120),
    telefono: texto(body.telefono, 30),
    correo: texto(body.correo, 160),
    ciudad: texto(body.ciudad, 80),
    notas: texto(body.notas, 4000),
  };
  if (!d.nombre) errores.nombre = "Escribe el nombre del cliente.";
  if (d.correo && !CORREO.test(d.correo)) errores.correo = "Revisa el correo, no parece válido.";
  return { d, errores: Object.keys(errores).length ? errores : null };
}

const ok = (req) => (typeof req.query.ok === "string" ? req.query.ok : "");
const envolver = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/* ---------- Inicio ---------- */

app.get("/", envolver(async (req, res) => {
  const [resumen, visitas] = await Promise.all([db.resumen(), db.visitas()]);
  res.send(views.inicio({ ...resumen, visitas }, ok(req)));
}));

// Datos de visitas para la actualización en vivo del inicio.
app.get("/visitas.json", envolver(async (req, res) => {
  const v = await db.visitas();
  res.json({ html: views.visitasContenido(v), en_linea: v.en_linea, hoy: v.hoy });
}));

/* ---------- Solicitudes ---------- */

function filtrosDe(query) {
  return {
    q: texto(query.q, 100) || "",
    estado: typeof query.estado === "string" ? query.estado : "",
    origen: typeof query.origen === "string" ? query.origen : "",
  };
}

app.get("/solicitudes", envolver(async (req, res) => {
  const filtros = filtrosDe(req.query);
  res.send(views.solicitudes({ filas: await db.listarSolicitudes(filtros), filtros }, ok(req)));
}));

app.get("/solicitudes/nueva", envolver(async (req, res) => {
  const clientes = await db.opcionesClientes();
  const s = { origen: "whatsapp", estado: "nueva", tipo: db.TIPOS[0], cliente_id: id(req.query.cliente) };
  if (s.cliente_id) {
    const c = await db.obtenerCliente(s.cliente_id);
    if (c) Object.assign(s, { nombre: c.nombre, negocio: c.negocio, telefono: c.telefono, correo: c.correo });
  }
  res.send(views.solicitudForm({ s, clientes }));
}));

app.post("/solicitudes", envolver(async (req, res) => {
  const { d, errores } = leerSolicitud(req.body);
  if (errores) return res.status(400).send(views.solicitudForm({ s: d, clientes: await db.opcionesClientes(), errores }));
  const nuevo = await db.crearSolicitud(d);
  res.redirect(303, `/solicitudes/${nuevo}?ok=creada`);
}));

app.get("/solicitudes/:id", envolver(async (req, res, next) => {
  const s = id(req.params.id) && (await db.obtenerSolicitud(id(req.params.id)));
  if (!s) return next();
  res.send(views.solicitudForm({ s, clientes: await db.opcionesClientes(), ok: ok(req) }));
}));

app.post("/solicitudes/:id", envolver(async (req, res, next) => {
  const sid = id(req.params.id);
  const actual = sid && (await db.obtenerSolicitud(sid));
  if (!actual) return next();
  const { d, errores } = leerSolicitud(req.body);
  if (errores) {
    return res.status(400).send(
      views.solicitudForm({ s: { ...actual, ...d }, clientes: await db.opcionesClientes(), errores })
    );
  }
  await db.actualizarSolicitud(sid, d);
  res.redirect(303, `/solicitudes/${sid}?ok=guardada`);
}));

app.post("/solicitudes/:id/cliente", envolver(async (req, res, next) => {
  const sid = id(req.params.id);
  if (!sid || !(await db.obtenerSolicitud(sid))) return next();
  await db.clienteDesdeSolicitud(sid);
  res.redirect(303, `/solicitudes/${sid}?ok=vinculado`);
}));

app.post("/solicitudes/:id/eliminar", envolver(async (req, res) => {
  const sid = id(req.params.id);
  if (sid) await db.eliminarSolicitud(sid);
  res.redirect(303, "/solicitudes?ok=eliminada");
}));

/* ---------- Clientes ---------- */

app.get("/clientes", envolver(async (req, res) => {
  const q = texto(req.query.q, 100) || "";
  res.send(views.clientes({ filas: await db.listarClientes({ q }), q }, ok(req)));
}));

app.get("/clientes/nuevo", (req, res) => {
  res.send(views.clienteForm({ c: {} }));
});

app.post("/clientes", envolver(async (req, res) => {
  const { d, errores } = leerCliente(req.body);
  if (errores) return res.status(400).send(views.clienteForm({ c: d, errores }));
  const nuevo = await db.crearCliente(d);
  res.redirect(303, `/clientes/${nuevo}?ok=cliente-creado`);
}));

app.get("/clientes/:id", envolver(async (req, res, next) => {
  const cid = id(req.params.id);
  const c = cid && (await db.obtenerCliente(cid));
  if (!c) return next();
  const solicitudes = await db.listarSolicitudes({ cliente: cid }, 100);
  res.send(views.clienteForm({ c, solicitudes, ok: ok(req) }));
}));

app.post("/clientes/:id", envolver(async (req, res, next) => {
  const cid = id(req.params.id);
  const actual = cid && (await db.obtenerCliente(cid));
  if (!actual) return next();
  const { d, errores } = leerCliente(req.body);
  if (errores) {
    const solicitudes = await db.listarSolicitudes({ cliente: cid }, 100);
    return res.status(400).send(views.clienteForm({ c: { ...actual, ...d }, solicitudes, errores }));
  }
  await db.actualizarCliente(cid, d);
  res.redirect(303, `/clientes/${cid}?ok=cliente-guardado`);
}));

app.post("/clientes/:id/eliminar", envolver(async (req, res) => {
  const cid = id(req.params.id);
  if (cid) await db.eliminarCliente(cid);
  res.redirect(303, "/clientes?ok=cliente-eliminado");
}));

/* ---------- Excel ---------- */

app.get("/exportar", (req, res) => res.send(views.exportar()));

const hoyArchivo = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);

function enviarXlsx(res, nombre, buffer) {
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set("Content-Disposition", `attachment; filename="${nombre}-${hoyArchivo()}.xlsx"`)
    .send(Buffer.from(buffer));
}

app.get("/exportar/solicitudes.xlsx", envolver(async (req, res) => {
  const filas = await db.listarSolicitudes(filtrosDe(req.query), 50000);
  enviarXlsx(res, "solicitudes", await excel.solicitudesXlsx(filas));
}));

app.get("/exportar/clientes.xlsx", envolver(async (req, res) => {
  const filas = await db.listarClientes({}, 50000);
  enviarXlsx(res, "clientes", await excel.clientesXlsx(filas));
}));

/* ---------- Errores ---------- */

app.use((req, res) => {
  res.status(404).send(
    views.documento(
      "No encontrado",
      `<main class="login"><div class="login__card"><h1>No encontramos esa página</h1><p class="muted">Puede que el registro se haya eliminado.</p><a class="btn btn--primary" href="/">Volver al inicio</a></div></main>`
    )
  );
});

app.use((err, req, res, next) => {
  console.error("Error en el panel:", err.message);
  res.status(500).send(
    views.documento(
      "Error",
      `<main class="login"><div class="login__card"><h1>Algo falló</h1><p class="muted">No pudimos completar la acción. Si se repite, revisa la conexión con la base de datos.</p><a class="btn btn--primary" href="/">Volver al inicio</a></div></main>`
    )
  );
});

/* ---------- Arranque ---------- */

module.exports = app;
