const { ORIGENES, ESTADOS, TIPOS } = require("./db");

/* ---------- Utilidades ---------- */

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fmtFechaHora = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
const fmtFecha = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const fmtDinero = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const fmtCorta = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const fechaHora = (d) => (d ? fmtFechaHora.format(new Date(d)) : "");
const fechaCorta = (d) => (d ? fmtCorta.format(new Date(d)) : "");
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : "");
const fecha = (d) => (d ? fmtFecha.format(new Date(d)) : "");
const dinero = (n) => (n === null || n === undefined || n === "" ? "" : fmtDinero.format(Number(n)));
const isoFecha = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

function telefonoWhatsApp(tel) {
  const digitos = String(tel || "").replace(/\D/g, "");
  if (!digitos) return "";
  if (digitos.length === 10 && digitos.startsWith("3")) return "57" + digitos;
  return digitos;
}

const estado = (e) => `<span class="badge badge--${esc(e)}">${esc(ESTADOS[e] || e)}</span>`;
const origen = (o) => esc(ORIGENES[o] || o);

function opciones(mapa, seleccionado, { vacia } = {}) {
  const items = vacia ? [`<option value="">${esc(vacia)}</option>`] : [];
  for (const [valor, etiqueta] of Object.entries(mapa)) {
    items.push(`<option value="${esc(valor)}"${valor === seleccionado ? " selected" : ""}>${esc(etiqueta)}</option>`);
  }
  return items.join("");
}

const MENSAJES = {
  guardada: "Solicitud guardada.",
  creada: "Solicitud registrada.",
  eliminada: "Solicitud eliminada.",
  "cliente-guardado": "Cliente guardado.",
  "cliente-creado": "Cliente creado.",
  "cliente-eliminado": "Cliente eliminado. Sus solicitudes se conservan sin cliente asignado.",
  vinculado: "Cliente creado y vinculado a la solicitud.",
  estado: "Estado actualizado.",
};

/* ---------- Estructura ---------- */

const ICONOS = {
  inicio: '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  solicitudes: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>',
  clientes: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.7.8 3 2.6 3.5 5.2"/>',
  exportar: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>',
};

function layout({ titulo, activo, contenido, ok }) {
  const nav = [
    ["inicio", "/", "Inicio"],
    ["solicitudes", "/solicitudes", "Solicitudes"],
    ["clientes", "/clientes", "Clientes"],
    ["exportar", "/exportar", "Exportar a Excel"],
  ]
    .map(
      ([id, href, label]) =>
        `<a href="${href}"${activo === id ? ' aria-current="page"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[id]}</svg><span>${label}</span></a>`
    )
    .join("");

  const aviso = ok && MENSAJES[ok] ? `<p class="flash" role="status">${esc(MENSAJES[ok])}</p>` : "";

  return documento(
    titulo,
    `
  <div class="app">
    <aside class="side">
      <a class="brand" href="/">
        <svg viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="#fff"/><path d="M11 8 L11 23 L15 19.5 L18 26 L20.8 24.7 L17.9 18.3 L23 18 Z" fill="#FFB627" stroke="#161A3D" stroke-width="1.4" stroke-linejoin="round"/></svg>
        <span>Panel de<br>clientes</span>
      </a>
      <nav class="nav" aria-label="Secciones">${nav}</nav>
      <form method="post" action="/salir" class="logout"><button type="submit"><span class="logout__long">Cerrar sesión</span><span class="logout__short">Salir</span></button></form>
    </aside>
    <main class="main">
      ${aviso}
      ${contenido}
    </main>
  </div>`
  );
}

function documento(titulo, cuerpo) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(titulo)} | Panel de clientes</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=Unbounded:wght@600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/panel.css">
</head>
<body>
${cuerpo}
<script src="/panel.js" defer></script>
</body>
</html>`;
}

/* ---------- Entrar ---------- */

function entrar({ error, volver, desactivado }) {
  return documento(
    "Entrar",
    `
  <main class="login">
    <form class="login__card" method="post" action="/entrar">
      <svg class="login__mark" viewBox="0 0 32 32" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="9" fill="#2433D9"/><path d="M11 8 L11 23 L15 19.5 L18 26 L20.8 24.7 L17.9 18.3 L23 18 Z" fill="#FFB627" stroke="#161A3D" stroke-width="1.4" stroke-linejoin="round"/></svg>
      <h1>Panel de clientes</h1>
      ${
        desactivado
          ? `<p class="error">El panel está desactivado. Define ADMIN_USER y ADMIN_PASSWORD (mínimo 12 caracteres) en las variables del servicio.</p>`
          : `
      ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ""}
      <input type="hidden" name="volver" value="${esc(volver || "/")}">
      <label for="usuario">Usuario</label>
      <input id="usuario" name="usuario" autocomplete="username" required autofocus>
      <label for="clave">Contraseña</label>
      <input id="clave" name="clave" type="password" autocomplete="current-password" required>
      <button class="btn btn--primary" type="submit">Entrar</button>`
      }
    </form>
  </main>`
  );
}

/* ---------- Inicio ---------- */

function inicio({ estados, seguimientos, recientes, totales }, ok) {
  const embudo = Object.entries(ESTADOS)
    .map(
      ([k, label]) => `
      <a class="stage stage--${k}" href="/solicitudes?estado=${k}">
        <span class="stage__n">${estados[k]}</span>
        <span class="stage__label">${label}</span>
      </a>`
    )
    .join("");

  const listaSeg = seguimientos.length
    ? `<ul class="follow">${seguimientos
        .map(
          (s) => `
        <li${s.vencido ? ' class="is-late"' : ""}>
          <a href="/solicitudes/${s.id}">
            <strong>${esc(s.nombre)}</strong>${s.negocio ? ` <span>${esc(s.negocio)}</span>` : ""}
          </a>
          <span class="follow__date">${s.vencido ? "Vencido: " : ""}${fecha(s.seguimiento)}</span>
        </li>`
        )
        .join("")}</ul>`
    : `<p class="empty">No tienes seguimientos para esta semana. Agrega una fecha de seguimiento en una solicitud para verla aquí.</p>`;

  const listaRec = recientes.length
    ? `<ul class="recent">${recientes
        .map(
          (s) => `
        <li>
          <a href="/solicitudes/${s.id}"><strong>${esc(s.nombre)}</strong>${s.negocio ? ` <span>${esc(s.negocio)}</span>` : ""}</a>
          <span class="recent__meta">${origen(s.origen)}, ${fechaHora(s.creada)}</span>
          ${estado(s.estado)}
        </li>`
        )
        .join("")}</ul>`
    : `<p class="empty">Aún no hay solicitudes. Las que lleguen por la página aparecerán aquí, y puedes registrar las de WhatsApp o correo con el botón de arriba.</p>`;

  return layout({
    titulo: "Inicio",
    activo: "inicio",
    ok,
    contenido: `
    <header class="head">
      <h1>Inicio</h1>
      <a class="btn btn--primary" href="/solicitudes/nueva">Registrar solicitud</a>
    </header>

    <section class="funnel" aria-label="Solicitudes por estado">${embudo}</section>

    <section class="kpis" aria-label="Totales">
      <div><span>Solicitudes este mes</span><strong>${totales.mes}</strong></div>
      <div><span>Clientes</span><strong>${totales.clientes}</strong></div>
      <div><span>En cotización</span><strong>${dinero(totales.cotizado)}</strong></div>
      <div><span>Ganado</span><strong>${dinero(totales.ganado)}</strong></div>
    </section>

    <div class="cols">
      <section class="box">
        <h2>Seguimientos próximos</h2>
        ${listaSeg}
      </section>
      <section class="box">
        <h2>Últimas solicitudes</h2>
        ${listaRec}
        <a class="more" href="/solicitudes">Ver todas las solicitudes</a>
      </section>
    </div>`,
  });
}

/* ---------- Solicitudes ---------- */

function solicitudes({ filas, filtros }, ok) {
  const filtroEstados = { abiertas: "Abiertas", ...ESTADOS };
  const cuerpo = filas.length
    ? `
    <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Contacto</th><th>Necesita</th><th>Origen</th><th>Estado</th><th>Valor</th><th>Seguimiento</th><th>Recibida</th></tr></thead>
      <tbody>
      ${filas
        .map(
          (s) => `
        <tr>
          <td data-label="Contacto"><a class="row-link" href="/solicitudes/${s.id}"><strong>${esc(s.nombre)}</strong></a>${
            s.negocio ? `<span class="sub">${esc(s.negocio)}</span>` : ""
          }${s.cliente_nombre && s.cliente_nombre !== s.nombre ? `<span class="sub">Cliente: ${esc(s.cliente_nombre)}</span>` : ""}</td>
          <td data-label="Necesita">${esc(cap(s.tipo))}</td>
          <td data-label="Origen" class="nowrap">${origen(s.origen)}</td>
          <td data-label="Estado">${estado(s.estado)}</td>
          <td data-label="Valor" class="num">${dinero(s.valor)}</td>
          <td data-label="Seguimiento" class="nowrap${s.vencido ? " late" : ""}">${s.seguimiento ? (s.vencido ? "Vencido: " : "") + fecha(s.seguimiento) : ""}</td>
          <td data-label="Recibida" class="nowrap">${fechaCorta(s.creada)}</td>
        </tr>`
        )
        .join("")}
      </tbody>
    </table>
    </div>`
    : `<p class="empty">${
        filtros.q || filtros.estado || filtros.origen
          ? "Ninguna solicitud coincide con estos filtros."
          : "Aún no hay solicitudes. Registra la primera con el botón de arriba."
      }</p>`;

  return layout({
    titulo: "Solicitudes",
    activo: "solicitudes",
    ok,
    contenido: `
    <header class="head">
      <h1>Solicitudes</h1>
      <a class="btn btn--primary" href="/solicitudes/nueva">Registrar solicitud</a>
    </header>
    <form class="filters" method="get" action="/solicitudes" role="search">
      <input type="search" name="q" value="${esc(filtros.q)}" placeholder="Buscar por nombre, negocio, teléfono o notas" aria-label="Buscar">
      <select name="estado" aria-label="Estado">${opciones(filtroEstados, filtros.estado, { vacia: "Todos los estados" })}</select>
      <select name="origen" aria-label="Origen">${opciones(ORIGENES, filtros.origen, { vacia: "Todos los orígenes" })}</select>
      <button class="btn" type="submit">Filtrar</button>
      ${filtros.q || filtros.estado || filtros.origen ? '<a class="clear" href="/solicitudes">Quitar filtros</a>' : ""}
    </form>
    <p class="count">${filas.length} ${filas.length === 1 ? "solicitud" : "solicitudes"}</p>
    ${cuerpo}`,
  });
}

function campoErr(errores, campo) {
  return errores && errores[campo] ? `<span class="field__err">${esc(errores[campo])}</span>` : "";
}

function solicitudForm({ s, clientes, errores, ok }) {
  const nueva = !s.id;
  const tipoOpts = TIPOS.map((t) => `<option value="${esc(t)}"${t === s.tipo ? " selected" : ""}>${esc(t[0].toUpperCase() + t.slice(1))}</option>`).join("");
  const clienteOpts =
    `<option value="">Sin cliente asignado</option>` +
    clientes
      .map((c) => `<option value="${c.id}"${Number(s.cliente_id) === c.id ? " selected" : ""}>${esc(c.nombre)}${c.negocio ? ` (${esc(c.negocio)})` : ""}</option>`)
      .join("");

  const wa = telefonoWhatsApp(s.telefono);
  const acciones = nueva
    ? ""
    : `
    <aside class="aside">
      <section class="box">
        <h2>Contactar</h2>
        <div class="actions">
          ${wa ? `<a class="btn" href="https://wa.me/${wa}" target="_blank" rel="noopener">Abrir WhatsApp</a>` : ""}
          ${s.correo ? `<a class="btn" href="mailto:${esc(s.correo)}">Escribir correo</a>` : ""}
          ${!wa && !s.correo ? '<p class="muted">Agrega un teléfono o correo para contactar desde aquí.</p>' : ""}
        </div>
      </section>
      <section class="box">
        <h2>Cliente</h2>
        ${
          s.cliente_id
            ? `<p>Vinculada a <a href="/clientes/${s.cliente_id}">${esc(s.cliente_nombre)}</a>.</p>`
            : `<p class="muted">Esta solicitud no tiene cliente asignado.</p>
               <form method="post" action="/solicitudes/${s.id}/cliente"><button class="btn" type="submit">Crear cliente con estos datos</button></form>`
        }
      </section>
      <section class="box">
        <h2>Datos</h2>
        <dl class="meta">
          <dt>Recibida</dt><dd>${fechaHora(s.creada)}</dd>
          <dt>Última edición</dt><dd>${fechaHora(s.actualizada)}</dd>
          <dt>Número</dt><dd>${s.id}</dd>
        </dl>
        <form method="post" action="/solicitudes/${s.id}/eliminar" data-confirm="¿Eliminar esta solicitud? No se puede deshacer.">
          <button class="btn btn--danger" type="submit">Eliminar solicitud</button>
        </form>
      </section>
    </aside>`;

  return layout({
    titulo: nueva ? "Registrar solicitud" : s.nombre,
    activo: "solicitudes",
    ok,
    contenido: `
    <header class="head">
      <div>
        <a class="back" href="/solicitudes">Solicitudes</a>
        <h1>${nueva ? "Registrar solicitud" : esc(s.nombre)}</h1>
      </div>
      ${nueva ? "" : estado(s.estado)}
    </header>
    <div class="detail">
      <form class="card form" method="post" action="${nueva ? "/solicitudes" : `/solicitudes/${s.id}`}" novalidate>
        ${errores ? '<p class="error" role="alert">Revisa los campos marcados.</p>' : ""}
        <fieldset>
          <legend>Contacto</legend>
          <div class="grid2">
            <div class="field"><label for="nombre">Nombre</label><input id="nombre" name="nombre" value="${esc(s.nombre)}" required maxlength="120"${errores?.nombre ? ' aria-invalid="true"' : ""}>${campoErr(errores, "nombre")}</div>
            <div class="field"><label for="negocio">Negocio <span class="opt">(opcional)</span></label><input id="negocio" name="negocio" value="${esc(s.negocio)}" maxlength="120"></div>
            <div class="field"><label for="telefono">Teléfono o WhatsApp</label><input id="telefono" name="telefono" value="${esc(s.telefono)}" inputmode="tel" maxlength="30"></div>
            <div class="field"><label for="correo">Correo</label><input id="correo" name="correo" type="email" value="${esc(s.correo)}" maxlength="160"${errores?.correo ? ' aria-invalid="true"' : ""}>${campoErr(errores, "correo")}</div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Solicitud</legend>
          <div class="grid2">
            <div class="field"><label for="origen">Llegó por</label><select id="origen" name="origen">${opciones(ORIGENES, s.origen)}</select></div>
            <div class="field"><label for="tipo">Necesita</label><select id="tipo" name="tipo">${tipoOpts}</select></div>
          </div>
          <div class="field"><label for="mensaje">Lo que pidió</label><textarea id="mensaje" name="mensaje" rows="4" maxlength="4000" placeholder="Copia aquí el mensaje de WhatsApp o del correo">${esc(s.mensaje)}</textarea></div>
        </fieldset>
        <fieldset>
          <legend>Seguimiento</legend>
          <div class="grid3">
            <div class="field"><label for="estado">Estado</label><select id="estado" name="estado">${opciones(ESTADOS, s.estado)}</select></div>
            <div class="field"><label for="valor">Valor cotizado (COP)</label><input id="valor" name="valor" value="${s.valor ?? ""}" inputmode="numeric" placeholder="Ej: 1500000"${errores?.valor ? ' aria-invalid="true"' : ""}>${campoErr(errores, "valor")}</div>
            <div class="field"><label for="seguimiento">Próximo seguimiento</label><input id="seguimiento" name="seguimiento" type="date" value="${esc(isoFecha(s.seguimiento) || s.seguimiento || "")}"></div>
          </div>
          <div class="field"><label for="cliente_id">Cliente</label><select id="cliente_id" name="cliente_id">${clienteOpts}</select></div>
          <div class="field"><label for="notas">Notas internas</label><textarea id="notas" name="notas" rows="4" maxlength="4000" placeholder="Lo que hablaron, acuerdos, próximos pasos">${esc(s.notas)}</textarea></div>
        </fieldset>
        <div class="form__actions">
          <button class="btn btn--primary" type="submit">${nueva ? "Registrar solicitud" : "Guardar cambios"}</button>
          <a class="btn btn--ghost" href="${nueva ? "/solicitudes" : `/solicitudes/${s.id}`}">Cancelar</a>
        </div>
      </form>
      ${acciones}
    </div>`,
  });
}

/* ---------- Clientes ---------- */

function clientes({ filas, q }, ok) {
  const cuerpo = filas.length
    ? `
    <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Cliente</th><th>Teléfono</th><th>Correo</th><th>Ciudad</th><th>Solicitudes</th><th>Ganado</th></tr></thead>
      <tbody>
      ${filas
        .map(
          (c) => `
        <tr>
          <td data-label="Cliente"><a class="row-link" href="/clientes/${c.id}"><strong>${esc(c.nombre)}</strong></a>${c.negocio ? `<span class="sub">${esc(c.negocio)}</span>` : ""}</td>
          <td data-label="Teléfono">${esc(c.telefono)}</td>
          <td data-label="Correo">${esc(c.correo)}</td>
          <td data-label="Ciudad">${esc(c.ciudad)}</td>
          <td data-label="Solicitudes" class="num">${c.solicitudes}</td>
          <td data-label="Ganado" class="num">${Number(c.ganado) ? dinero(c.ganado) : ""}</td>
        </tr>`
        )
        .join("")}
      </tbody>
    </table>
    </div>`
    : `<p class="empty">${q ? "Ningún cliente coincide con la búsqueda." : "Aún no tienes clientes. Créalos aquí o desde una solicitud."}</p>`;

  return layout({
    titulo: "Clientes",
    activo: "clientes",
    ok,
    contenido: `
    <header class="head">
      <h1>Clientes</h1>
      <a class="btn btn--primary" href="/clientes/nuevo">Nuevo cliente</a>
    </header>
    <form class="filters" method="get" action="/clientes" role="search">
      <input type="search" name="q" value="${esc(q)}" placeholder="Buscar por nombre, negocio, teléfono, correo o ciudad" aria-label="Buscar">
      <button class="btn" type="submit">Buscar</button>
      ${q ? '<a class="clear" href="/clientes">Quitar búsqueda</a>' : ""}
    </form>
    <p class="count">${filas.length} ${filas.length === 1 ? "cliente" : "clientes"}</p>
    ${cuerpo}`,
  });
}

function clienteForm({ c, solicitudes: sols = [], errores, ok }) {
  const nuevo = !c.id;
  const wa = telefonoWhatsApp(c.telefono);

  const historial = nuevo
    ? ""
    : `
    <aside class="aside">
      <section class="box">
        <h2>Contactar</h2>
        <div class="actions">
          ${wa ? `<a class="btn" href="https://wa.me/${wa}" target="_blank" rel="noopener">Abrir WhatsApp</a>` : ""}
          ${c.correo ? `<a class="btn" href="mailto:${esc(c.correo)}">Escribir correo</a>` : ""}
          ${!wa && !c.correo ? '<p class="muted">Agrega un teléfono o correo para contactar desde aquí.</p>' : ""}
        </div>
      </section>
      <section class="box">
        <h2>Solicitudes de este cliente</h2>
        ${
          sols.length
            ? `<ul class="recent">${sols
                .map(
                  (s) => `<li><a href="/solicitudes/${s.id}"><strong>${esc(s.tipo[0].toUpperCase() + s.tipo.slice(1))}</strong></a>
                  <span class="recent__meta">${fechaHora(s.creada)}${s.valor ? `, ${dinero(s.valor)}` : ""}</span>${estado(s.estado)}</li>`
                )
                .join("")}</ul>`
            : '<p class="muted">Todavía no tiene solicitudes vinculadas.</p>'
        }
        <a class="btn" href="/solicitudes/nueva?cliente=${c.id}">Registrar solicitud para este cliente</a>
      </section>
      <section class="box">
        <form method="post" action="/clientes/${c.id}/eliminar" data-confirm="¿Eliminar este cliente? Sus solicitudes se conservan sin cliente asignado.">
          <button class="btn btn--danger" type="submit">Eliminar cliente</button>
        </form>
      </section>
    </aside>`;

  return layout({
    titulo: nuevo ? "Nuevo cliente" : c.nombre,
    activo: "clientes",
    ok,
    contenido: `
    <header class="head">
      <div>
        <a class="back" href="/clientes">Clientes</a>
        <h1>${nuevo ? "Nuevo cliente" : esc(c.nombre)}</h1>
      </div>
    </header>
    <div class="detail">
      <form class="card form" method="post" action="${nuevo ? "/clientes" : `/clientes/${c.id}`}" novalidate>
        ${errores ? '<p class="error" role="alert">Revisa los campos marcados.</p>' : ""}
        <div class="grid2">
          <div class="field"><label for="nombre">Nombre</label><input id="nombre" name="nombre" value="${esc(c.nombre)}" required maxlength="120"${errores?.nombre ? ' aria-invalid="true"' : ""}>${campoErr(errores, "nombre")}</div>
          <div class="field"><label for="negocio">Negocio <span class="opt">(opcional)</span></label><input id="negocio" name="negocio" value="${esc(c.negocio)}" maxlength="120"></div>
          <div class="field"><label for="telefono">Teléfono o WhatsApp</label><input id="telefono" name="telefono" value="${esc(c.telefono)}" inputmode="tel" maxlength="30"></div>
          <div class="field"><label for="correo">Correo</label><input id="correo" name="correo" type="email" value="${esc(c.correo)}" maxlength="160"${errores?.correo ? ' aria-invalid="true"' : ""}>${campoErr(errores, "correo")}</div>
          <div class="field"><label for="ciudad">Ciudad</label><input id="ciudad" name="ciudad" value="${esc(c.ciudad)}" maxlength="80"></div>
        </div>
        <div class="field"><label for="notas">Notas</label><textarea id="notas" name="notas" rows="5" maxlength="4000">${esc(c.notas)}</textarea></div>
        <div class="form__actions">
          <button class="btn btn--primary" type="submit">${nuevo ? "Crear cliente" : "Guardar cambios"}</button>
          <a class="btn btn--ghost" href="${nuevo ? "/clientes" : `/clientes/${c.id}`}">Cancelar</a>
        </div>
      </form>
      ${historial}
    </div>`,
  });
}

/* ---------- Exportar ---------- */

function exportar() {
  return layout({
    titulo: "Exportar a Excel",
    activo: "exportar",
    contenido: `
    <header class="head"><h1>Exportar a Excel</h1></header>
    <div class="export">
      <section class="box">
        <h2>Solicitudes</h2>
        <p class="muted">Todas las solicitudes con su origen, estado, valor, seguimiento y notas.</p>
        <form method="get" action="/exportar/solicitudes.xlsx" class="export__form">
          <label for="ex-estado">Estado</label>
          <select id="ex-estado" name="estado">${opciones({ abiertas: "Abiertas", ...ESTADOS }, "", { vacia: "Todos" })}</select>
          <label for="ex-origen">Origen</label>
          <select id="ex-origen" name="origen">${opciones(ORIGENES, "", { vacia: "Todos" })}</select>
          <button class="btn btn--primary" type="submit">Descargar solicitudes</button>
        </form>
      </section>
      <section class="box">
        <h2>Clientes</h2>
        <p class="muted">Tus clientes con sus datos de contacto, número de solicitudes y valor ganado.</p>
        <a class="btn btn--primary" href="/exportar/clientes.xlsx">Descargar clientes</a>
      </section>
    </div>`,
  });
}

module.exports = { entrar, inicio, solicitudes, solicitudForm, clientes, clienteForm, exportar, documento, esc };
