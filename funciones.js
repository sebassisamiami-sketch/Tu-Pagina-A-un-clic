// Punto de entrada para Firebase Functions: la API de la página, script.js y la política de privacidad.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// Se guarda en Secret Manager, nunca en el repositorio: firebase functions:secrets:set DATABASE_URL
const DATABASE_URL = defineSecret("DATABASE_URL");

let app;

exports.pagina = onRequest(
  { region: "us-east1", secrets: [DATABASE_URL], memory: "256MiB", maxInstances: 5, concurrency: 40 },
  (req, res) => {
    // Se carga aquí, ya con las variables y secretos disponibles.
    app = app || require("./server/app");
    return app(req, res);
  }
);
