require("dotenv").config();
const connectDB = require("../config/db");
const Supplier = require("../models/Supplier");

/**
 * Corrige proveedores que quedaron con configuración de versiones
 * anteriores de este proyecto: un campo "strategy" con el valor viejo
 * "regex" (ya no válido, el enum actual solo permite "columns") y/o
 * "decimalComma" en true cuando debería ser false.
 *
 * IMPORTANTE: usa updateOne en vez de cargar el documento y hacer
 * .save() — .save() valida TODO el documento contra el schema actual,
 * y el valor viejo "regex" en "strategy" rompe esa validación antes de
 * llegar a corregir nada. updateOne no valida por defecto, así que
 * podemos arreglar el campo problemático sin que la validación del
 * campo problemático nos impida corregirlo.
 *
 * Después de correr esto, los precios NUEVOS que se importen van a leerse
 * bien. Los productos que ya quedaron con el precio mal calculado (100
 * veces más grandes) se corrigen volviendo a subir el mismo PDF en
 * "Actualizar precios" — esa pantalla compara y corrige costo y precio
 * de venta de cada producto ya activo. Si borraste los productos y los
 * volviste a importar ANTES de correr este fix, alcanza con borrarlos y
 * reimportar una vez más ahora que el proveedor va a quedar bien
 * configurado.
 */
async function fix() {
  await connectDB();

  const proveedores = await Supplier.find({});
  let corregidos = 0;

  for (const s of proveedores) {
    const config = s.parserConfig || {};
    const necesitaFix = config.strategy !== "columns" || config.decimalComma !== false;

    if (!necesitaFix) continue;

    await Supplier.updateOne(
      { _id: s._id },
      {
        $set: {
          "parserConfig.strategy": "columns",
          "parserConfig.decimalComma": false,
          "parserConfig.columnHeaders.familia": config.columnHeaders?.familia || "FAMILIA",
          "parserConfig.columnHeaders.descripcion": config.columnHeaders?.descripcion || "Descripción",
          "parserConfig.columnHeaders.codigo": config.columnHeaders?.codigo || "Código",
          "parserConfig.columnHeaders.costo": config.columnHeaders?.costo || "2.Cliente",
        },
        $unset: { "parserConfig.linePattern": "", "parserConfig.ignoreContains": "" },
      },
      { runValidators: false }
    );

    console.log(`[fix] Corregido: ${s.name}`);
    corregidos += 1;
  }

  console.log(`[fix] Listo. Proveedores corregidos: ${corregidos} de ${proveedores.length}.`);
  process.exit(0);
}

fix().catch((err) => {
  console.error("[fix] Error:", err.message);
  process.exit(1);
});
