const mongoose = require("mongoose");

const ExpenseSchema = new mongoose.Schema(
  {
    descripcion: { type: String, required: true, trim: true },
    monto: { type: Number, required: true, min: 0 },
    categoria: {
      type: String,
      enum: ["alquiler", "sueldos", "servicios", "mercaderia", "impuestos", "otros"],
      default: "otros",
    },
    fecha: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Expense", ExpenseSchema);
