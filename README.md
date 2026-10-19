# Tu Página a un Clic

Página para ofrecer servicios de desarrollo de páginas web, aplicaciones móviles y sistemas a la medida. Tiene dos servicios que comparten la misma base de datos:

- **La página** (raíz del repositorio): sitio público con un backend que guarda las solicitudes del formulario.
- **El panel** (carpeta `panel/`): aplicación privada para registrar solicitudes de WhatsApp o correo, organizar clientes y exportar a Excel. Ver [panel/README.md](panel/README.md).

## Estructura

- `public/`: la página (HTML, CSS, JavaScript e íconos).
- `server/index.js`: servidor Express que sirve la página y la API.
- `server/db.js`: conexión a Postgres y consultas.
- `panel/`: panel de clientes, desplegado como un servicio aparte.
- `railway.json`: configuración de despliegue en Railway.
- `.github/workflows/deploy.yml`: publicación de la versión estática en GitHub Pages.

## Cómo funciona el formulario

Al enviar el formulario, la solicitud se guarda en la base de datos y, si hay número de WhatsApp configurado, se abre WhatsApp con el mensaje listo. Si no hay número, la solicitud solo se guarda y la persona ve una confirmación.

## Contador de visitas

Cada vez que alguien abre la página, `script.js` avisa a `/api/visita`, y mientras la pestaña sigue abierta envía una señal cada 30 segundos a `/api/presencia`. El panel muestra esos datos en vivo.

No se guardan direcciones IP, cookies ni datos personales. Para contar personas distintas se usa una huella anónima que cambia cada día. Los robots de buscadores no se cuentan, y la copia de GitHub Pages no registra visitas.

## Variables de entorno

Ningún dato personal ni contraseña se guarda en el repositorio. Todo se configura como variable de entorno:

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Conexión a Postgres. En Railway se toma del servicio de base de datos. |
| `WHATSAPP_NUMBER` | Número con indicativo de país, solo dígitos (ejemplo: `573001234567`). |
| `CONTACT_EMAIL` | Correo de contacto que se muestra en la página. |
| `DATABASE_SSL` | Opcional. `true` si la base de datos exige SSL (por ejemplo, al usar una URL pública). |

## Desplegar en Railway

1. En Railway crea un proyecto con **Deploy from GitHub repo** y elige este repositorio.
2. En el mismo proyecto agrega una base de datos: **Create > Database > PostgreSQL**.
3. En el servicio de la página, pestaña **Variables**, agrega:
   - `DATABASE_URL` con el valor `${{Postgres.DATABASE_URL}}`
   - `WHATSAPP_NUMBER` y `CONTACT_EMAIL`
4. En **Settings > Networking** pulsa **Generate Domain** para obtener la dirección pública.

La tabla de solicitudes se crea sola la primera vez que arranca el servidor. Railway revisa `/api/salud` para saber si el servicio está en línea.

Para el panel de clientes, sigue los pasos de [panel/README.md](panel/README.md).

## Ver en local

```bash
npm install
DATABASE_URL=postgres://usuario:clave@localhost:5432/basededatos \
npm run dev
```

Abre `http://localhost:3000`. Sin `DATABASE_URL` la página funciona igual, pero las solicitudes no se guardan.

## GitHub Pages

La versión estática se sigue publicando en GitHub Pages en cada cambio a `main`. Usa los secretos `WHATSAPP_NUMBER` y `CONTACT_EMAIL` de **Settings > Secrets and variables > Actions**. En esa versión no hay backend: el formulario solo abre WhatsApp.
