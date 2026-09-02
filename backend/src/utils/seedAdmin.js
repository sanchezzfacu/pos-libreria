require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("../config/db");
const User = require("../models/User");

async function seedAdmin() {
  await connectDB();

  const username = (process.env.ADMIN_USERNAME || "").toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    throw new Error("Definí ADMIN_USERNAME y ADMIN_PASSWORD en el .env antes de correr el seed.");
  }

  const existente = await User.findOne({ username });
  if (existente) {
    console.log(`[seed] El usuario "${username}" ya existe. No se hizo nada.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ username, passwordHash, role: "admin" });

  console.log(`[seed] Usuario admin "${username}" creado correctamente.`);
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("[seed] Error:", err.message);
  process.exit(1);
});
