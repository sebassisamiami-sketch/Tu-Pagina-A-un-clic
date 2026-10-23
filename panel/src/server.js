// Para ver el panel en tu computador: npm run dev
const app = require("./app");

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Panel escuchando en http://localhost:${PORT}`));
