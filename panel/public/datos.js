// Cálculos del panel sobre los datos ya cargados de Firestore.
// Todo en hora de Colombia (UTC-5, sin horario de verano).
import { ORIGENES, ESTADOS } from "./constantes.js";

const OFFSET = 5 * 3600 * 1000;
const DIA = 24 * 3600 * 1000;

// "AAAA-MM-DD" de hoy en Bogotá.
export const hoyBogota = (ahora = Date.now()) => new Date(ahora - OFFSET).toISOString().slice(0, 10);
// Fecha (Date) en que empieza un día de Bogotá.
export const inicioDia = (dia) => new Date(Date.parse(`${dia}T00:00:00Z`) + OFFSET);
const sumarDias = (dia, n) => new Date(Date.parse(`${dia}T00:00:00Z`) + n * DIA).toISOString().slice(0, 10);
const diaDe = (fecha) => new Date(fecha.getTime() - OFFSET).toISOString().slice(0, 10);

const CERRADOS = ["ganada", "perdida"];
const vencido = (s, hoy) => Boolean(s.seguimiento) && s.seguimiento < hoy && !CERRADOS.includes(s.estado);
const porFechaDesc = (a, b) => (b.creada?.getTime() || 0) - (a.creada?.getTime() || 0);

/* ---------- Resumen del inicio ---------- */

export function resumen(solicitudes, clientes, ahora = Date.now()) {
  const hoy = hoyBogota(ahora);
  const estados = Object.fromEntries(Object.keys(ESTADOS).map((k) => [k, 0]));
  for (const s of solicitudes) if (s.estado in estados) estados[s.estado]++;

  const limite = sumarDias(hoy, 7);
  const seguimientos = solicitudes
    .filter((s) => s.seguimiento && s.seguimiento <= limite && !CERRADOS.includes(s.estado))
    .sort((a, b) => a.seguimiento.localeCompare(b.seguimiento))
    .slice(0, 20)
    .map((s) => ({ ...s, vencido: s.seguimiento < hoy }));

  const recientes = [...solicitudes].sort(porFechaDesc).slice(0, 6);

  const inicioMes = inicioDia(`${hoy.slice(0, 7)}-01`).getTime();
  const totales = {
    clientes: clientes.length,
    mes: solicitudes.filter((s) => s.creada && s.creada.getTime() >= inicioMes).length,
    cotizado: solicitudes.filter((s) => s.estado === "cotizada").reduce((a, s) => a + (Number(s.valor) || 0), 0),
    ganado: solicitudes.filter((s) => s.estado === "ganada").reduce((a, s) => a + (Number(s.valor) || 0), 0),
  };
  return { estados, seguimientos, recientes, totales };
}

/* ---------- Visitas ---------- */

export function visitas(lista, presencia, totalHistorico, ahora = Date.now()) {
  const hoy = hoyBogota(ahora);
  const desdeHoy = inicioDia(hoy).getTime();
  const desdeSemana = inicioDia(sumarDias(hoy, -6)).getTime();
  const deHoy = lista.filter((v) => v.creada && v.creada.getTime() >= desdeHoy);
  const deSemana = lista.filter((v) => v.creada && v.creada.getTime() >= desdeSemana);

  const contar = (filas, clave, vacio) => {
    const m = new Map();
    for (const f of filas) {
      const k = f[clave] || vacio;
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([k, n]) => ({ [clave]: k, n })).sort((a, b) => b.n - a.n);
  };

  const dias = [];
  for (let i = 13; i >= 0; i--) dias.push({ dia: sumarDias(hoy, -i), n: 0 });
  const indice = new Map(dias.map((d, i) => [d.dia, i]));
  for (const v of lista) {
    if (!v.creada) continue;
    const i = indice.get(diaDe(v.creada));
    if (i !== undefined) dias[i].n++;
  }

  return {
    // Se considera "en la página" a quien dio señal en los últimos 90 segundos.
    en_linea: presencia.filter((p) => p.visto && ahora - p.visto.getTime() < 90 * 1000).length,
    hoy: deHoy.length,
    unicos_hoy: new Set(deHoy.map((v) => v.visitante)).size,
    semana: deSemana.length,
    total: Math.max(totalHistorico, lista.length),
    origenes: contar(deSemana, "origen", "directo").slice(0, 6),
    dispositivos: contar(deSemana, "dispositivo", "computador"),
    ultimas: [...lista].sort(porFechaDesc).slice(0, 8),
    dias,
  };
}

/* ---------- Solicitudes ---------- */

export function listarSolicitudes(solicitudes, clientesPorId, { q = "", estado = "", origen = "", cliente = "" } = {}, ahora = Date.now()) {
  const hoy = hoyBogota(ahora);
  const texto = q.trim().toLowerCase();
  return solicitudes
    .filter((s) => {
      if (estado && ESTADOS[estado] && s.estado !== estado) return false;
      if (estado === "abiertas" && CERRADOS.includes(s.estado)) return false;
      if (origen && ORIGENES[origen] && s.origen !== origen) return false;
      if (cliente && s.cliente_id !== cliente) return false;
      if (texto) {
        const campos = [s.nombre, s.negocio, s.mensaje, s.notas, s.telefono, s.correo];
        if (!campos.some((c) => String(c || "").toLowerCase().includes(texto))) return false;
      }
      return true;
    })
    .sort(porFechaDesc)
    .map((s) => ({ ...s, cliente_nombre: clientesPorId.get(s.cliente_id)?.nombre || null, vencido: vencido(s, hoy) }));
}

/* ---------- Clientes ---------- */

export function listarClientes(clientes, solicitudes, { q = "" } = {}) {
  const texto = q.trim().toLowerCase();
  const porCliente = new Map();
  for (const s of solicitudes) {
    if (!s.cliente_id) continue;
    const r = porCliente.get(s.cliente_id) || { solicitudes: 0, ganado: 0, ultima: null };
    r.solicitudes++;
    if (s.estado === "ganada") r.ganado += Number(s.valor) || 0;
    if (s.creada && (!r.ultima || s.creada > r.ultima)) r.ultima = s.creada;
    porCliente.set(s.cliente_id, r);
  }
  return clientes
    .filter((c) => {
      if (!texto) return true;
      return [c.nombre, c.negocio, c.telefono, c.correo, c.ciudad].some((v) => String(v || "").toLowerCase().includes(texto));
    })
    .map((c) => ({ ...c, ...(porCliente.get(c.id) || { solicitudes: 0, ganado: 0, ultima: null }) }))
    .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" }));
}

/* ---------- Lectura y validación de formularios (igual que el panel anterior) ---------- */

const limpiar = (v, max) => {
  const s = typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "";
  return s || null;
};
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function leerSolicitud(form, TIPOS) {
  const errores = {};
  const d = {
    nombre: limpiar(form.nombre, 120),
    negocio: limpiar(form.negocio, 120),
    telefono: limpiar(form.telefono, 30),
    correo: limpiar(form.correo, 160),
    tipo: TIPOS.includes(form.tipo) ? form.tipo : TIPOS[0],
    mensaje: limpiar(form.mensaje, 4000),
    origen: ORIGENES[form.origen] ? form.origen : "otro",
    estado: ESTADOS[form.estado] ? form.estado : "nueva",
    valor: null,
    seguimiento: /^\d{4}-\d{2}-\d{2}$/.test(form.seguimiento || "") ? form.seguimiento : null,
    notas: limpiar(form.notas, 4000),
    cliente_id: limpiar(form.cliente_id, 60),
  };
  if (!d.nombre) errores.nombre = "Escribe el nombre de la persona.";
  if (d.correo && !CORREO.test(d.correo)) errores.correo = "Revisa el correo, no parece válido.";
  const valorTexto = String(form.valor || "").trim();
  if (valorTexto) {
    const valor = valorTexto.replace(/[\s.,$]/g, "");
    if (!/^\d+$/.test(valor)) errores.valor = "Escribe el valor en números, por ejemplo 1500000.";
    else if (valor.length > 13) errores.valor = "El valor es demasiado grande.";
    else d.valor = Number(valor);
  }
  return { d, errores: Object.keys(errores).length ? errores : null };
}

export function leerCliente(form) {
  const errores = {};
  const d = {
    nombre: limpiar(form.nombre, 120),
    negocio: limpiar(form.negocio, 120),
    telefono: limpiar(form.telefono, 30),
    correo: limpiar(form.correo, 160),
    ciudad: limpiar(form.ciudad, 80),
    notas: limpiar(form.notas, 4000),
  };
  if (!d.nombre) errores.nombre = "Escribe el nombre del cliente.";
  if (d.correo && !CORREO.test(d.correo)) errores.correo = "Revisa el correo, no parece válido.";
  return { d, errores: Object.keys(errores).length ? errores : null };
}

/* ---------- Respaldo ---------- */

const fecha = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const entero = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

// Convierte un respaldo (del panel o exportado de Railway) en documentos listos para guardar.
export function prepararRespaldo(json) {
  if (!json || json.formato !== "tu-pagina-a-un-clic/respaldo") {
    throw new Error("Este archivo no es un respaldo del panel.");
  }
  const id = (v) => String(v ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const texto = (v) => (v === undefined || v === null || v === "" ? null : String(v));

  const clientes = (json.clientes || [])
    .filter((c) => id(c.id) && c.nombre)
    .map((c) => ({
      id: id(c.id),
      datos: {
        numero: entero(c.numero ?? c.id),
        nombre: String(c.nombre),
        negocio: texto(c.negocio),
        telefono: texto(c.telefono),
        correo: texto(c.correo),
        ciudad: texto(c.ciudad),
        notas: texto(c.notas),
        creado: fecha(c.creado) || new Date(),
        actualizado: fecha(c.actualizado) || fecha(c.creado) || new Date(),
      },
    }));

  const solicitudes = (json.solicitudes || [])
    .filter((s) => id(s.id) && s.nombre)
    .map((s) => {
      const estado = ESTADOS[s.estado] ? s.estado : s.atendida ? "contactada" : "nueva";
      const datos = {
        numero: entero(s.numero ?? s.id),
        nombre: String(s.nombre),
        negocio: texto(s.negocio),
        telefono: texto(s.telefono),
        correo: texto(s.correo),
        tipo: String(s.tipo || "asesoría, todavía no lo tengo claro"),
        mensaje: texto(s.mensaje),
        origen: ORIGENES[s.origen] ? s.origen : "web",
        estado,
        valor: s.valor === null || s.valor === undefined || s.valor === "" ? null : Number(s.valor),
        seguimiento: typeof s.seguimiento === "string" && /^\d{4}-\d{2}-\d{2}/.test(s.seguimiento) ? s.seguimiento.slice(0, 10) : null,
        notas: texto(s.notas),
        cliente_id: s.cliente_id ? id(s.cliente_id) : null,
        creada: fecha(s.creada) || new Date(),
        actualizada: fecha(s.actualizada) || fecha(s.creada) || new Date(),
      };
      const autorizada = fecha(s.autorizacion_datos);
      if (autorizada) datos.autorizacion_datos = autorizada;
      return { id: id(s.id), datos };
    });

  const visitas = (json.visitas || [])
    .filter((v) => v.visitante && v.ruta && fecha(v.creada))
    .map((v) => ({
      id: "v" + id(v.id),
      datos: {
        visitante: String(v.visitante).slice(0, 40),
        ruta: String(v.ruta).slice(0, 121),
        dispositivo: ["celular", "tablet", "computador"].includes(v.dispositivo) ? v.dispositivo : "computador",
        origen: texto(v.origen),
        creada: fecha(v.creada),
      },
    }));

  return { clientes, solicitudes, visitas };
}
