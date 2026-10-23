// Archivos de Excel generados en el navegador (la librería se carga solo al exportar).
import { ORIGENES, ESTADOS } from "./constantes.js";

const EXCELJS = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
const VIOLETA = "FF8052FF";
const BLANCO = "FFFFFFFF";

let cargando = null;
function cargarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!cargando) {
    cargando = new Promise((resolver, rechazar) => {
      const s = document.createElement("script");
      s.src = EXCELJS;
      s.onload = () => resolver(window.ExcelJS);
      s.onerror = () => {
        cargando = null;
        rechazar(new Error("No se pudo cargar la herramienta de Excel. Revisa tu conexión."));
      };
      document.head.appendChild(s);
    });
  }
  return cargando;
}

// Evita que un texto que empiece por =, +, - o @ se interprete como fórmula al abrir el archivo.
function seguro(v) {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function hoja(libro, nombre, columnas, filas) {
  const ws = libro.addWorksheet(nombre, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columnas.map(({ header, key, width, style }) => ({ header, key, width, style }));
  const encabezado = ws.getRow(1);
  encabezado.font = { bold: true, color: { argb: BLANCO } };
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VIOLETA } };
  encabezado.alignment = { vertical: "middle" };
  encabezado.height = 22;
  for (const fila of filas) {
    const limpia = {};
    for (const [k, v] of Object.entries(fila)) limpia[k] = seguro(v);
    ws.addRow(limpia);
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  ws.eachRow((row, n) => {
    if (n > 1) row.alignment = { vertical: "top", wrapText: true };
  });
}

// Excel no guarda zona horaria: se escribe la hora local de Bogotá.
const fechaHoraBogota = (d) => (d ? new Date(new Date(d).getTime() - 5 * 3600 * 1000) : null);
const fechaSola = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);

function descargar(buffer, nombre) {
  const hoy = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${nombre}-${hoy}.xlsx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export async function solicitudesXlsx(filas) {
  const ExcelJS = await cargarExcelJS();
  const libro = new ExcelJS.Workbook();
  libro.creator = "Panel de clientes";
  libro.created = new Date();
  hoja(
    libro,
    "Solicitudes",
    [
      { header: "N.º", key: "numero", width: 7 },
      { header: "Recibida", key: "creada", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
      { header: "Nombre", key: "nombre", width: 24 },
      { header: "Negocio", key: "negocio", width: 22 },
      { header: "Teléfono", key: "telefono", width: 16 },
      { header: "Correo", key: "correo", width: 26 },
      { header: "Llegó por", key: "origen", width: 14 },
      { header: "Necesita", key: "tipo", width: 26 },
      { header: "Estado", key: "estado", width: 12 },
      { header: "Valor cotizado (COP)", key: "valor", width: 18, style: { numFmt: '"$" #,##0' } },
      { header: "Próximo seguimiento", key: "seguimiento", width: 16, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Cliente", key: "cliente", width: 22 },
      { header: "Lo que pidió", key: "mensaje", width: 45 },
      { header: "Notas internas", key: "notas", width: 45 },
    ],
    filas.map((s) => ({
      numero: s.numero ?? null,
      creada: fechaHoraBogota(s.creada),
      nombre: s.nombre,
      negocio: s.negocio,
      telefono: s.telefono,
      correo: s.correo,
      origen: ORIGENES[s.origen] || s.origen,
      tipo: s.tipo,
      estado: ESTADOS[s.estado] || s.estado,
      valor: s.valor === null || s.valor === undefined ? null : Number(s.valor),
      seguimiento: fechaSola(s.seguimiento),
      cliente: s.cliente_nombre,
      mensaje: s.mensaje,
      notas: s.notas,
    }))
  );
  descargar(await libro.xlsx.writeBuffer(), "solicitudes");
}

export async function clientesXlsx(filas) {
  const ExcelJS = await cargarExcelJS();
  const libro = new ExcelJS.Workbook();
  libro.creator = "Panel de clientes";
  libro.created = new Date();
  hoja(
    libro,
    "Clientes",
    [
      { header: "N.º", key: "numero", width: 7 },
      { header: "Nombre", key: "nombre", width: 24 },
      { header: "Negocio", key: "negocio", width: 22 },
      { header: "Teléfono", key: "telefono", width: 16 },
      { header: "Correo", key: "correo", width: 26 },
      { header: "Ciudad", key: "ciudad", width: 16 },
      { header: "Solicitudes", key: "solicitudes", width: 12 },
      { header: "Ganado (COP)", key: "ganado", width: 16, style: { numFmt: '"$" #,##0' } },
      { header: "Última solicitud", key: "ultima", width: 18, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Cliente desde", key: "creado", width: 16, style: { numFmt: "dd/mm/yyyy" } },
      { header: "Notas", key: "notas", width: 45 },
    ],
    filas.map((c) => ({
      numero: c.numero ?? null,
      nombre: c.nombre,
      negocio: c.negocio,
      telefono: c.telefono,
      correo: c.correo,
      ciudad: c.ciudad,
      solicitudes: c.solicitudes,
      ganado: Number(c.ganado) || null,
      ultima: fechaHoraBogota(c.ultima),
      creado: fechaHoraBogota(c.creado),
      notas: c.notas,
    }))
  );
  descargar(await libro.xlsx.writeBuffer(), "clientes");
}
