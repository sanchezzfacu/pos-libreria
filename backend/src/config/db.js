const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "Falta MONGODB_URI en el archivo .env (copiá .env.example a .env y completalo)."
    );
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log(`[db] Conectado a MongoDB -> ${mongoose.connection.name}`);

  mongoose.connection.on("error", (err) => {
    console.error("[db] Error de conexión:", err.message);
  });
}

module.exports = connectDB;
