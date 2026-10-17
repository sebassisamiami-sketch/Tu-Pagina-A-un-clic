# Tu Página a un Clic

Página para ofrecer servicios de desarrollo de páginas web, aplicaciones móviles y sistemas a la medida. Incluye un backend que guarda las solicitudes del formulario de contacto y un panel privado para revisarlas.

## Estructura

- `public/`: la página (HTML, CSS, JavaScript e íconos).
- `server/index.js`: servidor Express que sirve la página y la API.
- `server/db.js`: conexión a Postgres y consultas.
- `server/admin.js`: panel privado de solicitudes en `/admin`.
- `railway.json`: configuración de despliegue en Railway.
- `.github/workflows/deploy.yml`: publicación de la versión estática en GitHub Pages.

## Cómo funciona el formulario

Al enviar el formulario, la solicitud se guarda en la base de datos y, si hay número de WhatsApp configurado, se abre WhatsApp con el mensaje listo. Si no hay número, la solicitud solo se guarda y la persona ve una confirmación.

## Variables de entorno

Ningún dato personal ni contraseña se guarda en el repositorio. Todo se configura como variable de entorno:

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Conexión a Postgres. En Railway se toma del servicio de base de datos. |
| `WHATSAPP_NUMBER` | Número con indicativo de país, solo dígitos (ejemplo: `573001234567`). |
| `CONTACT_EMAIL` | Correo de contacto que se muestra en la página. |
| `ADMIN_USER` | Usuario para entrar al panel. |
| `ADMIN_PASSWORD` | Contraseña del panel, mínimo 12 caracteres. Sin ella el panel queda desactivado. |
| `DATABASE_SSL` | Opcional. `true` si la base de datos exige SSL (por ejemplo, al usar una URL pública). |

## Desplegar en Railway

1. En Railway crea un proyecto con **Deploy from GitHub repo** y elige este repositorio.
2. En el mismo proyecto agrega una base de datos: **Create > Database > PostgreSQL**.
3. En el servicio de la página, pestaña **Variables**, agrega:
   - `DATABASE_URL` con el valor `${{Postgres.DATABASE_URL}}`
   - `WHATSAPP_NUMBER`, `CONTACT_EMAIL`, `ADMIN_USER` y `ADMIN_PASSWORD`
4. En **Settings > Networking** pulsa **Generate Domain** para obtener la dirección pública.

La tabla de solicitudes se crea sola la primera vez que arranca el servidor. Railway revisa `/api/salud` para saber si el servicio está en línea.

El panel queda en `https://<tu-dominio>/admin` y pide el usuario y la contraseña configurados. Desde ahí puedes marcar solicitudes como atendidas y descargarlas en CSV.

## Ver en local

```bash
npm install
DATABASE_URL=postgres://usuario:clave@localhost:5432/basededatos \
ADMIN_USER=admin ADMIN_PASSWORD=una-clave-larga \
npm run dev
```

Abre `http://localhost:3000`. Sin `DATABASE_URL` la página funciona igual, pero las solicitudes no se guardan.

## GitHub Pages

La versión estática se sigue publicando en GitHub Pages en cada cambio a `main`. Usa los secretos `WHATSAPP_NUMBER` y `CONTACT_EMAIL` de **Settings > Secrets and variables > Actions**. En esa versión no hay backend: el formulario solo abre WhatsApp.
