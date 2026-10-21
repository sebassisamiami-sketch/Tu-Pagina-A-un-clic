// Los datos de contacto no se guardan en el repositorio.
// Al publicar, el flujo de GitHub Actions reemplaza estos marcadores con los
// secretos WHATSAPP_NUMBER y CONTACT_EMAIL configurados en el repositorio.
const CONFIG = {
  WHATSAPP_NUMBER: "__WHATSAPP_NUMBER__",
  EMAIL: "__CONTACT_EMAIL__",
};

const isSet = (value) => Boolean(value) && !value.startsWith("__");
const BASE = new URL(".", document.currentScript ? document.currentScript.src : location.href);

(function () {
  /* Año del pie */
  const year = document.querySelector(".js-year");
  if (year) year.textContent = new Date().getFullYear();

  /* Correo */
  const emailLink = document.querySelector(".js-email");
  if (emailLink) {
    if (isSet(CONFIG.EMAIL)) {
      emailLink.href = "mailto:" + CONFIG.EMAIL;
      emailLink.textContent = CONFIG.EMAIL;
    } else {
      (emailLink.closest("li") || emailLink.closest("p")).hidden = true;
    }
  }

  /* Botón flotante de WhatsApp (en todas las páginas) */
  if (isSet(CONFIG.WHATSAPP_NUMBER)) {
    const saludo = document.body.dataset.waMensaje ||
      "¡Hola! Vi tu página *Tu Página a un Clic* y quiero información sobre una página web o una app.";
    const fab = document.createElement("a");
    fab.className = "wa-fab";
    fab.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(saludo)}`;
    fab.target = "_blank";
    fab.rel = "noopener";
    fab.setAttribute("aria-label", "Escríbeme por WhatsApp");
    fab.innerHTML =
      '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16.04 3C9.4 3 4 8.36 4 14.97c0 2.12.56 4.18 1.62 6L4 29l8.25-2.15a12.1 12.1 0 0 0 3.79.61h.01C22.67 27.46 28 22.1 28 15.5 28 8.9 22.67 3 16.04 3Zm0 22.4h-.01a10 10 0 0 1-5.1-1.4l-.37-.21-4.9 1.27 1.3-4.75-.24-.39a9.84 9.84 0 0 1-1.52-5.25c0-5.47 4.47-9.92 9.96-9.92 5.48 0 9.95 4.88 9.95 10.35 0 5.48-4.47 10.3-9.07 10.3Zm5.46-7.42c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47a8.97 8.97 0 0 1-1.66-2.06c-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.07 2.88 1.21 3.08.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35Z"/></svg>' +
      '<span>Escríbeme</span>';
    document.body.appendChild(fab);
  }

   /* Estadísticas: solo si la persona aceptó. Activa Google Analytics y el contador propio.
     El contador propio no corre en la copia de GitHub Pages. */
  let estadisticasActivas = false;
  function iniciarEstadisticas() {
    if (typeof gtag === "function") gtag('consent', 'update', { analytics_storage: 'granted' });
    if (estadisticasActivas || /github\.io$/.test(location.hostname) || location.protocol !== "https:") return;
    estadisticasActivas = true;
    const enviar = (url, datos) =>
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datos), keepalive: true }).catch(() => {});
    const ruta = location.pathname;
    enviar("/api/visita", { ruta, ref: document.referrer });
    // Mientras la pestaña esté abierta y visible, avisa que la persona sigue en la página.
    setInterval(() => {
      if (document.visibilityState === "visible") enviar("/api/presencia", { ruta });
    }, 30000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") enviar("/api/presencia", { ruta });
    });
  }

  /* Aviso de cookies y consentimiento */
  const COOKIE = "tpc_consentimiento";
  const VERSION = "1";

  function leerConsentimiento() {
    const m = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    if (!m) return null;
    const [version, estadisticas] = decodeURIComponent(m[1]).split(".");
    if (version !== VERSION) return null;
    return { estadisticas: estadisticas === "1" };
  }

  function guardarConsentimiento(c) {
    const valor = `${VERSION}.${c.estadisticas ? 1 : 0}`;
    const seguro = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE}=${valor}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax${seguro}`;
  }

  let aviso = null;
  function cerrarAviso() {
    if (!aviso) return;
    aviso.remove();
    aviso = null;
    document.body.classList.remove("has-cookies");
  }

  function decidir(c) {
    guardarConsentimiento(c);
    cerrarAviso();
    if (c.estadisticas) iniciarEstadisticas();
    else if (estadisticasActivas) location.reload(); // detiene el contador si lo rechaza después
  }

  function mostrarAviso(configurar) {
    cerrarAviso();
    const actual = leerConsentimiento();
    const privacidad = new URL("politica-de-privacidad/", BASE).href;
    const cookies = new URL("politica-de-cookies/", BASE).href;
    aviso = document.createElement("section");
    aviso.className = "cookies";
    aviso.setAttribute("role", "dialog");
    aviso.setAttribute("aria-labelledby", "cookies-titulo");
    aviso.innerHTML = `
      <h2 id="cookies-titulo">Tu privacidad</h2>
      <p>Usamos una cookie para recordar tu elección y, si nos lo permites, contamos las visitas de forma anónima para mejorar la página. No usamos cookies de publicidad. Lee la <a href="${cookies}">política de cookies</a> y la <a href="${privacidad}">de datos personales</a>.</p>
      <div class="cookies__opts" hidden>
        <label class="cookies__opt"><input type="checkbox" checked disabled><span><b>Necesarias</b><small>Guardan tu elección. Siempre activas.</small></span></label>
        <label class="cookies__opt"><input type="checkbox" class="js-stats"${!actual || actual.estadisticas ? " checked" : ""}><span><b>Estadísticas</b><small>Cuentan visitas sin identificarte, para saber qué secciones sirven.</small></span></label>
      </div>
      <div class="cookies__actions">
        <button type="button" class="btn btn--mango js-aceptar">Aceptar todas</button>
        <button type="button" class="btn cookies__btn-sec js-necesarias">Solo necesarias</button>
      </div>
      <button type="button" class="cookies__link js-configurar">Configurar</button>`;
    document.body.appendChild(aviso);
    document.body.classList.add("has-cookies");

    const opciones = aviso.querySelector(".cookies__opts");
    const btnConfig = aviso.querySelector(".js-configurar");
    const abrirOpciones = () => {
      opciones.hidden = false;
      btnConfig.textContent = "Guardar mi elección";
      btnConfig.classList.add("is-save");
    };
    if (configurar) abrirOpciones();

    aviso.querySelector(".js-aceptar").addEventListener("click", () => decidir({ estadisticas: true }));
    aviso.querySelector(".js-necesarias").addEventListener("click", () => decidir({ estadisticas: false }));
    btnConfig.addEventListener("click", () => {
      if (!btnConfig.classList.contains("is-save")) return abrirOpciones();
      decidir({ estadisticas: aviso.querySelector(".js-stats").checked });
    });

    const medir = () => document.body.style.setProperty("--cookies-h", aviso ? aviso.offsetHeight + "px" : "0px");
    medir();
    if (window.ResizeObserver) new ResizeObserver(medir).observe(aviso);
  }

  document.querySelectorAll(".js-cookies").forEach((b) => b.addEventListener("click", () => mostrarAviso(true)));

  const consentimiento = leerConsentimiento();
  if (!consentimiento) mostrarAviso(false);
  else if (consentimiento.estadisticas) iniciarEstadisticas();

  /* Enlaces de WhatsApp dentro del texto (políticas) */
  if (isSet(CONFIG.WHATSAPP_NUMBER)) {
    document.querySelectorAll(".js-whatsapp").forEach((a) => {
      a.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "+" + CONFIG.WHATSAPP_NUMBER;
    });
  }

  /* Demo: cambio de dispositivo */
  const device = document.querySelector(".device");
  if (device) {
  const switchButtons = document.querySelectorAll(".demo__switch button");

  function setMode(button) {
    switchButtons.forEach((b) => {
      const active = b === button;
      b.setAttribute("aria-checked", String(active));
      b.tabIndex = active ? 0 : -1;
    });
    device.dataset.mode = button.dataset.mode;
  }

  switchButtons.forEach((button, i) => {
    button.tabIndex = i === 0 ? 0 : -1;
    button.addEventListener("click", () => setMode(button));
    button.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const step = e.key === "ArrowRight" ? 1 : -1;
      const next = switchButtons[(i + step + switchButtons.length) % switchButtons.length];
      setMode(next);
      next.focus();
    });
  });

  /* Demo: publicar la página de ejemplo */
  const mini = document.querySelector(".mini");
  const publishBtn = document.querySelector(".demo__publish");
  const LABEL_IDLE = "Publicar página";
  const LABEL_DONE = "Página publicada. Repetir";
  let published = false;

  function publish() {
    published = true;
    mini.classList.remove("is-wire");
    publishBtn.classList.add("is-done");
    publishBtn.textContent = LABEL_DONE;
  }

  function reset() {
    published = false;
    mini.classList.add("is-wire");
    publishBtn.classList.remove("is-done");
    publishBtn.textContent = LABEL_IDLE;
  }

  publishBtn.addEventListener("click", () => {
    if (published) {
      reset();
      setTimeout(publish, 650);
    } else {
      publish();
    }
  });

  /* Demo: el cursor hace el primer clic por ti */
  const cursor = document.querySelector(".cursor");
  const stage = document.querySelector(".demo__stage");

  function playIntro() {
    if (published) return;
    // La demostración se anima siempre, aunque el equipo tenga reducidas las animaciones.
    if (!cursor.animate) {
      publish();
      return;
    }

    const s = stage.getBoundingClientRect();
    const b = publishBtn.getBoundingClientRect();
    const startX = s.width - 30;
    const startY = s.height * 0.55;
    const endX = b.left - s.left + b.width * 0.62;
    const endY = b.top - s.top + b.height * 0.45;

    const move = cursor.animate(
      [
        { transform: `translate(${startX}px, ${startY}px)`, opacity: 0 },
        { transform: `translate(${startX}px, ${startY}px)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${endX}px, ${endY}px)`, opacity: 1 },
      ],
      { duration: 1300, easing: "cubic-bezier(.5, 0, .2, 1)", fill: "forwards" }
    );

    move.onfinish = () => {
      publishBtn.classList.add("is-pressed");
      setTimeout(() => {
        publishBtn.classList.remove("is-pressed");
        publish();
        cursor.animate(
          [
            { transform: `translate(${endX}px, ${endY}px)`, opacity: 1 },
            { transform: `translate(${endX + 14}px, ${endY + 20}px)`, opacity: 0 },
          ],
          { duration: 700, delay: 500, easing: "ease-in", fill: "forwards" }
        );
      }, 160);
    };
  }

  if (!stage) {
    // Página sin demo
  } else if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          setTimeout(playIntro, 600);
        }
      },
      { threshold: 0.6 }
    );
    io.observe(stage);
  } else {
    publish();
  }
  }

  /* Formulario: guarda la solicitud y abre WhatsApp con el mensaje armado */
  const form = document.querySelector(".form");
  if (!form) return;
  const errorBox = form.querySelector(".form__error");
  const okBox = form.querySelector(".form__ok");
  const submitBtn = form.querySelector("button[type=submit]");
  const hasWhatsApp = isSet(CONFIG.WHATSAPP_NUMBER);
  const LABEL_SUBMIT = hasWhatsApp ? "Enviar por WhatsApp" : "Enviar solicitud";
  submitBtn.textContent = LABEL_SUBMIT;

  function showError(text, field) {
    okBox.hidden = true;
    errorBox.textContent = text;
    errorBox.hidden = false;
    if (field) {
      field.setAttribute("aria-invalid", "true");
      field.focus();
    }
  }

  function showOk(text) {
    errorBox.hidden = true;
    okBox.textContent = text;
    okBox.hidden = false;
  }

  function guardarSolicitud(datos) {
    return fetch("/api/solicitudes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
      keepalive: true,
    })
      .then((r) => r.json().catch(() => ({})).then((body) => ({ ok: r.ok, error: body.error })))
      .catch(() => ({ ok: false }));
  }

  // Mensaje ordenado para WhatsApp (*texto* se ve en negrita).
  const NECESIDADES = {
    "una página web": "Una página web",
    "una aplicación móvil": "Una aplicación móvil",
    "una página web y una app": "Una página web y una app",
    "un sistema a la medida": "Un sistema a la medida",
    "asesoría, todavía no lo tengo claro": "Asesoría, todavía no tengo claro qué necesito",
  };

  function mensajeWhatsApp({ nombre, negocio, tipo, mensaje }) {
    const lineas = [
      "¡Hola! Vi tu página *Tu Página a un Clic* y me gustaría cotizar un proyecto.",
      "",
      `*Nombre:* ${nombre}`,
    ];
    if (negocio) lineas.push(`*Negocio:* ${negocio}`);
    lineas.push(`*Necesito:* ${NECESIDADES[tipo] || tipo}`);
    if (mensaje) lineas.push("", "*Detalles:*", mensaje);
    lineas.push("", "¿Me cuentas cómo trabajas y qué opciones tengo? ¡Gracias!");
    return lineas.join("\n");
  }

  form.autoriza.addEventListener("change", () => {
    if (form.autoriza.checked) {
      form.autoriza.closest(".consent").classList.remove("is-invalid");
      form.autoriza.removeAttribute("aria-invalid");
      errorBox.hidden = true;
    }
  });

  form.addEventListener("input", (e) => {
    if (e.target.getAttribute("aria-invalid") === "true" && e.target.value.trim()) {
      e.target.removeAttribute("aria-invalid");
      errorBox.hidden = true;
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    okBox.hidden = true;

    const datos = {
      nombre: form.nombre.value.trim(),
      negocio: form.negocio.value.trim(),
      tipo: form.tipo.value,
      mensaje: form.mensaje.value.trim(),
      sitio: form.sitio.value,
    };

    if (!datos.nombre) {
      showError("Escribe tu nombre para poder responderte.", form.nombre);
      return;
    }

    if (!form.autoriza.checked) {
      form.autoriza.closest(".consent").classList.add("is-invalid");
      showError("Para enviar tu solicitud, marca la casilla de autorización de datos.", form.autoriza);
      return;
    }
    datos.autoriza = true;

    const guardado = guardarSolicitud(datos);

    if (hasWhatsApp) {
      window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(mensajeWhatsApp(datos))}`, "_blank", "noopener");
      showOk("Se abrió WhatsApp con tu mensaje. Solo falta que lo envíes.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando solicitud…";
    guardado.then((res) => {
      submitBtn.disabled = false;
      submitBtn.textContent = LABEL_SUBMIT;
      if (res.ok) {
        form.reset();
        showOk("Solicitud enviada. Te contactaré pronto.");
      } else {
        showError(res.error || "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.");
      }
    });
  });
})();
