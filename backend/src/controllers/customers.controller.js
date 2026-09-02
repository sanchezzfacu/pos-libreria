const Customer = require("../models/Customer");

// Búsqueda para el autocompletar del POS: por nombre o por número de documento.
async function searchCustomers(req, res) {
  const { q = "" } = req.query;
  if (!q.trim()) return res.json([]);

  const filtro = /^\d+$/.test(q.trim())
    ? { docNro: Number(q.trim()) }
    : { nombre: new RegExp(q.trim(), "i") };

  const clientes = await Customer.find(filtro).limit(10).sort({ nombre: 1 });
  res.json(clientes);
}

async function createCustomer(req, res) {
  const { nombre, docTipo, docNro, domicilio } = req.body;
  if (!nombre || !docNro) {
    return res.status(400).json({ error: "Faltan nombre y/o número de documento." });
  }

  const cliente = await Customer.create({
    nombre,
    docTipo: docTipo || 96,
    docNro: Number(docNro),
    domicilio: domicilio || undefined,
  });

  res.status(201).json(cliente);
}

module.exports = { searchCustomers, createCustomer };
