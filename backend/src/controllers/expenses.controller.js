const Expense = require("../models/Expense");

async function createExpense(req, res) {
  const { descripcion, monto, categoria, fecha } = req.body;
  if (!descripcion || monto === undefined) {
    return res.status(400).json({ error: "Faltan descripción y/o monto." });
  }

  const gasto = await Expense.create({
    descripcion,
    monto: Number(monto),
    categoria: categoria || "otros",
    fecha: fecha ? new Date(fecha) : new Date(),
  });

  res.status(201).json(gasto);
}

async function listExpenses(req, res) {
  const { from, to } = req.query;
  const filtro = {};
  if (from || to) {
    filtro.fecha = {};
    if (from) filtro.fecha.$gte = new Date(from);
    if (to) filtro.fecha.$lte = new Date(to);
  }

  const gastos = await Expense.find(filtro).sort({ fecha: -1 });
  res.json(gastos);
}

async function deleteExpense(req, res) {
  const { id } = req.params;
  const gasto = await Expense.findByIdAndDelete(id);
  if (!gasto) return res.status(404).json({ error: "Gasto no encontrado." });
  res.json({ ok: true });
}

module.exports = { createExpense, listExpenses, deleteExpense };
