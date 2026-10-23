# Tu Página a un Clic

Página para ofrecer servicios de desarrollo de páginas web, aplicaciones móviles y sistemas a la medida. Todo corre en **Firebase con el plan gratis (Spark)**, sin servidor propio:

- **La página** (`public/`): Firebase Hosting. El formulario y el contador de visitas guardan directo en Firestore.
- **El panel** (`panel/public/`): app privada en su propio sitio de Hosting, con inicio de sesión de Google. Ver [panel/README.md](panel/README.md).
- **Firestore**: base de datos. `firestore.rules` solo deja que los visitantes creen solicitudes y visitas con datos válidos; leer y editar es solo para el administrador.

## Estructura

- `public/`: la página (HTML, CSS, JavaScript e íconos). `public/builder.js` es el simulador "Arma tu página" y `public/particulas.js` dibuja la constelación de fondo.
- `panel/public/`: el panel de clientes (HTML y módulos de JavaScript, sin compilación).
- `firestore.rules`: reglas de seguridad de la base de datos.
- `firebase.json` y `.firebaserc`: configuración de Firebase (dos sitios de Hosting: `pagina` y `panel`).
- `scripts/construir.js`: arma la carpeta `dist/` que se publica, insertando los datos de contacto desde `.env`.
- `scripts/exportar-postgres.js`: exporta los datos de la base Postgres anterior a `respaldo.json`.
- `.github/workflows/deploy.yml`: publicación de una copia estática en GitHub Pages (esa copia no guarda solicitudes).

## Cómo funciona el formulario

Al enviar el formulario se abre WhatsApp con el mensaje listo y, al mismo tiempo, la solicitud se guarda en Firestore (colección `solicitudes`). La configuración de Firebase la entrega Hosting en `/__/firebase/init.json`, así que no hay claves en el repositorio.

## Contador de visitas

Si la persona aceptó las estadísticas en el aviso de cookies, la página registra la visita en Firestore (`visitas`) y, mientras la pestaña está abierta, avisa cada minuto que sigue ahí (`presencia`). No se guardan IP ni datos personales: para contar personas distintas se usa un identificador aleatorio que cambia cada día. La copia de GitHub Pages no registra visitas.

## Cookies y políticas

Al entrar por primera vez aparece un aviso para aceptar o rechazar las estadísticas. La elección se guarda en la cookie `tpc_consentimiento` por 12 meses y se puede cambiar desde "Configurar cookies" en el pie de página.

Páginas legales: `politica-de-privacidad/` (Ley 1581 de 2012), `politica-de-cookies/` y `terminos/`. El formulario exige marcar la autorización de tratamiento de datos, y la fecha de esa autorización se guarda con cada solicitud.

## Datos de contacto

Ningún dato personal se guarda en el repositorio. Copia `.env.example` como `.env` (no se sube a GitHub) y llénalo:

| Variable | Para qué sirve |
| --- | --- |
| `WHATSAPP_NUMBER` | Número con indicativo de país, solo dígitos (ejemplo: `573001234567`). |
| `CONTACT_EMAIL` | Correo de contacto que se muestra en la página. |
| `RESPONSABLE_DATOS` | Nombre del responsable en la política de privacidad. |

## Publicar en Firebase (plan gratis)

Primera vez, en la consola de Firebase del proyecto `tu-pagina-a-un-clic`:

1. **Firestore Database → Crear base de datos**, en modo producción.
2. **Authentication → Comenzar → Google**: actívalo.
3. **Authentication → Configuración → Dominios autorizados**: agrega `tu-pagina-a-un-clic-panel.web.app`.

En la terminal, desde esta carpeta:

```bash
npm install -g firebase-tools
firebase login
firebase deploy
```

`firebase deploy` arma `dist/`, publica la página y el panel, y sube las reglas de Firestore.

Después, entra al panel con tu cuenta de Google. La primera vez te mostrará tu ID: créale un documento con ese ID en la colección `admins` de Firestore (desde la consola) y recarga.

### Pasar los datos de la base anterior

```bash
npm install
ORIGEN_URL="postgres://...URL pública de la base anterior..." npm run exportar-datos
```

En PowerShell: `$env:ORIGEN_URL="postgres://..."` y luego `npm run exportar-datos`. Se crea `respaldo.json`; impórtalo en el panel, en **Respaldo → Importar**. Importar dos veces no duplica nada.
