// Los datos de contacto no se guardan en el repositorio.
// Al publicar, el flujo de GitHub Actions reemplaza estos marcadores con los
// secretos WHATSAPP_NUMBER y CONTACT_EMAIL configurados en el repositorio.
const CONFIG = {
  WHATSAPP_NUMBER: "__WHATSAPP_NUMBER__",
  EMAIL: "__CONTACT_EMAIL__",
};

const isSet = (value) => Boolean(value) && !value.startsWith("__");

(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      emailLink.closest("p").hidden = true;
    }
  }

  /* Demo: cambio de dispositivo */
  const device = document.querySelector(".device");
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
      setTimeout(publish, reduceMotion ? 0 : 650);
    } else {
      publish();
    }
  });

  /* Demo: el cursor hace el primer clic por ti */
  const cursor = document.querySelector(".cursor");
  const stage = document.querySelector(".demo__stage");

  function playIntro() {
    if (published) return;
    if (reduceMotion || !cursor.animate) {
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

  if ("IntersectionObserver" in window) {
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

  /* Formulario: guarda la solicitud y abre WhatsApp con el mensaje armado */
  const form = document.querySelector(".form");
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

    const guardado = guardarSolicitud(datos);

    if (hasWhatsApp) {
      let texto = `Hola, soy ${datos.nombre}`;
      if (datos.negocio) texto += ` de ${datos.negocio}`;
      texto += `. Me interesa ${datos.tipo}.`;
      if (datos.mensaje) texto += `\n\n${datos.mensaje}`;
      window.open(`https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
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
