const Product = require("../models/Product");
const Supplier = require("../models/Supplier");
const { calcularPrecioYMargen, redondearPrecioVenta } = require("../utils/pricing");

const ORDENABLES = { stock: "stock", descripcion: "descripcion", precioVenta: "precioVenta", costo: "costo" };

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tabla de inventario completo: paginada, ordenable, y buscable tanto por
// descripción como por código de proveedor o código de barras (para cuando
// no te acordás cómo está escrito el nombre pero sí el código).
async function searchProducts(req, res) {
  const {
    q = "",
    supplierId,
    onlyActive,
    accesoRapido,
    familia,
    sortBy = "descripcion",
    sortDir = "asc",
    page = "1",
    pageSize = "50",
  } = req.query;

  const filtro = {};
  if (supplierId) filtro.supplier = supplierId;
  if (onlyActive === "true") filtro.isActive = true;
  if (accesoRapido === "true") filtro.mostrarEnAccesoRapido = true;
  if (familia) filtro.familia = familia;

  if (q) {
    const regex = new RegExp(escaparRegex(q.trim()), "i");
    filtro.$or = [{ descripcion: regex }, { codigoProveedor: regex }, { barcode: regex }];
  }

  const campoOrden = ORDENABLES[sortBy] || "descripcion";
  const direccion = sortDir === "desc" ? -1 : 1;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const sizeNum = Math.min(500, Math.max(1, parseInt(pageSize, 10) || 50));

  const [items, total] = await Promise.all([
    Product.find(filtro)
      .sort({ [campoOrden]: direccion })
      .skip((pageNum - 1) * sizeNum)
      .limit(sizeNum),
    Product.countDocuments(filtro),
  ]);

  res.json({ items, total, page: pageNum, pageSize: sizeNum });
}

async function activeProducts(req, res) {
  const productos = await Product.find({ isActive: true }).sort({ descripcion: 1 });
  res.json(productos);
}

// Recibe los items parseados del PDF que se seleccionaron con checkbox y los
// guarda como productos activos. Usa bulkWrite (una sola operación a
// MongoDB) para poder activar lotes grandes sin problema.
async function bulkActivate(req, res) {
  const { supplierId, margen, items } = req.body;

  const supplier = await Supplier.findById(supplierId);
  if (!supplier) return res.status(404).json({ error: "Proveedor no encontrado." });
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "No se enviaron productos para activar." });
  }

  const margenFinal = margen ?? supplier.defaultMargin;

  const operaciones = items.map((item) => {
    const codigo = item.codigoProveedor.toUpperCase();
    const { precioVenta, margen: margenReal } = calcularPrecioYMargen(item.costo, margenFinal);
    return {
      updateOne: {
        filter: { supplier: supplier._id, codigoProveedor: codigo },
        update: {
          $set: {
            supplier: supplier._id,
            familia: item.familia,
            descripcion: item.descripcion,
            codigoProveedor: codigo,
            costo: item.costo,
            margen: margenReal,
            precioVenta,
            isActive: true,
            origen: "proveedor",
          },
          $setOnInsert: { stock: 0, mostrarEnAccesoRapido: false },
        },
        upsert: true,
      },
    };
  });

  const resultado = await Product.bulkWrite(operaciones, { ordered: false });

  res.json({
    creados: (resultado.upsertedCount ?? 0) + (resultado.modifiedCount ?? 0),
  });
}

async function linkBarcode(req, res) {
  const { id } = req.params;
  const { barcode } = req.body;

  if (!barcode) return res.status(400).json({ error: "Falta el código de barras." });

  const yaUsado = await Product.findOne({ barcode, _id: { $ne: id } });
  if (yaUsado) {
    return res.status(409).json({ error: "Ese código de barras ya está asociado a otro producto." });
  }

  const producto = await Product.findByIdAndUpdate(id, { barcode }, { new: true });
  if (!producto) return res.status(404).json({ error: "Producto no encontrado." });

  res.json(producto);
}

// Busca por código de barras REAL o, si no hay uno cargado, por el código
// que ya trae el PDF del proveedor (codigoProveedor) — así no hace falta
// vincular manualmente cada producto para poder venderlo.
async function findByBarcode(req, res) {
  const { barcode } = req.params;
  const codigoNormalizado = barcode.trim().toUpperCase();

  const producto = await Product.findOne({
    isActive: true,
    $or: [{ barcode: barcode.trim() }, { codigoProveedor: codigoNormalizado }],
  });

  if (!producto) return res.status(404).json({ error: "No hay ningún producto con ese código." });
  res.json(producto);
}

async function createGeneric(req, res) {
  const { descripcion, precioVenta } = req.body;
  if (!descripcion || !precioVenta) {
    return res.status(400).json({ error: "Faltan descripción y/o precio." });
  }

  const producto = await Product.create({
    descripcion,
    codigoProveedor: `GEN-${Date.now()}`,
    costo: 0,
    margen: 0,
    precioVenta: redondearPrecioVenta(Number(precioVenta)),
    isActive: true,
    origen: "generico",
    mostrarEnAccesoRapido: true,
  });

  res.status(201).json(producto);
}

// Alta manual: productos que se compran por fuera de los mayoristas
// habituales (no vienen de ningún PDF), pero sí tienen costo/margen reales
// a diferencia de los genéricos rápidos. El frontend ya manda costo,
// margen y precioVenta coherentes entre sí (los sincroniza en pantalla);
// acá solo se redondea el precio final a múltiplo de 10.
async function createManual(req, res) {
  const { descripcion, familia, costo, margen, precioVenta, barcode, stock } = req.body;

  if (!descripcion) return res.status(400).json({ error: "Falta la descripción." });
  if (costo === undefined && precioVenta === undefined) {
    return res.status(400).json({ error: "Indicá al menos el costo o el precio de venta." });
  }

  const costoFinal = Number(costo) || 0;
  const margenFinal = margen !== undefined ? Number(margen) : 0.45;
  const precioVentaBase =
    precioVenta !== undefined ? Number(precioVenta) : costoFinal * (1 + margenFinal);
  const precioVentaFinal = redondearPrecioVenta(precioVentaBase);
  const margenFinalReal = costoFinal > 0 ? (precioVentaFinal - costoFinal) / costoFinal : margenFinal;

  const producto = await Product.create({
    descripcion,
    familia: familia || "SIN FAMILIA",
    codigoProveedor: `MAN-${Date.now()}`,
    costo: costoFinal,
    margen: margenFinalReal,
    precioVenta: precioVentaFinal,
    barcode: barcode || undefined,
    stock: Number(stock) || 0,
    isActive: true,
    origen: "manual",
  });

  res.status(201).json(producto);
}

// Edición libre desde la tabla de Inventario completo: cualquier producto
// (sea de proveedor, manual o genérico) se puede tocar acá — costo,
// margen, precio de venta, stock, si aparece en acceso rápido, si está
// activo. Si vienen costo+margen juntos se recalcula el precio (redondeado);
// si viene precioVenta explícito se respeta tal cual (ya redondeado por el
// frontend) y se recalcula el margen real a partir de él.
async function updateProduct(req, res) {
  const { id } = req.params;
  const { costo, margen, precioVenta, isActive, stock, mostrarEnAccesoRapido, familia } = req.body;

  const producto = await Product.findById(id);
  if (!producto) return res.status(404).json({ error: "Producto no encontrado." });

  if (isActive !== undefined) producto.isActive = isActive;
  if (stock !== undefined) producto.stock = stock;
  if (mostrarEnAccesoRapido !== undefined) producto.mostrarEnAccesoRapido = mostrarEnAccesoRapido;
  if (familia !== undefined) producto.familia = familia || "SIN FAMILIA";

  const costoNuevo = costo !== undefined ? Number(costo) : producto.costo;

  if (precioVenta !== undefined) {
    // El precio de venta manda: se respeta y se recalcula el margen real.
    producto.costo = costoNuevo;
    producto.precioVenta = redondearPrecioVenta(Number(precioVenta));
    producto.margen = costoNuevo > 0 ? (producto.precioVenta - costoNuevo) / costoNuevo : producto.margen;
  } else if (costo !== undefined || margen !== undefined) {
    const margenNuevo = margen !== undefined ? Number(margen) : producto.margen;
    const { precioVenta: nuevoPrecio, margen: margenReal } = calcularPrecioYMargen(costoNuevo, margenNuevo);
    producto.costo = costoNuevo;
    producto.precioVenta = nuevoPrecio || producto.precioVenta;
    producto.margen = margenReal;
  }

  await producto.save();
  res.json(producto);
}

// Aplica en bloque los cambios de costo/margen/precio de venta confirmados
// desde la pantalla de "Actualizar precios" (no toca lo que no viene en el payload).
async function applyPriceUpdate(req, res) {
  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ error: "No se enviaron productos para actualizar." });
  }

  const operaciones = updates.map((u) => {
    const { precioVenta, margen } = calcularPrecioYMargen(u.newCostPrice, u.newMargin);
    return {
      updateOne: {
        filter: { _id: u.productId },
        update: { $set: { costo: u.newCostPrice, margen, precioVenta } },
      },
    };
  });

  const resultado = await Product.bulkWrite(operaciones);
  res.json({
    actualizados: resultado.modifiedCount ?? 0,
    coincidencias: resultado.matchedCount ?? 0,
  });
}

// Ajuste global de precios (ej. una vez al mes por inflación): sube o baja
// el precio de venta de TODOS los productos activos un mismo porcentaje
// (puede ser negativo), redondeando el resultado y recalculando el margen
// real de cada uno. Se aplica directo sobre el precio de venta actual, no
// sobre el costo.
async function bulkPriceAdjustment(req, res) {
  const { percent } = req.body;
  const pct = Number(percent);
  if (!Number.isFinite(pct) || pct === 0) {
    return res.status(400).json({ error: "Indicá un porcentaje distinto de cero." });
  }

  const productos = await Product.find({ isActive: true });
  if (productos.length === 0) {
    return res.json({ actualizados: 0 });
  }

  const operaciones = productos.map((p) => {
    const precioNuevo = redondearPrecioVenta(p.precioVenta * (1 + pct / 100));
    const margenNuevo = p.costo > 0 ? (precioNuevo - p.costo) / p.costo : p.margen;
    return {
      updateOne: {
        filter: { _id: p._id },
        update: { $set: { precioVenta: precioNuevo, margen: margenNuevo } },
      },
    };
  });

  const resultado = await Product.bulkWrite(operaciones);
  res.json({ actualizados: resultado.modifiedCount ?? 0 });
}

module.exports = {
  searchProducts,
  activeProducts,
  bulkActivate,
  linkBarcode,
  findByBarcode,
  createGeneric,
  createManual,
  updateProduct,
  applyPriceUpdate,
  bulkPriceAdjustment,
};
