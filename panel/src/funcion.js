// Punto de entrada del panel para Firebase Functions.
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

// Se guardan en Secret Manager, nunca en el repositorio.
const secretos = ["DATABASE_URL", "ADMIN_USER", "ADMIN_PASSWORD", "SESSION_SECRET"].map((n) => defineSecret(n));

let app;

exports.panel = onRequest(
  { region: "us-east1", secrets: secretos, memory: "512MiB", maxInstances: 2, concurrency: 20 },
  (req, res) => {
    app = app || require("./app");
    return app(req, res);
  }
);
