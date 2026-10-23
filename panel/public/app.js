// Panel de clientes: app del navegador sobre Firebase (Authentication + Firestore, plan gratis).
// Solo entra la cuenta de Google cuyo ID está en la colección "admins" (lo exigen las reglas de Firestore).
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, onSnapshot, query, where, addDoc, updateDoc, deleteDoc,
  writeBatch, serverTimestamp, Timestamp, getCountFromServer,
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

import * as V from "./vistas.js";
import * as D from "./datos.js";
import * as X from "./excel.js";
import { TIPOS } from "./constantes.js";

const raiz = document.getElementById("app");
const pintar = (html) => {
  raiz.innerHTML = html;
  formTocado = false;
};

/* ---------- Conexión con Firebase ---------- */

// Firebase Hosting entrega la configuración del proyecto: no hay claves en el repositorio.
const config = await fetch("/__/firebase/init.json")
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);

if (!config) {
  raiz.innerHTML = V.entrar({ error: "No se encontró la configuración de Firebase. Abre el panel desde su dirección de Firebase Hosting." });
  throw new Error("Sin configuración de Firebase");
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

/* ---------- Estado ---------- */

const estado = {
  solicitudes: new Map(),
  clientes: new Map(),
  visitas: [],
  presencia: [],
  totalVisitas: 0,
  listos: new Set(),
  cancelar: [],
};
let formTocado = false;
const asignando = new Set();

// Convierte un documento de Firestore en un objeto con fechas normales.
function deDoc(d) {
  const datos = d.data({ serverTimestamps: "estimate" });
  const o = { id: d.id };
  for (const [k, v] of Object.entries(datos)) o[k] = v && typeof v.toDate === "function" ? v.toDate() : v;
  return o;
}

function detenerDatos() {
  estado.cancelar.forEach((f) => f());
  estado.cancelar = [];
  estado.solicitudes.clear();
  estado.clientes.clear();
  estado.visitas = [];
  estado.presencia = [];
  estado.listos.clear();
}

function iniciarDatos() {
  const escuchar = (q, alCambiar) =>
    estado.cancelar.push(
      onSnapshot(q, alCambiar, (err) => {
        console.error(err);
        aviso("Se perdió la conexión con la base de datos. Recarga la página.", true);
      })
    );

  escuchar(collection(db, "solicitudes"), (snap) => {
    estado.solicitudes = new Map(snap.docs.map((d) => [d.id, deDoc(d)]));
    estado.listos.add("solicitudes");
    numerar("solicitudes", estado.solicitudes, "creada");
    programarRender();
  });

  escuchar(collection(db, "clientes"), (snap) => {
    estado.clientes = new Map(snap.docs.map((d) => [d.id, deDoc(d)]));
    estado.listos.add("clientes");
    numerar("clientes", estado.clientes, "creado");
    programarRender();
  });

  // Visitas de los últimos 14 días (para el gráfico) y quién está en la página ahora.
  const hace14 = D.inicioDia(new Date(Date.now() - 5 * 3600 * 1000 - 13 * 86400000).toISOString().slice(0, 10));
  escuchar(query(collection(db, "visitas"), where("creada", ">=", Timestamp.fromDate(hace14))), (snap) => {
    const antes = estado.visitas.length;
    estado.visitas = snap.docs.map(deDoc);
    if (estado.listos.has("visitas")) estado.totalVisitas += Math.max(0, estado.visitas.length - antes);
    estado.listos.add("visitas");
    refrescarVisitas();
  });

  const hace30min = Timestamp.fromDate(new Date(Date.now() - 30 * 60000));
  escuchar(query(collection(db, "presencia"), where("visto", ">=", hace30min)), (snap) => {
    estado.presencia = snap.docs.map(deDoc);
    refrescarVisitas();
  });

  getCountFromServer(collection(db, "visitas"))
    .then((r) => {
      estado.totalVisitas = r.data().count;
      refrescarVisitas();
    })
    .catch(() => {});

  // Limpieza de presencia vieja (más de un día).
  getDocs(query(collection(db, "presencia"), where("visto", "<", Timestamp.fromDate(new Date(Date.now() - 86400000)))))
    .then((snap) => {
      if (snap.empty) return;
      const lote = writeBatch(db);
      snap.docs.slice(0, 400).forEach((d) => lote.delete(d.ref));
      return lote.commit();
    })
    .catch(() => {});
}

// Las solicitudes que llegan por la página no traen número: se les asigna aquí, en orden de llegada.
function numerar(coleccion, mapa, campoFecha) {
  const sinNumero = [...mapa.values()].filter((o) => !Number.isInteger(o.numero) && !asignando.has(o.id));
  if (!sinNumero.length) return;
  let siguiente = siguienteNumero(mapa);
  sinNumero.sort((a, b) => (a[campoFecha]?.getTime() || 0) - (b[campoFecha]?.getTime() || 0));
  const lote = writeBatch(db);
  for (const o of sinNumero) {
    asignando.add(o.id);
    lote.update(doc(db, coleccion, o.id), { numero: siguiente++ });
  }
  lote.commit().catch((err) => console.error("No se pudo numerar:", err)).finally(() => sinNumero.forEach((o) => asignando.delete(o.id)));
}

const siguienteNumero = (mapa) => Math.max(0, ...[...mapa.values()].map((o) => (Number.isInteger(o.numero) ? o.numero : 0))) + 1;

/* ---------- Sesión ---------- */

onAuthStateChanged(auth, async (usuario) => {
  detenerDatos();
  if (!usuario) {
    pintar(V.entrar());
    return;
  }
  pintar(V.entrar({ cargando: true }));
  let esAdmin = false;
  try {
    esAdmin = (await getDoc(doc(db, "admins", usuario.uid))).exists();
  } catch (_) {
    esAdmin = false;
  }
  if (!esAdmin) {
    pintar(V.sinAcceso({ correo: usuario.email || "", uid: usuario.uid }));
    return;
  }
  iniciarDatos();
});

async function entrar() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    const motivo =
      err.code === "auth/popup-blocked"
        ? "El navegador bloqueó la ventana de Google. Permite las ventanas emergentes para este sitio e intenta de nuevo."
        : err.code === "auth/unauthorized-domain"
        ? "Este dominio no está autorizado. Agrégalo en Firebase → Authentication → Configuración → Dominios autorizados."
        : err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request"
        ? ""
        : "No se pudo iniciar sesión. Intenta de nuevo.";
    pintar(V.entrar({ error: motivo }));
  }
}

/* ---------- Navegación ---------- */

function rutaActual() {
  const u = new URL(location.href);
  return { path: u.pathname.replace(/\/+$/, "") || "/", q: Object.fromEntries(u.searchParams) };
}

function ir(url, { reemplazar = false } = {}) {
  history[reemplazar ? "replaceState" : "pushState"](null, "", url);
  render();
  window.scrollTo(0, 0);
}

window.addEventListener("popstate", () => render());

let renderPendiente = false;
function programarRender() {
  if (renderPendiente) return;
  renderPendiente = true;
  requestAnimationFrame(() => {
    renderPendiente = false;
    // No se repinta un formulario que la persona está llenando.
    if (formTocado && raiz.querySelector("form.form")) return;
    render();
  });
}

const datosListos = () => estado.listos.has("solicitudes") && estado.listos.has("clientes");
const solicitudesArr = () => [...estado.solicitudes.values()];
const clientesArr = () => [...estado.clientes.values()];
const opcionesClientes = () =>
  clientesArr()
    .map(({ id, nombre, negocio }) => ({ id, nombre, negocio }))
    .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es", { sensitivity: "base" }));

function datosVisitas() {
  return D.visitas(estado.visitas, estado.presencia, estado.totalVisitas);
}

const noEncontrado = () => `
  <main class="login"><div class="login__card"><h1>No encontramos esa página</h1><p class="muted">Puede que el registro se haya eliminado.</p><a class="btn btn--primary" href="/">Volver al inicio</a></div></main>`;

function render() {
  if (!auth.currentUser || !estado.cancelar.length) return;
  if (!datosListos()) {
    pintar(V.entrar({ cargando: true }));
    return;
  }
  const { path, q } = rutaActual();
  const ok = q.ok || "";
  const sols = solicitudesArr();
  const clis = clientesArr();
  let m;

  if (path === "/") {
    pintar(V.inicio({ ...D.resumen(sols, clis), visitas: datosVisitas() }, ok));
  } else if (path === "/solicitudes") {
    const filtros = { q: (q.q || "").slice(0, 100), estado: q.estado || "", origen: q.origen || "" };
    pintar(V.solicitudes({ filas: D.listarSolicitudes(sols, estado.clientes, filtros), filtros }, ok));
  } else if (path === "/solicitudes/nueva") {
    const s = { origen: "whatsapp", estado: "nueva", tipo: TIPOS[0], cliente_id: q.cliente || null };
    const c = s.cliente_id && estado.clientes.get(s.cliente_id);
    if (c) Object.assign(s, { nombre: c.nombre, negocio: c.negocio, telefono: c.telefono, correo: c.correo });
    pintar(V.solicitudForm({ s, clientes: opcionesClientes() }));
  } else if ((m = path.match(/^\/solicitudes\/([^/]+)$/))) {
    const s = estado.solicitudes.get(m[1]);
    if (!s) return pintar(noEncontrado());
    const conCliente = { ...s, cliente_nombre: estado.clientes.get(s.cliente_id)?.nombre || null };
    pintar(V.solicitudForm({ s: conCliente, clientes: opcionesClientes(), ok }));
  } else if (path === "/clientes") {
    const texto = (q.q || "").slice(0, 100);
    pintar(V.clientes({ filas: D.listarClientes(clis, sols, { q: texto }), q: texto }, ok));
  } else if (path === "/clientes/nuevo") {
    pintar(V.clienteForm({ c: {} }));
  } else if ((m = path.match(/^\/clientes\/([^/]+)$/))) {
    const c = estado.clientes.get(m[1]);
    if (!c) return pintar(noEncontrado());
    const suyas = D.listarSolicitudes(sols, estado.clientes, { cliente: c.id }).slice(0, 100);
    pintar(V.clienteForm({ c, solicitudes: suyas, ok }));
  } else if (path === "/exportar") {
    pintar(V.exportar());
  } else if (path === "/respaldo") {
    pintar(V.respaldo());
  } else {
    pintar(noEncontrado());
  }
}

/* Visitas en vivo: el bloque se actualiza solo, marcando los números que cambian. */
function refrescarVisitas() {
  const caja = document.getElementById("visitas");
  if (!caja) return;
  const antes = [...caja.querySelectorAll("[data-n]")].map((el) => el.dataset.n);
  caja.innerHTML = V.visitasContenido(datosVisitas());
  caja.querySelectorAll("[data-n]").forEach((el, i) => {
    if (antes[i] !== undefined && antes[i] !== el.dataset.n) {
      el.classList.add("is-new");
      setTimeout(() => el.classList.remove("is-new"), 1200);
    }
  });
}
setInterval(() => document.visibilityState === "visible" && refrescarVisitas(), 5000);

/* ---------- Avisos ---------- */

function aviso(texto, error = false) {
  const main = raiz.querySelector(".main") || raiz.querySelector(".login__card");
  if (!main) return;
  main.querySelectorAll(".flash").forEach((el) => el.remove());
  const p = document.createElement("p");
  p.className = "flash" + (error ? " flash--error" : "");
  p.setAttribute("role", error ? "alert" : "status");
  p.textContent = texto;
  main.prepend(p);
}

/* ---------- Acciones ---------- */

const ahora = () => serverTimestamp();

async function guardarSolicitud(id, form) {
  const { d, errores } = D.leerSolicitud(form, TIPOS);
  if (d.cliente_id && !estado.clientes.has(d.cliente_id)) d.cliente_id = null;
  if (errores) {
    const actual = id ? estado.solicitudes.get(id) || {} : {};
    pintar(V.solicitudForm({ s: { ...actual, ...d, id: id || undefined }, clientes: opcionesClientes(), errores }));
    formTocado = true;
    return;
  }
  if (id) {
    await updateDoc(doc(db, "solicitudes", id), { ...d, actualizada: ahora() });
    ir(`/solicitudes/${id}?ok=guardada`, { reemplazar: true });
  } else {
    const ref = await addDoc(collection(db, "solicitudes"), {
      ...d,
      numero: siguienteNumero(estado.solicitudes),
      creada: ahora(),
      actualizada: ahora(),
    });
    ir(`/solicitudes/${ref.id}?ok=creada`, { reemplazar: true });
  }
}

async function guardarCliente(id, form) {
  const { d, errores } = D.leerCliente(form);
  if (errores) {
    const actual = id ? estado.clientes.get(id) || {} : {};
    const suyas = id ? D.listarSolicitudes(solicitudesArr(), estado.clientes, { cliente: id }) : [];
    pintar(V.clienteForm({ c: { ...actual, ...d, id: id || undefined }, solicitudes: suyas, errores }));
    formTocado = true;
    return;
  }
  if (id) {
    await updateDoc(doc(db, "clientes", id), { ...d, actualizado: ahora() });
    ir(`/clientes/${id}?ok=cliente-guardado`, { reemplazar: true });
  } else {
    const ref = await addDoc(collection(db, "clientes"), {
      ...d,
      numero: siguienteNumero(estado.clientes),
      creado: ahora(),
      actualizado: ahora(),
    });
    ir(`/clientes/${ref.id}?ok=cliente-creado`, { reemplazar: true });
  }
}

async function clienteDesdeSolicitud(id) {
  const s = estado.solicitudes.get(id);
  if (!s) return;
  if (s.cliente_id && estado.clientes.has(s.cliente_id)) return ir(`/solicitudes/${id}`, { reemplazar: true });
  const ref = doc(collection(db, "clientes"));
  const lote = writeBatch(db);
  lote.set(ref, {
    nombre: s.nombre,
    negocio: s.negocio || null,
    telefono: s.telefono || null,
    correo: s.correo || null,
    ciudad: null,
    notas: null,
    numero: siguienteNumero(estado.clientes),
    creado: ahora(),
    actualizado: ahora(),
  });
  lote.update(doc(db, "solicitudes", id), { cliente_id: ref.id, actualizada: ahora() });
  await lote.commit();
  ir(`/solicitudes/${id}?ok=vinculado`, { reemplazar: true });
}

async function eliminarCliente(id) {
  // Igual que antes: sus solicitudes se conservan, sin cliente asignado.
  const suyas = solicitudesArr().filter((s) => s.cliente_id === id);
  for (let i = 0; i < suyas.length || i === 0; i += 400) {
    const lote = writeBatch(db);
    if (i === 0) lote.delete(doc(db, "clientes", id));
    suyas.slice(i, i + 400).forEach((s) => lote.update(doc(db, "solicitudes", s.id), { cliente_id: null, actualizada: ahora() }));
    await lote.commit();
  }
  ir("/clientes?ok=cliente-eliminado", { reemplazar: true });
}

async function exportarSolicitudes(params) {
  const filas = D.listarSolicitudes(solicitudesArr(), estado.clientes, { estado: params.estado || "", origen: params.origen || "" });
  await X.solicitudesXlsx(filas);
}

async function exportarClientes() {
  await X.clientesXlsx(D.listarClientes(clientesArr(), solicitudesArr()));
}

function descargarRespaldo() {
  const fechaISO = (v) => (v instanceof Date ? v.toISOString() : v ?? null);
  const limpiar = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fechaISO(v)]));
  const datos = {
    formato: "tu-pagina-a-un-clic/respaldo",
    version: 1,
    exportado: new Date().toISOString(),
    clientes: clientesArr().map(limpiar),
    solicitudes: solicitudesArr().map(limpiar),
  };
  const blob = new Blob([JSON.stringify(datos, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `respaldo-panel-${D.hoyBogota()}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

async function importarRespaldo(archivo) {
  const progreso = document.getElementById("progreso-respaldo");
  const decir = (t) => progreso && (progreso.textContent = t);
  let paquete;
  try {
    paquete = D.prepararRespaldo(JSON.parse(await archivo.text()));
  } catch (err) {
    decir(err instanceof SyntaxError ? "El archivo no es un JSON válido." : err.message);
    return;
  }
  const ops = [
    ...paquete.clientes.map((o) => ["clientes", o]),
    ...paquete.solicitudes.map((o) => ["solicitudes", o]),
    ...paquete.visitas.map((o) => ["visitas", o]),
  ];
  if (!ops.length) return decir("El archivo no tiene datos para importar.");
  const resumen = `${paquete.clientes.length} clientes, ${paquete.solicitudes.length} solicitudes y ${paquete.visitas.length} visitas`;
  if (!window.confirm(`Se van a importar ${resumen}. ¿Continuar?`)) return decir("");
  if (ops.length > 15000) {
    return decir("El archivo es muy grande para la cuota gratis diaria de Firestore (20.000 escrituras). Exporta con menos visitas.");
  }
  let hechos = 0;
  try {
    for (let i = 0; i < ops.length; i += 400) {
      const lote = writeBatch(db);
      for (const [col, { id, datos }] of ops.slice(i, i + 400)) lote.set(doc(db, col, id), datos);
      await lote.commit();
      hechos = Math.min(ops.length, i + 400);
      decir(`Importando… ${hechos} de ${ops.length}`);
    }
    ir("/respaldo?ok=importado", { reemplazar: true });
    aviso(`Respaldo importado: ${resumen}.`);
  } catch (err) {
    console.error(err);
    decir(`Se detuvo después de ${hechos} de ${ops.length} registros. Puedes volver a importar el mismo archivo: no se duplica nada.`);
  }
}

/* ---------- Eventos ---------- */

document.addEventListener("click", async (e) => {
  const boton = e.target.closest("[data-accion]");
  if (boton) {
    e.preventDefault();
    const accion = boton.dataset.accion;
    if (accion === "entrar") return entrar();
    if (accion === "salir") return signOut(auth);
    if (accion === "copiar-uid") {
      navigator.clipboard?.writeText(document.getElementById("uid")?.textContent || "");
      boton.textContent = "Copiado";
      return;
    }
    if (accion === "descargar-respaldo") return descargarRespaldo();
    return;
  }

  const a = e.target.closest("a[href]");
  if (!a || a.target || a.hasAttribute("download") || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  e.preventDefault();
  if (url.pathname === "/exportar/clientes.xlsx") {
    try {
      await exportarClientes();
    } catch (err) {
      aviso(err.message, true);
    }
    return;
  }
  ir(url.pathname + url.search);
});

document.addEventListener("input", (e) => {
  if (e.target.closest("form.form")) formTocado = true;
});

document.addEventListener("change", (e) => {
  if (e.target.id === "archivo-respaldo" && e.target.files[0]) importarRespaldo(e.target.files[0]);
});

document.addEventListener("submit", async (e) => {
  const form = e.target;
  e.preventDefault();
  const mensaje = form.getAttribute("data-confirm");
  if (mensaje && !window.confirm(mensaje)) return;

  const accion = new URL(form.getAttribute("action") || location.pathname, location.href).pathname;
  const valores = Object.fromEntries(new FormData(form));

  if ((form.getAttribute("method") || "get").toLowerCase() === "get") {
    if (accion === "/exportar/solicitudes.xlsx") {
      try {
        await exportarSolicitudes(valores);
      } catch (err) {
        aviso(err.message, true);
      }
      return;
    }
    const qs = new URLSearchParams(Object.entries(valores).filter(([, v]) => v)).toString();
    ir(accion + (qs ? `?${qs}` : ""));
    return;
  }

  const botones = form.querySelectorAll("button");
  botones.forEach((b) => (b.disabled = true));
  try {
    let m;
    if (accion === "/salir") await signOut(auth);
    else if (accion === "/solicitudes") await guardarSolicitud(null, valores);
    else if ((m = accion.match(/^\/solicitudes\/([^/]+)\/cliente$/))) await clienteDesdeSolicitud(m[1]);
    else if ((m = accion.match(/^\/solicitudes\/([^/]+)\/eliminar$/))) {
      await deleteDoc(doc(db, "solicitudes", m[1]));
      ir("/solicitudes?ok=eliminada", { reemplazar: true });
    } else if ((m = accion.match(/^\/solicitudes\/([^/]+)$/))) await guardarSolicitud(m[1], valores);
    else if (accion === "/clientes") await guardarCliente(null, valores);
    else if ((m = accion.match(/^\/clientes\/([^/]+)\/eliminar$/))) await eliminarCliente(m[1]);
    else if ((m = accion.match(/^\/clientes\/([^/]+)$/))) await guardarCliente(m[1], valores);
  } catch (err) {
    console.error(err);
    botones.forEach((b) => (b.disabled = false));
    aviso("No se pudo guardar. Revisa tu conexión e intenta de nuevo.", true);
  }
});
