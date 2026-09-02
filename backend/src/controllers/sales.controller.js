const Sale = require("../models/Sale");
const Expense = require("../models/Expense");
const Product = require("../models/Product");
const { emitirFacturaC } = require("../services/afipService");

async function createSale(req, res) {
  const { items, metodoPago, docTipo, docNro, clienteNombre } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "El carrito está vacío." });
  }
  if (!["efectivo", "transferencia", "tarjeta"].includes(metodoPago)) {
    return res.status(400).json({ error: "Método de pago inválido." });
  }

  // Foto del costo de cada producto al momento de la venta, para que las
  // estadísticas de ganancia no se alteren si después cambia el costo.
  const productIds = items.filter((it) => it.product).map((it) => it.product);
  const productos = await Product.find({ _id: { $in: productIds } });
  const costoPorId = new Map(productos.map((p) => [String(p._id), p.costo]));

  const itemsConCosto = items.map((it) => ({
    ...it,
    costoUnitario: it.product ? costoPorId.get(String(it.product)) ?? 0 : 0,
  }));

  const total = itemsConCosto.reduce((acc, it) => {
    const subtotal = it.precioUnitario * it.cantidad - (it.descuento || 0);
    return acc + Math.max(subtotal, 0);
  }, 0);
  const totalRedondeado = Math.round(total * 100) / 100;

  const sale = await Sale.create({
    items: itemsConCosto,
    total: totalRedondeado,
    metodoPago,
    cajero: req.user?.id,
    docTipo: docTipo || 99,
    docNro: docNro || 0,
    clienteNombre: clienteNombre || undefined,
  });

  // Descuenta stock de los productos vendidos (se permite que quede negativo:
  // no se bloquea la venta por falta de stock, solo se refleja el número).
  const operacionesStock = itemsConCosto
    .filter((it) => it.product)
    .map((it) => ({
      updateOne: { filter: { _id: it.product }, update: { $inc: { stock: -it.cantidad } } },
    }));
  if (operacionesStock.length > 0) {
    await Product.bulkWrite(operacionesStock);
  }

  // La venta ya está cobrada y confirmada acá — respondemos YA. La
  // facturación AFIP está pausada por ahora (ver AFIP_ENABLED en el .env):
  // se está debuggeando aparte y no debe frenar ni complicar el cobro en
  // el mostrador. Para retomarla, alcanza con poner AFIP_ENABLED=true —
  // el resto del código (polling, reintentos, etc.) ya está listo.
  res.status(201).json(sale);

  if (process.env.AFIP_ENABLED === "true") {
    emitirFacturaC({ importeTotal: totalRedondeado, docTipo: sale.docTipo, docNro: sale.docNro })
      .then(async (factura) => {
        sale.factura = { ...factura, intentos: 1 };
        await sale.save();
      })
      .catch(async (err) => {
        console.error("[AFIP] Error facturando venta", sale._id.toString(), ":", err.message);
        sale.factura = { error: err.message, intentos: 1 };
        await sale.save();
      });
  }
}

// Para el polling del frontend: consultar el estado de una venta puntual
// (sobre todo si ya tiene CAE o quedó con error de facturación).
async function getSale(req, res) {
  const sale = await Sale.findById(req.params.id);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada." });
  res.json(sale);
}

// Reintenta facturar una venta que quedó sin CAE (por ejemplo, porque
// AFIP estaba caído en el momento de la venta).
async function facturarVenta(req, res) {
  const { id } = req.params;
  const sale = await Sale.findById(id);
  if (!sale) return res.status(404).json({ error: "Venta no encontrada." });

  if (sale.factura?.cae) {
    return res.json(sale); // ya estaba facturada, no hacemos nada
  }

  try {
    const factura = await emitirFacturaC({
      importeTotal: sale.total,
      docTipo: sale.docTipo,
      docNro: sale.docNro,
    });
    sale.factura = { ...factura, intentos: (sale.factura?.intentos || 0) + 1 };
  } catch (err) {
    sale.factura = { error: err.message, intentos: (sale.factura?.intentos || 0) + 1 };
  }
  await sale.save();

  res.json(sale);
}

async function resumenPorDia(fecha) {
  const inicio = new Date(fecha);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(fecha);
  fin.setHours(23, 59, 59, 999);

  const ventas = await Sale.find({ createdAt: { $gte: inicio, $lte: fin } }).sort({ createdAt: 1 });

  const resumen = { efectivo: 0, transferencia: 0, tarjeta: 0, totalGeneral: 0, cantidadVentas: ventas.length };
  for (const v of ventas) {
    resumen[v.metodoPago] += v.total;
    resumen.totalGeneral += v.total;
  }
  resumen.efectivo = Math.round(resumen.efectivo * 100) / 100;
  resumen.transferencia = Math.round(resumen.transferencia * 100) / 100;
  resumen.tarjeta = Math.round(resumen.tarjeta * 100) / 100;
  resumen.totalGeneral = Math.round(resumen.totalGeneral * 100) / 100;

  return { resumen, ventas };
}

async function closeToday(req, res) {
  const { resumen, ventas } = await resumenPorDia(new Date());
  res.json({ resumen, ventas });
}

// Igual que closeToday pero para cualquier día (?date=YYYY-MM-DD), para
// poder consultar el historial de un día anterior desde Cierre de caja.
async function salesByDate(req, res) {
  const { date } = req.query;
  const fecha = date ? new Date(`${date}T12:00:00`) : new Date();
  if (Number.isNaN(fecha.getTime())) {
    return res.status(400).json({ error: "Fecha inválida." });
  }
  const { resumen, ventas } = await resumenPorDia(fecha);
  res.json({ resumen, ventas });
}

// Elimina una venta directamente (sin dejar rastro) y devuelve el stock
// que esa venta había descontado.
async function deleteSale(req, res) {
  const { id } = req.params;
  const venta = await Sale.findById(id);
  if (!venta) return res.status(404).json({ error: "Venta no encontrada." });

  const operacionesStock = venta.items
    .filter((it) => it.product)
    .map((it) => ({
      updateOne: { filter: { _id: it.product }, update: { $inc: { stock: it.cantidad } } },
    }));
  if (operacionesStock.length > 0) {
    await Product.bulkWrite(operacionesStock);
  }

  await Sale.findByIdAndDelete(id);
  res.json({ ok: true });
}

function rango2(query) {
  const hoy = new Date();
  let from, to;

  if (query.from || query.to) {
    from = query.from ? new Date(query.from) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    to = query.to ? new Date(query.to) : hoy;
  } else {
    const dias = Number(query.dias) || 0; // 0 = solo hoy
    from = new Date(hoy);
    from.setDate(from.getDate() - dias);
    from.setHours(0, 0, 0, 0);
    to = new Date(hoy);
    to.setHours(23, 59, 59, 999);
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

// Estadísticas de ventas: ganancia bruta (venta - costo mercadería) y neta
// (bruta - gastos operativos cargados en ese período), con serie diaria
// para graficar.
async function stats(req, res) {
  const { from, to } = rango2(req.query);

  const ventas = await Sale.find({ createdAt: { $gte: from, $lte: to } });
  const gastos = await Expense.find({ fecha: { $gte: from, $lte: to } });

  const porDiaMap = new Map();

  function diaKey(fecha) {
    return fecha.toISOString().slice(0, 10);
  }

  let ventasTotales = 0;
  let costoTotal = 0;
  let cantidadItems = 0;

  for (const venta of ventas) {
    const key = diaKey(venta.createdAt);
    if (!porDiaMap.has(key)) {
      porDiaMap.set(key, { fecha: key, ventas: 0, costo: 0, gastos: 0 });
    }
    const dia = porDiaMap.get(key);

    let costoVenta = 0;
    for (const item of venta.items) {
      costoVenta += (item.costoUnitario || 0) * item.cantidad;
      cantidadItems += item.cantidad;
    }

    dia.ventas += venta.total;
    dia.costo += costoVenta;
    ventasTotales += venta.total;
    costoTotal += costoVenta;
  }

  let gastosTotales = 0;
  for (const gasto of gastos) {
    const key = diaKey(gasto.fecha);
    if (!porDiaMap.has(key)) {
      porDiaMap.set(key, { fecha: key, ventas: 0, costo: 0, gastos: 0 });
    }
    porDiaMap.get(key).gastos += gasto.monto;
    gastosTotales += gasto.monto;
  }

  const gananciaBruta = ventasTotales - costoTotal;
  const gananciaNeta = gananciaBruta - gastosTotales;
  const margenPromedio = ventasTotales > 0 ? (gananciaBruta / ventasTotales) * 100 : 0;

  const porDia = [...porDiaMap.values()]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((d) => ({
      fecha: d.fecha,
      ventas: Math.round(d.ventas * 100) / 100,
      costo: Math.round(d.costo * 100) / 100,
      gastos: Math.round(d.gastos * 100) / 100,
      gananciaBruta: Math.round((d.ventas - d.costo) * 100) / 100,
      gananciaNeta: Math.round((d.ventas - d.costo - d.gastos) * 100) / 100,
    }));

  res.json({
    rango: { from, to },
    cantidadVentas: ventas.length,
    cantidadItems,
    ventasTotales: Math.round(ventasTotales * 100) / 100,
    costoTotal: Math.round(costoTotal * 100) / 100,
    gananciaBruta: Math.round(gananciaBruta * 100) / 100,
    gastosTotales: Math.round(gastosTotales * 100) / 100,
    gananciaNeta: Math.round(gananciaNeta * 100) / 100,
    margenPromedio: Math.round(margenPromedio * 100) / 100,
    porDia,
  });
}

// Ranking de productos vendidos en el período: para saber qué se está
// vendiendo bien y reponer a tiempo. Agrupa por producto (o por
// descripción si el ítem no tiene producto asociado, ej. ventas viejas).
async function productStats(req, res) {
  const { from, to } = rango2(req.query);
  const ventas = await Sale.find({ createdAt: { $gte: from, $lte: to } });

  const porProducto = new Map(); // key -> { productId, descripcion, cantidad, ingresos }

  for (const venta of ventas) {
    for (const item of venta.items) {
      const key = item.product ? String(item.product) : `desc:${item.descripcion}`;
      if (!porProducto.has(key)) {
        porProducto.set(key, {
          productId: item.product || null,
          descripcion: item.descripcion,
          cantidad: 0,
          ingresos: 0,
        });
      }
      const fila = porProducto.get(key);
      fila.cantidad += item.cantidad;
      fila.ingresos += item.precioUnitario * item.cantidad - (item.descuento || 0);
    }
  }

  const productIds = [...porProducto.values()].filter((f) => f.productId).map((f) => f.productId);
  const productos = await Product.find({ _id: { $in: productIds } }).select("stock");
  const stockPorId = new Map(productos.map((p) => [String(p._id), p.stock]));

  const ranking = [...porProducto.values()]
    .map((f) => ({
      ...f,
      ingresos: Math.round(f.ingresos * 100) / 100,
      stockActual: f.productId ? stockPorId.get(String(f.productId)) ?? null : null,
    }))
    .sort((a, b) => b.cantidad - a.cantidad);

  res.json({ rango: { from, to }, ranking });
}

module.exports = {
  createSale,
  getSale,
  facturarVenta,
  closeToday,
  salesByDate,
  deleteSale,
  stats,
  productStats,
};
