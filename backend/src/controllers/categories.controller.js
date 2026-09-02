const Category = require("../models/Category");

async function listCategories(req, res) {
  const categorias = await Category.find().sort({ nombre: 1 });
  res.json(categorias);
}

async function createCategory(req, res) {
  const { nombre } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ error: "Falta el nombre de la categoría." });
  }

  const nombreLimpio = nombre.trim();

  // Si ya existe (sin importar mayúsculas/minúsculas), devolvemos esa en
  // vez de crear una duplicada.
  const existente = await Category.findOne({ nombre: new RegExp(`^${nombreLimpio}$`, "i") });
  if (existente) return res.json(existente);

  const categoria = await Category.create({ nombre: nombreLimpio });
  res.status(201).json(categoria);
}

module.exports = { listCategories, createCategory };
