const mongoose = require("mongoose");

/**
 * Cada proveedor arma su PDF de lista de precios con sus propias columnas
 * (normalmente es un Excel exportado a PDF, con encabezado de columnas
 * repetido en cada página). En vez de una regex por proveedor, el parser
 * detecta el renglón de encabezado de cada página y arma las columnas por
 * POSICIÓN, usando el nombre exacto de cada encabezado como referencia
 * (ej: "2.Cliente", "Precio Lista", "Costo", etc. — lo que diga ESE PDF).
 *
 * Esto permite sumar un proveedor nuevo, o ajustar uno existente, solo
 * escribiendo cómo se llama cada columna en su PDF — sin tocar código.
 */
const SupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },

    // Margen de ganancia por defecto para productos de este proveedor (0.45 = 45%)
    defaultMargin: { type: Number, default: 0.45 },

    parserConfig: {
      strategy: { type: String, enum: ["columns"], default: "columns" },

      // Texto EXACTO (case-insensitive) de cada encabezado tal como aparece
      // en el PDF de este proveedor. "familia" es opcional: si el proveedor
      // no separa por familia, se deja en null y todo entra como "SIN FAMILIA".
      columnHeaders: {
        familia: { type: String, default: "FAMILIA" },
        descripcion: { type: String, default: "Descripción" },
        codigo: { type: String, default: "Código" },
        costo: { type: String, default: "2.Cliente" },
      },

      // true si el precio viene como "1.250,50" (miles con punto, decimales con coma).
      // El PDF de Martinez y Martinez usa punto decimal sin separador de miles
      // (ej: "158814.88"), por eso el default acá es false.
      decimalComma: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Supplier", SupplierSchema);
