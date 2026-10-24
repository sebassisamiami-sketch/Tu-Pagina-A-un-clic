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

## Galería de estilos y ficha del diseño

`public/estilos/` tiene 30 muestras de diseño con negocios inventados. El botón "Quiero este estilo" lleva al formulario con el estilo ya elegido: la solicitud guarda el campo `estilo` y el mensaje de WhatsApp incluye un enlace a la **ficha del diseño** (`/estilos/prompt/`). La ficha arma un prompt con los datos del cliente y todo el código del estilo, listo para copiar y pegar en un asistente de IA. Los datos viajan en el fragmento del enlace (`#...`), así que no llegan a ningún servidor. En el panel, cada solicitud con estilo tiene el botón "Abrir prompt completo".

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

### Fotos de las muestras

Las fotos de `public/estilos/fotos/` son de [Unsplash](https://unsplash.com/license) (licencia gratuita, uso comercial permitido, sin atribución obligatoria). IDs de origen: 1570793005386-840846445fed, 1595521624992-48a59aef95e3, 1568729937315-2ef5ee9cf4f2, 1703782997454-8eb0d4d94e9c, 1593053272490-e0ed6d6a42c5, 1641569618527-68e26db76db0, 1721886473357-1563de6e6883, 1624254495476-db6cc8b77e98, 1610970878459-a0e464d7592b, 1600688640154-9619e002df30, 1549611016-3a70d82b5040, 1616671285410-2a676a9a433d, 1689672235271-727de51355e6, 1514326640560-7d063ef2aed5, 1713950920412-97799efdf870, 1620656798579-1984d9e87df7, 1783541507490-edb026e2a961, 1631972234521-24e9d4fbb841, 1546435770-a3e426bf472b, 1613082852603-f4f1187885ea, 1529047033375-f402d3da24ca, 1525268771113-32d9e9021a97, 1567304441104-d7a7d3e4bc1b, 1486649567693-aaa9b2e59385, 1669801158950-f663cf15298c, 1767808569406-cfcf06dcb441, 1570410070243-b86939615984, 1526835746352-0b9da4054862 (en https://unsplash.com/photos/ID). `paisaje`, `arte-1` y `arte-2` son ilustraciones generadas por código.
Fotos agregadas después (también de Unsplash): 1651761483492-7d2e26dd3455, 1643569556871-91ec60671ed7, 1660695828417-9cc2724bf656, 1612293905607-b003de9e54fb, 1781344116880-029945a42b75, 1659520709425-31b547254b59, 1631125915902-d8abe9225ff2, 1781346325200-61cef7b29d76, 1700405495207-3f87da07c1c7, 1703593191680-03d4faa034b3, 1774013655447-0c95a010baa5, 1632053049547-a21a261b66e1, 1658819543328-59b114859eaf, 1700407413528-5814c40b3ad6.
