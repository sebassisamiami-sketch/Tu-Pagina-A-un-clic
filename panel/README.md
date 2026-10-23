# Panel de clientes

Aplicación privada para llevar el control de las solicitudes y los clientes.

- **Solicitudes**: las que llegan por la página aparecen solas. Las de WhatsApp, correo, llamadas o referidos se registran a mano.
- **Seguimiento**: estado (nueva, contactada, cotizada, ganada, perdida), valor cotizado, fecha del próximo seguimiento y notas internas.
- **Clientes**: ficha de cada cliente con sus solicitudes. Se pueden crear a partir de una solicitud con un clic.
- **Visitas en vivo**: personas en la página en este momento, visitas y personas distintas de hoy, últimos 7 días, de dónde llegan y desde qué dispositivo. Se actualiza sola cada 5 segundos.
- **Inicio**: resumen por estado, valor en cotización y ganado, seguimientos vencidos o de la semana.
- **Excel**: descarga de solicitudes (con filtros) y de clientes en `.xlsx`.

## Variables de entorno

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | La misma base de datos de la página. En Firebase va como secreto. |
| `ADMIN_USER` | Usuario para entrar. |
| `ADMIN_PASSWORD` | Contraseña, mínimo 12 caracteres. Sin ella el panel queda desactivado. |
| `SESSION_SECRET` | Opcional. Clave para firmar las sesiones (mínimo 32 caracteres). Si no se define, se deriva de la contraseña. |
| `DATABASE_SSL` | Opcional. `true` si la base de datos exige SSL. |

Cambiar `ADMIN_PASSWORD` cierra todas las sesiones abiertas.

## Desplegar en Railway

1. En el mismo proyecto de la página: **Create > GitHub Repo** y elige este repositorio otra vez.
2. En el nuevo servicio, **Settings > Source > Root Directory**: `/panel`.
3. En **Variables** agrega `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`, `ADMIN_USER` y `ADMIN_PASSWORD`.
4. En **Settings > Networking** pulsa **Generate Domain**.

Al arrancar, el panel completa las tablas que necesita sin tocar los datos existentes.

## Ver en local

```bash
cd panel
npm install
DATABASE_URL=postgres://usuario:clave@localhost:5432/basededatos \
ADMIN_USER=admin ADMIN_PASSWORD=una-clave-larga \
npm run dev
```

Abre `http://localhost:4000`.

## Desplegar en Firebase

El panel se publica junto con la página con `firebase deploy` (ver el README principal). Usuario, contraseña, `SESSION_SECRET` y `DATABASE_URL` van como secretos de Firebase. La sesión usa la cookie `__session`, la única que Firebase Hosting deja pasar.
