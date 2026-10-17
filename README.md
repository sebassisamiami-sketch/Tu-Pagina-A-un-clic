# Tu Página a un Clic

Landing page para ofrecer servicios de desarrollo de páginas web, aplicaciones móviles y sistemas a la medida.

Es un sitio estático (HTML, CSS y JavaScript), sin dependencias ni proceso de compilación.

## Estructura

- `index.html`: contenido de la página.
- `styles.css`: estilos.
- `script.js`: demo interactiva del inicio y formulario de contacto por WhatsApp.
- `assets/favicon.svg`: ícono de la pestaña.

## Datos de contacto

El número de WhatsApp y el correo **no se guardan en el repositorio**. Se configuran como secretos y se insertan solo al publicar.

En **Settings > Secrets and variables > Actions > New repository secret** crea:

| Nombre | Valor |
| --- | --- |
| `WHATSAPP_NUMBER` | Número con indicativo de país, solo dígitos (ejemplo: `573001234567`) |
| `CONTACT_EMAIL` | Correo de contacto |

Si falta alguno, la página se publica igual: el enlace de correo se oculta y el formulario avisa que WhatsApp no está disponible.

## Ver en local

Abre `index.html` en el navegador, o sirve la carpeta:

```bash
python3 -m http.server 8000
```

En local el contacto aparece sin configurar, porque los datos solo existen en los secretos.

## Publicar en GitHub Pages

1. En **Settings > Pages**, en **Source** elige **GitHub Actions**.
2. Cada vez que se sube un cambio a `main`, el flujo `.github/workflows/deploy.yml` publica el sitio con los datos de contacto.
3. La página queda disponible en `https://<usuario>.github.io/<repositorio>/`.
