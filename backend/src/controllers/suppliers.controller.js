const Supplier = require("../models/Supplier");
const Product = require("../models/Product");
const { parseSupplierPdf } = require("../parsers/pdfParser");
const { calcularPrecioYMargen } = require("../utils/pricing");

async function listSuppliers(req, res) {
  const suppliers = await Supplier.find().sort({ name: 1 });
  res.json(suppliers);
}

async function createSupplier(req, res) {
  const { name, defaultMargin, parserConfig } = req.body;
  if (!name) return res.status(400).json({ error: "Falta el nombre del proveedor." });

  const slug = name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const existente = await Supplier.findOne({ slug });
  if (existente) {
    return res.status(409).json({ error: "Ya existe un proveedor con ese nombre." });
  }

  const supplier = await Supplier.create({
    name: name.trim(),
    slug,
    defaultMargin: defaultMargin ?? 0.45,
    ...(parserConfig ? { parserConfig } : {}),
  });

  res.status(201).json(supplier);
}

// Permite ajustar la regex/config de un proveedor puntual (para calibrar el parser)
async function updateSupplierParser(req, res) {
  const { id } = req.params;
  const { parserConfig, defaultMargin } = req.body;

  const supplier = await Supplier.findById(id);
  if (!supplier) return res.status(404).json({ error: "Proveedor no encontrado." });

  if (parserConfig) supplier.parserConfig = { ...supplier.parserConfig.toObject(), ...parserConfig };
  if (defaultMargin !== undefined) supplier.defaultMargin = defaultMargin;

  await supplier.save();
  res.json(supplier);
}

// Recibe el PDF, lo parsea con la config del proveedor elegido y devuelve
// una previsualización (no guarda nada todavía).
async function importPdfPreview(req, res) {
  const { id } = req.params;
  const supplier = await Supplier.findById(id);
  if (!supplier) return res.status(404).json({ error: "Proveedor no encontrado." });

  if (!req.file) {
    return res.status(400).json({ error: "Falta el archivo PDF (campo 'pdf')." });
  }

  try {
    const { items, errores, totalLineas } = await parseSupplierPdf(req.file.buffer, supplier);
    res.json({
      supplier: { id: supplier._id, name: supplier.name, defaultMargin: supplier.defaultMargin },
      totalLineas,
      itemsParseados: items.length,
      lineasSinParsear: errores.length,
      items,
      errores: errores.slice(0, 30),
    });
  } catch (err) {
    console.error("[import-pdf] Error parseando PDF:", err.message);
    res.status(422).json({ error: "No se pudo leer el PDF. ¿Es un PDF de texto (no escaneado)?" });
  }
}

// Vista previa comparativa: parsea el PDF y compara cada código contra el
// producto activo que ya existe en el inventario para ese proveedor. No
// guarda nada en la base — solo devuelve el diagnóstico para que se
// confirme manualmente antes de aplicar (ver applyPriceUpdate).
async function previewPriceUpdate(req, res) {
  const { id } = req.params;
  const supplier = await Supplier.findById(id);
  if (!supplier) return res.status(404).json({ error: "Proveedor no encontrado." });

  if (!req.file) {
    return res.status(400).json({ error: "Falta el archivo PDF (campo 'pdf')." });
  }

  let parsed;
  try {
    parsed = await parseSupplierPdf(req.file.buffer, supplier);
  } catch (err) {
    console.error("[preview-update] Error parseando PDF:", err.message);
    return res.status(422).json({ error: "No se pudo leer el PDF. ¿Es un PDF de texto (no escaneado)?" });
  }

  const codigos = parsed.items.map((it) => it.codigoProveedor);
  const productosExistentes = await Product.find({
    supplier: supplier._id,
    codigoProveedor: { $in: codigos },
    isActive: true,
  });
  const porCodigo = new Map(productosExistentes.map((p) => [p.codigoProveedor, p]));

  const increased = [];
  const decreased = [];
  const unchanged = [];
  const unregistered = [];

  for (const item of parsed.items) {
    const producto = porCodigo.get(item.codigoProveedor);

    if (!producto) {
      unregistered.push({
        codigoProveedor: item.codigoProveedor,
        descripcion: item.descripcion,
        familia: item.familia,
        costo: item.costo,
      });
      continue;
    }

    const oldCostPrice = producto.costo;
    const newCostPrice = item.costo;
    const oldSellingPrice = producto.precioVenta;
    const { precioVenta: newSellingPrice, margen: margenReal } = calcularPrecioYMargen(
      newCostPrice,
      producto.margen
    );
    const percentageChange =
      oldCostPrice > 0 ? Math.round(((newCostPrice - oldCostPrice) / oldCostPrice) * 10000) / 100 : 0;

    const fila = {
      productId: producto._id,
      descripcion: producto.descripcion,
      codigoProveedor: producto.codigoProveedor,
      oldCostPrice,
      newCostPrice,
      percentageChange,
      margen: margenReal,
      oldSellingPrice,
      newSellingPrice,
      // Las que suben van pre-tildadas; las que bajan quedan sin tildar
      // para revisar a mano antes de bajar un precio en el mostrador.
      preseleccionado: newCostPrice >= oldCostPrice,
    };

    if (newCostPrice > oldCostPrice) increased.push(fila);
    else if (newCostPrice < oldCostPrice) decreased.push(fila);
    else unchanged.push(fila);
  }

  res.json({
    supplier: { id: supplier._id, name: supplier.name },
    totalLineas: parsed.totalLineas,
    lineasSinParsear: parsed.errores.length,
    resumen: {
      increased: increased.length,
      decreased: decreased.length,
      unchanged: unchanged.length,
      unregistered: unregistered.length,
    },
    increased,
    decreased,
    unchanged,
    unregistered,
  });
}

module.exports = {
  listSuppliers,
  createSupplier,
  updateSupplierParser,
  importPdfPreview,
  previewPriceUpdate,
};
