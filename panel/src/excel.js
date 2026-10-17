const ExcelJS = require("exceljs");
const { ORIGENES, ESTADOS } = require("./db");

const AZUL = "FF2433D9";
const BLANCO = "FFFFFFFF";

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
  encabezado.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
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
  return ws;
}

const fechaHoraBogota = (d) => {
  if (!d) return null;
  // Excel no guarda zona horaria: se escribe la hora local de Bogotá.
  const t = new Date(d).getTime() - 5 * 60 * 60 * 1000;
  return new Date(t);
};

const fechaSola = (s) => (s ? new Date(`${s}T00:00:00Z`) : null);

async function solicitudesXlsx(filas) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Panel de clientes";
  libro.created = new Date();

  hoja(
    libro,
    "Solicitudes",
    [
      { header: "N.º", key: "id", width: 7 },
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
      id: s.id,
      creada: fechaHoraBogota(s.creada),
      nombre: s.nombre,
      negocio: s.negocio,
      telefono: s.telefono,
      correo: s.correo,
      origen: ORIGENES[s.origen] || s.origen,
      tipo: s.tipo,
      estado: ESTADOS[s.estado] || s.estado,
      valor: s.valor === null ? null : Number(s.valor),
      seguimiento: fechaSola(s.seguimiento),
      cliente: s.cliente_nombre,
      mensaje: s.mensaje,
      notas: s.notas,
    }))
  );

  return libro.xlsx.writeBuffer();
}

async function clientesXlsx(filas) {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Panel de clientes";
  libro.created = new Date();

  hoja(
    libro,
    "Clientes",
    [
      { header: "N.º", key: "id", width: 7 },
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
      id: c.id,
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

  return libro.xlsx.writeBuffer();
}

module.exports = { solicitudesXlsx, clientesXlsx };
