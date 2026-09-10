require("dotenv").config();
const connectDB = require("../config/db");
const Product = require("../models/Product");

// Un stock real de librería nunca llega a 6 dígitos. Si aparece un valor
// más grande que esto, es casi seguro que se escaneó un código de barras
// (o se pegó algo) por error en el campo de stock, no una cantidad real.
const LIMITE_RAZONABLE = 999999;

async function fix() {
  await connectDB();

  const sospechosos = await Product.find({
    $or: [{ stock: { $gt: LIMITE_RAZONABLE } }, { stock: { $lt: -LIMITE_RAZONABLE } }],
  });

  if (sospechosos.length === 0) {
    console.log("[fix] No se encontró ningún producto con stock fuera de lo razonable. Todo bien.");
    process.exit(0);
  }

  console.log(`[fix] Encontrados ${sospechosos.length} producto(s) con stock corrupto:\n`);
  for (const p of sospechosos) {
    console.log(` - ${p.descripcion} (código ${p.codigoProveedor}) → stock actual: ${p.stock}`);
  }

  console.log("\n[fix] Corrigiendo todos a stock = 0 (cargá el número real a mano después)...");
  for (const p of sospechosos) {
    p.stock = 0;
    await p.save();
  }

  console.log(`[fix] Listo. ${sospechosos.length} producto(s) corregido(s) a stock = 0.`);
  process.exit(0);
}

fix().catch((err) => {
  console.error("[fix] Error:", err.message);
  process.exit(1);
});
