document.addEventListener("submit", (e) => {
  const mensaje = e.target.getAttribute("data-confirm");
  if (mensaje && !window.confirm(mensaje)) e.preventDefault();
});

/* Visitas en vivo: se actualizan cada 5 segundos mientras el panel está visible */
(function () {
  const caja = document.getElementById("visitas");
  if (!caja) return;
  const estado = document.getElementById("visitas-estado");
  let ocupado = false;

  async function actualizar() {
    if (ocupado || document.visibilityState !== "visible") return;
    ocupado = true;
    try {
      const r = await fetch(caja.dataset.live, { headers: { Accept: "application/json" }, cache: "no-store" });
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error("sesion");
      const datos = await r.json();
      const antes = {};
      caja.querySelectorAll("[data-n]").forEach((el, i) => (antes[i] = el.dataset.n));
      caja.innerHTML = datos.html;
      caja.querySelectorAll("[data-n]").forEach((el, i) => {
        if (antes[i] !== undefined && antes[i] !== el.dataset.n) {
          el.classList.add("is-new");
          setTimeout(() => el.classList.remove("is-new"), 1200);
        }
      });
      estado.classList.remove("is-off");
      estado.lastChild.textContent = "En vivo";
    } catch (_) {
      estado.classList.add("is-off");
      estado.lastChild.textContent = "Sin conexión, reintentando…";
    } finally {
      ocupado = false;
    }
  }

  setInterval(actualizar, 5000);
  document.addEventListener("visibilitychange", actualizar);
})();
