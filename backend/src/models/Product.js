const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },

    familia: { type: String, trim: true, index: true },
    descripcion: { type: String, required: true, trim: true },
    codigoProveedor: { type: String, required: true, trim: true }, // ej: CEMASR12

    costo: { type: Number, required: true, default: 0 },
    margen: { type: Number, required: true, default: 0.45 },
    precioVenta: { type: Number, required: true },

    // Código de barras real (EAN u otro) impreso en el producto físico, si lo tiene.
    // Es opcional: la búsqueda en el POS también encuentra productos por
    // codigoProveedor, así que no hace falta cargar esto para poder venderlos.
    barcode: { type: String, trim: true, sparse: true, unique: true },

    // Cantidad en stock. Se descuenta sola con cada venta; se puede recargar
    // a mano desde la tabla de inventario (ej. después de un recuento físico).
    stock: { type: Number, default: 0 },

    // Si aparece como botón de acceso rápido en el mostrador del POS
    mostrarEnAccesoRapido: { type: Boolean, default: false },

    // Solo los productos activos aparecen en el catálogo del POS
    isActive: { type: Boolean, default: false, index: true },

    // proveedor  = viene de un PDF importado de un mayorista
    // manual     = cargado a mano (se compra por otro lado, no a un mayorista habitual)
    // generico   = ítem rápido sin control de costo real (ej: fotocopia, impresión)
    origen: {
      type: String,
      enum: ["proveedor", "manual", "generico"],
      default: "proveedor",
    },
  },
  { timestamps: true }
);

ProductSchema.index({ supplier: 1, codigoProveedor: 1 }, { unique: true, sparse: true });
ProductSchema.index({ descripcion: "text", familia: "text" });

// Los controllers calculan costo/margen/precioVenta explícitamente con
// backend/src/utils/pricing.js (y las operaciones en bloque, que además
// no disparan hooks de Mongoose, también). Este hook es solo un resguardo
// final: cualquier precio que se guarde queda redondeado a múltiplo de 10.
const { redondearPrecioVenta } = require("../utils/pricing");
ProductSchema.pre("save", function redondear(next) {
  if (this.isModified("precioVenta") && this.precioVenta > 0) {
    this.precioVenta = redondearPrecioVenta(this.precioVenta);
  }
  next();
});

module.exports = mongoose.model("Product", ProductSchema);
