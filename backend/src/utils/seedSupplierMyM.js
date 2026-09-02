require("dotenv").config();
const connectDB = require("../config/db");
const Supplier = require("../models/Supplier");

async function seedSupplier() {
  await connectDB();

  const existente = await Supplier.findOne({ slug: "martinez-y-martinez" });
  if (existente) {
    console.log("[seed] El proveedor Martinez y Martinez ya existe. No se hizo nada.");
    process.exit(0);
  }

  await Supplier.create({
    name: "Martinez y Martinez",
    slug: "martinez-y-martinez",
    defaultMargin: 0.45,
    // parserConfig usa los valores por defecto del modelo, ya calibrados
    // contra un PDF real de este proveedor: columnas "FAMILIA",
    // "Descripción", "Código" y "2.Cliente", precio con punto decimal.
  });

  console.log("[seed] Proveedor Martinez y Martinez creado.");
  process.exit(0);
}

seedSupplier().catch((err) => {
  console.error("[seed] Error:", err.message);
  process.exit(1);
});
