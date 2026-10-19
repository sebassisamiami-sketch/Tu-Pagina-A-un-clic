// "Arma tu página": simulador para que el cliente pruebe tipos de página, colores, estilos y letras.
// No guarda ni envía nada por sí solo: al final pasa la elección al formulario de contacto.
(function () {
  const raiz = document.getElementById("pruebalo");
  if (!raiz) return;

  const $ = (s, el = raiz) => el.querySelector(s);
  const $$ = (s, el = raiz) => Array.from(el.querySelectorAll(s));
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  const sitio = $("#b-site");
  const marco = $(".b-frame");
  const escenario = $(".b-stage");
  const inputNombre = $("#b-nombre");
  const colorLibre = $("#b-color-libre");

  /* ---------- Contenido de ejemplo por tipo de página ---------- */

  const ICONOS = {
    doc: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    team: '<circle cx="9" cy="8" r="3"/><path d="M3.5 19c.7-3 2.8-4.6 5.5-4.6s4.8 1.6 5.5 4.6"/><path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 14.6c1.6.6 2.7 2.1 3 4.4"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shirt: '<path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.7-2 3-4 3S8.5 4.7 8 3z"/>',
    jean: '<path d="M6 3h12l1 18h-5l-2-11-2 11H5z"/>',
    shoe: '<path d="M3 15c0-3 1-7 2-9 2 0 3 2 5 3l3 1c4 1 8 2 8 5v2H3z"/><path d="M3 17h18"/>',
    cap: '<path d="M4 15a8 8 0 0 1 16 0z"/><path d="M12 7v-2M4 15h17l-2 3H6"/>',
    cut: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5 20 18M8.5 15.5 20 6"/>',
    beard: '<path d="M5 6c0 9 3 14 7 14s7-5 7-14"/><path d="M9 13h6"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    plate: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
    cup: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
    cam: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-3h3L15 7"/>',
    cart: '<path d="M3 4h2l2.5 11h11L21 7H6.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    pin: '<path d="M12 21s7-6.3 7-12a7 7 0 0 0-14 0c0 5.7 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  };
  const ico = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONOS[n]}</svg>`;

  const TIPOS = {
    servicios: {
      etiqueta: "Negocio o servicios",
      nombre: "Andina Asesores",
      dominio: "andinaasesores",
      links: ["Servicios", "Nosotros", "Contacto"],
      titulo: "Asesoría contable clara para tu negocio",
      texto: "Impuestos, nómina y facturación electrónica sin enredos.",
      cta: "Agenda una asesoría",
      arte: "doc",
      bloques: (d) => `
        <section class="m-sec">
          <h3 class="m-h">Servicios</h3>
          <div class="m-cards">
            ${[["doc", "Contabilidad", "Tus libros al día, cada mes."], ["team", "Nómina", "Pagos y seguridad social."], ["chart", "Impuestos", "Declaraciones a tiempo."]]
              .map(([i, t, p]) => `<div class="m-card"><span class="m-ic">${ico(i)}</span><b>${t}</b><small>${p}</small></div>`)
              .join("")}
          </div>
        </section>
        <section class="m-sec m-sec--soft">
          <h3 class="m-h">Por qué elegirnos</h3>
          <ul class="m-checks">
            <li>${ico("check")}Atención directa y rápida</li>
            <li>${ico("check")}Precios claros desde el inicio</li>
            <li>${ico("check")}Reportes fáciles de entender</li>
          </ul>
        </section>`,
    },
    restaurante: {
      etiqueta: "Restaurante o café",
      nombre: "Sabor de Casa",
      dominio: "sabordecasa",
      links: ["Menú", "Domicilios", "Ubicación"],
      titulo: "Comida casera, como la de la abuela",
      texto: "Desayunos, almuerzos y domicilios en tu barrio.",
      cta: "Ver el menú",
      arte: "plate",
      bloques: (d) => `
        <section class="m-sec">
          <h3 class="m-h">Menú del día</h3>
          <ul class="m-menu">
            ${[["plate", "Bandeja de la casa", "28.000"], ["plate", "Ajiaco con pollo", "24.000"], ["cup", "Jugo natural", "7.000"], ["cup", "Café de origen", "5.000"]]
              .map(([i, t, p]) => `<li><span class="m-ic">${ico(i)}</span><b>${t}</b><span class="m-dots"></span><em>$${p}</em></li>`)
              .join("")}
          </ul>
          <span class="m-btn m-btn--line">Pedir a domicilio</span>
        </section>`,
    },
    tienda: {
      etiqueta: "Tienda en línea",
      nombre: "Moda Urbana",
      dominio: "modaurbana",
      links: ["Hombre", "Mujer", "Ofertas"],
      titulo: "Nueva colección de temporada",
      texto: "Envíos a toda Colombia. Cambios fáciles.",
      cta: "Comprar ahora",
      arte: "shirt",
      carrito: true,
      bloques: (d) => `
        <section class="m-sec">
          <h3 class="m-h">Lo más vendido</h3>
          <div class="m-products">
            ${[["shirt", "Camiseta básica", "45.000"], ["jean", "Jean clásico", "120.000"], ["shoe", "Tenis blancos", "180.000"], ["cap", "Gorra", "35.000"]]
              .map(([i, t, p]) => `<div class="m-prod"><span class="m-prod__img">${ico(i)}</span><b>${t}</b><em>$${p}</em><span class="m-btn m-btn--sm">Agregar</span></div>`)
              .join("")}
          </div>
        </section>`,
    },
    reservas: {
      etiqueta: "Reservas y citas",
      nombre: "Barbería Estilo",
      dominio: "barberiaestilo",
      links: ["Servicios", "Reservar", "Contacto"],
      titulo: "Tu corte, a la hora que quieras",
      texto: "Reserva en segundos y llega sin hacer fila.",
      cta: "Reservar cita",
      arte: "cut",
      bloques: (d) => `
        <section class="m-sec">
          <h3 class="m-h">Servicios</h3>
          <ul class="m-menu">
            ${[["cut", "Corte clásico", "30 min", "25.000"], ["beard", "Barba", "20 min", "15.000"], ["star", "Corte y barba", "45 min", "35.000"]]
              .map(([i, t, m, p]) => `<li><span class="m-ic">${ico(i)}</span><b>${t}<small>${m}</small></b><span class="m-dots"></span><em>$${p}</em></li>`)
              .join("")}
          </ul>
        </section>
        ${bloqueAgenda()}`,
    },
    portafolio: {
      etiqueta: "Portafolio",
      nombre: "Estudio Lumen",
      dominio: "estudiolumen",
      links: ["Trabajos", "Sobre mí", "Contacto"],
      titulo: "Fotografía para marcas y eventos",
      texto: "Imágenes que cuentan lo que haces.",
      cta: "Ver trabajos",
      arte: "cam",
      bloques: (d) => `
        <section class="m-sec">
          <h3 class="m-h">Trabajos recientes</h3>
          ${bloqueGaleria(6)}
        </section>`,
    },
  };

  function bloqueAgenda() {
    return `
        <section class="m-sec m-sec--soft">
          <h3 class="m-h">Elige tu hora</h3>
          <div class="m-days"><span>Lun 12</span><span class="is-on">Mar 13</span><span>Mié 14</span></div>
          <div class="m-slots">${["9:00", "10:30", "12:00", "2:30", "4:00", "5:30"].map((h, i) => `<span${i === 1 ? ' class="is-on"' : ""}>${h}</span>`).join("")}</div>
          <span class="m-btn">Confirmar reserva</span>
        </section>`;
  }

  function bloqueGaleria(n) {
    return `<div class="m-gallery">${Array.from({ length: n }, (_, i) => `<span class="m-ph m-ph--${i % 3}"></span>`).join("")}</div>`;
  }

  const EXTRAS = {
    whatsapp: "Botón de WhatsApp",
    mapa: "Mapa y ubicación",
    reservas: "Reservas en línea",
    pagos: "Pagos en línea",
    galeria: "Galería de fotos",
  };
  const ESTILOS = { moderno: "Moderno", elegante: "Elegante", llamativo: "Llamativo", oscuro: "Oscuro" };
  const LETRAS = { moderna: "Moderna", elegante: "Elegante", amigable: "Amigable", impactante: "Impactante" };

  /* ---------- Estado ---------- */

  const valor = (name) => ($(`input[name="${name}"]:checked`) || {}).value;

  function estado() {
    const colorInput = $('input[name="b-color"]:checked');
    const libre = colorInput.value === "custom";
    return {
      tipo: valor("b-tipo"),
      color: libre ? colorLibre.value : colorInput.value,
      colorNombre: libre ? "Personalizado" : colorInput.dataset.nombre,
      estilo: valor("b-estilo"),
      letra: valor("b-letra"),
      extras: $$('input[name="b-extra"]:checked').map((i) => i.value),
      nombre: inputNombre.value.trim(),
    };
  }

  // Texto claro u oscuro según qué tan claro es el color elegido.
  function tintaSobre(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return l > 0.4 ? "#15171F" : "#FFFFFF";
  }

  /* ---------- Vista previa ---------- */

  function render() {
    const e = estado();
    const t = TIPOS[e.tipo];
    const nombre = e.nombre || t.nombre;
    const ex = new Set(e.extras);

    sitio.className = `b-site s-${e.estilo} f-${e.letra}`;
    sitio.style.setProperty("--p", e.color);
    sitio.style.setProperty("--p-ink", tintaSobre(e.color));

    const dominio = (e.nombre ? e.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "") : t.dominio) || t.dominio;
    $(".b-url").textContent = `${dominio}.com`;

    const extrasHtml = [
      ex.has("reservas") && e.tipo !== "reservas" ? bloqueAgenda() : "",
      ex.has("galeria") && e.tipo !== "portafolio" ? `<section class="m-sec"><h3 class="m-h">Galería</h3>${bloqueGaleria(6)}</section>` : "",
      ex.has("pagos")
        ? `<section class="m-sec m-pay"><span class="m-ic">${ico("card")}</span><div><b>Paga en línea</b><small>Tarjeta, PSE o transferencia</small></div></section>`
        : "",
      ex.has("mapa")
        ? `<section class="m-sec"><h3 class="m-h">Visítanos</h3><div class="m-map"><i></i><i></i><i></i><span class="m-pin">${ico("pin")}</span></div><small class="m-addr">Calle 00 # 00-00, tu ciudad</small></section>`
        : "",
    ].join("");

    sitio.innerHTML = `
      <header class="m-nav">
        <span class="m-logo"><i>${esc(nombre.charAt(0).toUpperCase())}</i>${esc(nombre)}</span>
        <nav class="m-links">${t.links.map((l) => `<span>${l}</span>`).join("")}${t.carrito ? `<span class="m-cart">${ico("cart")}<b>2</b></span>` : ""}</nav>
        <span class="m-burger"><i></i><i></i><i></i></span>
      </header>
      <section class="m-hero">
        <div class="m-hero__text">
          <small class="m-kicker">${esc(nombre)}</small>
          <h2 class="m-h1">${t.titulo}</h2>
          <p>${t.texto}</p>
          <span class="m-btn">${t.cta}</span>
        </div>
        <div class="m-hero__art"><span class="m-blob"></span><span class="m-art">${ico(t.arte)}</span></div>
      </section>
      ${t.bloques(e)}
      ${extrasHtml}
      <footer class="m-foot"><b>${esc(nombre)}</b><small>© ${new Date().getFullYear()} · Hecha con Tu Página a un Clic</small></footer>
      ${ex.has("whatsapp") ? `<span class="m-wa" aria-hidden="true"><svg viewBox="0 0 32 32"><path fill="currentColor" d="M16 3C9.4 3 4 8.4 4 15c0 2.1.6 4.2 1.6 6L4 29l8.2-2.1c1.2.4 2.5.6 3.8.6 6.6 0 12-5.4 12-12S22.6 3 16 3zm5.5 15.6c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 2.5 1 3 .8 3.6.7.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z"/></svg></span>` : ""}`;

    $("#b-resumen").innerHTML =
      `<b>${esc(nombre)}</b>: ${esc(t.etiqueta)} · color ${esc(e.colorNombre.toLowerCase())} · estilo ${esc(ESTILOS[e.estilo].toLowerCase())} · letra ${esc(LETRAS[e.letra].toLowerCase())}` +
      (e.extras.length ? ` · ${e.extras.map((x) => esc(EXTRAS[x].toLowerCase())).join(", ")}` : "");
  }

  /* ---------- Escala del marco (el computador se ve completo en cualquier pantalla) ---------- */

  function ajustarEscala() {
    const top = document.querySelector(".top");
    if (top) raiz.style.setProperty("--top-h", top.offsetHeight + "px");
    const pc = marco.dataset.dev === "pc";
    const ancho = escenario.clientWidth;
    const base = pc ? 1000 : 320;
    const alto = pc ? 620 : 600;
    let escala = Math.min(1, ancho / base);
    // En pantallas angostas la vista previa queda fija arriba: que no ocupe más de 45% del alto.
    if (window.innerWidth <= 900) escala = Math.min(escala, (window.innerHeight * 0.45) / alto);
    marco.style.width = base + "px";
    marco.style.height = alto + "px";
    marco.style.transform = `translateX(-50%) scale(${escala})`;
    escenario.style.height = Math.round(alto * escala) + "px";
  }

  /* ---------- Pasos ---------- */

  const tabs = $$('.b-tabs [role="tab"]');
  function irA(i) {
    tabs.forEach((t, j) => {
      const activo = i === j;
      t.setAttribute("aria-selected", String(activo));
      t.tabIndex = activo ? 0 : -1;
      $("#" + t.getAttribute("aria-controls")).hidden = !activo;
    });
    $(".b-next").textContent = i === tabs.length - 1 ? "Ver resumen" : "Siguiente paso";
  }
  const pasoActual = () => tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => irA(i));
    t.addEventListener("keydown", (ev) => {
      if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
      ev.preventDefault();
      const n = (i + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      irA(n);
      tabs[n].focus();
    });
  });

  $(".b-next").addEventListener("click", () => {
    const i = pasoActual();
    if (i < tabs.length - 1) irA(i + 1);
    else $(".b-summary").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  $(".b-reset").addEventListener("click", () => {
    $$(".builder__panel input[type=radio]").forEach((r) => (r.checked = r.defaultChecked));
    $$(".builder__panel input[type=checkbox]").forEach((c) => (c.checked = c.defaultChecked));
    inputNombre.value = "";
    irA(0);
    render();
  });

  /* ---------- Dispositivo ---------- */

  const botonesDev = $$(".b-devices button");
  botonesDev.forEach((b) =>
    b.addEventListener("click", () => {
      botonesDev.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
      marco.dataset.dev = b.dataset.dev;
      ajustarEscala();
    })
  );

  /* ---------- Cambios ---------- */

  raiz.addEventListener("change", (ev) => {
    if (ev.target.name === "b-letra") cargarLetras();
    render();
  });
  inputNombre.addEventListener("input", render);
  colorLibre.addEventListener("input", () => {
    $('input[name="b-color"][value="custom"]').checked = true;
    render();
  });

  /* ---------- Llevar la elección al formulario ---------- */

  $(".b-cta").addEventListener("click", () => {
    const e = estado();
    const t = TIPOS[e.tipo];
    const form = document.querySelector(".form");
    if (!form) return;
    const resumen = [
      "Armé mi página en el simulador:",
      `- Tipo: ${t.etiqueta}`,
      `- Color: ${e.colorNombre} (${e.color.toUpperCase()})`,
      `- Estilo: ${ESTILOS[e.estilo]}`,
      `- Letra: ${LETRAS[e.letra]}`,
      e.extras.length ? `- Extras: ${e.extras.map((x) => EXTRAS[x]).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const mensaje = form.mensaje;
    const previo = mensaje.value.split("Armé mi página en el simulador:")[0].trim();
    mensaje.value = previo ? `${previo}\n\n${resumen}` : resumen;
    if (e.nombre && !form.negocio.value.trim()) form.negocio.value = e.nombre;
    const radio = form.querySelector('input[name="tipo"][value="una página web"]');
    if (radio) radio.checked = true;
    setTimeout(() => (form.nombre.value ? mensaje : form.nombre).focus({ preventScroll: true }), 600);
  });

  /* ---------- Letras extra: se cargan solo cuando hacen falta ---------- */

  let letrasCargadas = false;
  function cargarLetras() {
    if (letrasCargadas) return;
    letrasCargadas = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&family=Playfair+Display:wght@600;700&display=swap";
    document.head.appendChild(link);
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((ent) => {
      if (ent.some((x) => x.isIntersecting)) {
        io.disconnect();
        cargarLetras();
      }
    }, { rootMargin: "400px" });
    io.observe(raiz);
  } else {
    cargarLetras();
  }

  if (window.ResizeObserver) new ResizeObserver(ajustarEscala).observe(escenario);
  window.addEventListener("resize", ajustarEscala);
  render();
  ajustarEscala();
})();
