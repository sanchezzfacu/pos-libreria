const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    // 96 = DNI, 80 = CUIT (los tipos de documento que de verdad se usan acá)
    docTipo: { type: Number, enum: [96, 80], default: 96 },
    docNro: { type: Number, required: true },
    domicilio: { type: String, trim: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ nombre: "text" });
CustomerSchema.index({ docNro: 1 });

module.exports = mongoose.model("Customer", CustomerSchema);
