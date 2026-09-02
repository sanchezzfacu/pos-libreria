/**
 * En Argentina ya no circulan monedas menores a $10, así que todo precio
 * de venta se redondea al múltiplo de 10 más cercano — siempre hacia
 * arriba, para no perder margen en el redondeo.
 */
function redondearPrecioVenta(precio) {
  return Math.ceil(precio / 10) * 10;
}

/**
 * A partir de un costo y un margen "nominal" (ej. 0.45), calcula el precio
 * de venta ya redondeado y el margen REAL que queda después de redondear
 * (que ya no es exactamente el nominal). Ese margen real es el que se
 * guarda en la base — el nominal es solo un punto de partida.
 */
function calcularPrecioYMargen(costo, margenNominal) {
  if (!(costo > 0)) {
    return { precioVenta: 0, margen: margenNominal };
  }
  const precioBruto = costo * (1 + margenNominal);
  const precioVenta = redondearPrecioVenta(precioBruto);
  const margen = (precioVenta - costo) / costo;
  return { precioVenta, margen };
}

module.exports = { redondearPrecioVenta, calcularPrecioYMargen };
