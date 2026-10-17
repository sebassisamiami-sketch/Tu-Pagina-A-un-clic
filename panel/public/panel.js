document.addEventListener("submit", (e) => {
  const mensaje = e.target.getAttribute("data-confirm");
  if (mensaje && !window.confirm(mensaje)) e.preventDefault();
});
