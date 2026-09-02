const mongoose = require("mongoose");

const SaleItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    descripcion: { type: String, required: true },
    cantidad: { type: Number, required: true, min: 1 },
    precioUnitario: { type: Number, required: true },
    // Costo del producto en el momento de la venta (foto histórica: si el costo
    // cambia después por una actualización de precios, esta venta no se altera)
    costoUnitario: { type: Number, default: 0 },
    descuento: { type: Number, default: 0 },
  },
  { _id: false }
);

const SaleSchema = new mongoose.Schema(
  {
    items: { type: [SaleItemSchema], required: true },
    total: { type: Number, required: true },
    metodoPago: {
      type: String,
      enum: ["efectivo", "transferencia", "tarjeta"],
      required: true,
    },
    cajero: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    // Datos del comprador para la factura (opcional — la gran mayoría de
    // las ventas son a consumidor final sin identificar; AFIP solo exige
    // esto por encima de un monto muy alto, ver AFIP_UMBRAL_IDENTIFICACION)
    docTipo: { type: Number, default: 99 }, // 99 = consumidor final, 96 = DNI, 80 = CUIT
    docNro: { type: Number, default: 0 },
    // Nombre del cliente para mostrar en la factura impresa (AFIP no pide
    // ni devuelve un nombre — esto es solo para que la factura diga a
    // quién corresponde cuando el cliente pidió factura a su nombre)
    clienteNombre: { type: String, trim: true },

    // Resultado de la facturación electrónica en AFIP (Factura C). Si
    // "cae" está vacío, la venta se cobró igual pero la factura todavía
    // no se emitió (por ejemplo, AFIP estaba caído) — se puede reintentar.
    factura: {
      tipoComprobante: { type: Number, default: 11 }, // 11 = Factura C
      puntoVenta: Number,
      numero: Number,
      cae: String,
      caeVencimiento: String, // yyyy-mm-dd
      qrUrl: String,
      ambiente: { type: String, enum: ["homologacion", "produccion"] },
      error: String,
      intentos: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sale", SaleSchema);
