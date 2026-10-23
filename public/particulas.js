/*
 * Constelación de triángulos de fondo, cabecera que se marca al bajar
 * y entrada suave de los bloques. Todo es decorativo: si el script no
 * carga, la página se ve y funciona igual.
 */
(function () {
  "use strict";

  var reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var COLORES = ["#8052FF", "#9873FF", "#FFB829", "#2BB89A", "#E14BD0", "#4B8BFF"];

  /* Cabecera: línea inferior al hacer scroll */
  var top = document.querySelector(".top");
  if (top) {
    var marcar = function () { top.classList.toggle("is-scrolled", window.scrollY > 8); };
    marcar();
    window.addEventListener("scroll", marcar, { passive: true });
  }

  /* Entrada suave de los bloques */
  var bloques = document.querySelectorAll(".reveal");
  if (bloques.length && "IntersectionObserver" in window && !reducido) {
    document.documentElement.classList.add("js-reveal");
    var vigia = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          vigia.unobserve(e.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    bloques.forEach(function (b) { vigia.observe(b); });
  }

  /* Constelación */
  function azar(min, max) { return min + Math.random() * (max - min); }

  // Distribución tipo campana para que el grupo se vea orgánico
  function campana() {
    var u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function Cielo(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.modo = canvas.getAttribute("data-modo") || "ambiente";
    this.puntos = [];
    this.visible = true;
    this.t = 0;
    this.preparar();
  }

  Cielo.prototype.preparar = function () {
    var c = this.canvas;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth;
    var h = c.clientHeight;
    if (!w || !h) return;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w;
    this.h = h;

    var area = w * h;
    var ambiente = Math.round(Math.min(160, area / 9000));
    var grupo = 0;
    var cx = w * 0.72, cy = h * 0.5, rx = w * 0.24, ry = h * 0.36;

    if (this.modo === "grupo") {
      grupo = Math.round(Math.min(1100, area / 1100));
      if (w < 1020) {
        // En pantallas angostas el grupo queda arriba a la derecha, detrás del título
        cx = w * 0.82; cy = h * 0.16; rx = w * 0.32; ry = h * 0.12;
        grupo = Math.round(grupo * 0.55);
      }
    }

    var p = [];
    var i;
    for (i = 0; i < grupo; i++) {
      // Dos lóbulos levemente separados dan una silueta más orgánica
      var lobulo = Math.random() < 0.5 ? -1 : 1;
      var x = cx + lobulo * rx * 0.28 + campana() * rx * 0.55;
      var y = cy + campana() * ry * 0.55;
      p.push(this.crear(x, y, true));
    }
    for (i = 0; i < ambiente; i++) {
      p.push(this.crear(azar(0, w), azar(0, h), false));
    }
    this.puntos = p;
  };

  Cielo.prototype.crear = function (x, y, enGrupo) {
    return {
      x: x,
      y: y,
      tam: enGrupo ? azar(1.6, 4.2) : azar(1.4, 3.2),
      rot: azar(0, Math.PI * 2),
      giro: azar(-0.004, 0.004),
      color: COLORES[(Math.random() * COLORES.length) | 0],
      alfa: enGrupo ? azar(0.55, 1) : azar(0.15, 0.45),
      fase: azar(0, Math.PI * 2),
      vel: azar(0.4, 1.2),
      dx: azar(-0.06, 0.06),
      dy: azar(-0.05, 0.05)
    };
  };

  Cielo.prototype.dibujar = function () {
    var ctx = this.ctx;
    var t = this.t;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.lineWidth = 1;
    ctx.lineJoin = "miter";
    for (var i = 0; i < this.puntos.length; i++) {
      var q = this.puntos[i];
      var brillo = reducido ? q.alfa : q.alfa * (0.65 + 0.35 * Math.sin(t * 0.02 * q.vel + q.fase));
      var r = q.tam;
      ctx.globalAlpha = brillo;
      ctx.strokeStyle = q.color;
      ctx.beginPath();
      for (var k = 0; k < 3; k++) {
        var a = q.rot + k * 2.0944;
        var px = q.x + Math.cos(a) * r;
        var py = q.y + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  Cielo.prototype.mover = function () {
    for (var i = 0; i < this.puntos.length; i++) {
      var q = this.puntos[i];
      q.rot += q.giro;
      q.x += q.dx;
      q.y += q.dy;
      if (q.x < -6) q.x = this.w + 6; else if (q.x > this.w + 6) q.x = -6;
      if (q.y < -6) q.y = this.h + 6; else if (q.y > this.h + 6) q.y = -6;
    }
  };

  var cielos = [];
  document.querySelectorAll("canvas.stars").forEach(function (c) {
    if (!c.getContext) return;
    var cielo = new Cielo(c);
    cielos.push(cielo);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) { cielo.visible = e[0].isIntersecting; }).observe(c);
    }
  });
  if (!cielos.length) return;

  function cuadro() {
    cielos.forEach(function (c) {
      if (!c.visible || !c.w) return;
      c.t++;
      c.mover();
      c.dibujar();
    });
    requestAnimationFrame(cuadro);
  }

  var espera;
  window.addEventListener("resize", function () {
    clearTimeout(espera);
    espera = setTimeout(function () {
      cielos.forEach(function (c) { c.preparar(); if (reducido) c.dibujar(); });
    }, 150);
  });

  if (reducido) {
    cielos.forEach(function (c) { c.dibujar(); });
  } else {
    requestAnimationFrame(cuadro);
  }
})();
