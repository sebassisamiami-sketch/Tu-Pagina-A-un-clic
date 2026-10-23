# Panel de clientes

App privada para llevar el control de las solicitudes y los clientes. Es una página estática con módulos de JavaScript que trabaja directo sobre Firestore; no tiene servidor propio.

- **Solicitudes**: las que llegan por la página aparecen solas y reciben un número automáticamente. Las de WhatsApp, correo, llamadas o referidos se registran a mano.
- **Seguimiento**: estado (nueva, contactada, cotizada, ganada, perdida), valor cotizado, fecha del próximo seguimiento y notas internas.
- **Clientes**: ficha de cada cliente con sus solicitudes. Se pueden crear a partir de una solicitud con un clic.
- **Visitas en vivo**: personas en la página ahora, visitas y personas distintas de hoy, últimos 7 días, de dónde llegan y desde qué dispositivo.
- **Excel**: descarga de solicitudes (con filtros) y de clientes en `.xlsx`, generada en el navegador.
- **Respaldo**: descarga un `.json` con todo, o importa uno (también el que sale de `scripts/exportar-postgres.js`).

## Acceso

Se entra con Google. Solo puede ver y editar datos la cuenta cuyo ID (UID) tenga un documento en la colección `admins` de Firestore; así lo exigen las reglas de `firestore.rules`. Si entras con una cuenta sin acceso, el panel te muestra su ID para que lo agregues desde la consola de Firebase.

## Archivos

- `index.html`: página base.
- `app.js`: inicio de sesión, conexión con Firestore, navegación y acciones.
- `vistas.js`: plantillas HTML de cada pantalla.
- `datos.js`: resúmenes, filtros, validaciones y lectura de respaldos.
- `excel.js`: archivos de Excel (carga ExcelJS solo al exportar).
- `constantes.js`: estados, orígenes y tipos de solicitud.

## Cuota gratis de Firestore

El plan gratis permite unas 50.000 lecturas y 20.000 escrituras al día. Al abrir el panel se leen las solicitudes, los clientes y las visitas de los últimos 14 días; luego solo se leen los cambios. Con el tráfico de un negocio pequeño queda muy por debajo del límite.
