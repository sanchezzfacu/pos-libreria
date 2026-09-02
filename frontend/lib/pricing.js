// En Argentina ya no circulan monedas menores a $10: todo precio de venta
// se redondea al múltiplo de 10 más cercano, siempre hacia arriba (nunca
// se pierde margen en el redondeo). Espeja backend/src/utils/pricing.js.
export function redondearPrecio(precio) {
  return Math.ceil(precio / 10) * 10;
}

export function formatearMargen(margenFraccion) {
  return `${Math.round(margenFraccion * 100)}%`;
}
