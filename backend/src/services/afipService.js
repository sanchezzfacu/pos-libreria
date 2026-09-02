const Afip = require("@afipsdk/afip.js");

const CBTE_TIPO_FACTURA_C = 11; // Tipo de comprobante: Factura C
const CONCEPTO_PRODUCTOS = 1;
const MONEDA_PESOS = "PES";

/**
 * Arma el cliente de AFIP a partir de las variables de entorno. Se crea
 * uno nuevo por request (no cuesta nada relevante) para no arrastrar
 * estado entre llamadas — la propia librería cachea el token de acceso
 * de AFIP (WSAA) internamente entre instancias con el mismo CUIT.
 */
function normalizarPem(valor) {
  // Si el certificado/clave se pegó en el .env como una sola línea con
  // "\n" literales (dos caracteres: barra + n) en vez de saltos de línea
  // reales, los convertimos — es la forma más común de pegar un PEM en
  // una variable de entorno sin romper el archivo.
  return valor ? valor.replace(/\\n/g, "\n") : valor;
}

function getAfipClient() {
  const { AFIP_CUIT, AFIP_ACCESS_TOKEN, AFIP_PRODUCTION } = process.env;
  const esProduccion = AFIP_PRODUCTION === "true";

  if (!AFIP_CUIT || !AFIP_ACCESS_TOKEN) {
    throw new Error(
      "Falta configurar AFIP_CUIT y/o AFIP_ACCESS_TOKEN en el .env — sin eso no se puede facturar."
    );
  }

  // El certificado de homologación y el de producción son DOS trámites
  // distintos en AFIP (se generan en portales separados) y NO son
  // intercambiables: un certificado de producción no autentica contra
  // los servidores de homologación, y viceversa. Por eso van en
  // variables de entorno separadas, elegidas automáticamente según
  // AFIP_PRODUCTION.
  const cert = esProduccion ? process.env.AFIP_CERT_PRODUCCION : process.env.AFIP_CERT_HOMOLOGACION;
  const key = esProduccion ? process.env.AFIP_KEY_PRODUCCION : process.env.AFIP_KEY_HOMOLOGACION;

  if (!cert || !key) {
    throw new Error(
      `Falta el certificado/clave de ${esProduccion ? "PRODUCCIÓN" : "HOMOLOGACIÓN"} en el .env ` +
        `(AFIP_CERT_${esProduccion ? "PRODUCCION" : "HOMOLOGACION"} / AFIP_KEY_${esProduccion ? "PRODUCCION" : "HOMOLOGACION"}).`
    );
  }

  return new Afip({
    CUIT: Number(AFIP_CUIT),
    cert: normalizarPem(cert),
    key: normalizarPem(key),
    access_token: AFIP_ACCESS_TOKEN,
    production: esProduccion,
  });
}

function fechaAfip(fecha) {
  // AFIP quiere la fecha como número YYYYMMDD (sin guiones)
  return parseInt(fecha.toISOString().slice(0, 10).replace(/-/g, ""), 10);
}

/**
 * Arma la URL del QR obligatorio en toda factura electrónica, según la
 * especificación de AFIP:
 * https://www.afip.gob.ar/fe/qr/documentos/QRespecificaciones.pdf
 */
function armarQrUrl({ fecha, cuit, ptoVta, nroCmp, importe, docTipo, docNro, cae }) {
  const payload = {
    ver: 1,
    fecha: fecha.toISOString().slice(0, 10),
    cuit: Number(cuit),
    ptoVta,
    tipoCmp: CBTE_TIPO_FACTURA_C,
    nroCmp,
    importe,
    moneda: MONEDA_PESOS,
    ctz: 1,
    tipoCodAut: "E",
    codAut: Number(cae),
  };
  // tipoDocRec/nroDocRec son opcionales — solo los mandamos si hay un
  // comprador identificado (si no, es consumidor final "a secas")
  if (docNro) {
    payload.tipoDocRec = docTipo;
    payload.nroDocRec = docNro;
  }

  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`;
}

/**
 * Emite una Factura C ante AFIP para el importe y comprador dados.
 * Devuelve los datos a guardar en la venta. Tira una excepción si AFIP
 * rechaza la solicitud o no se pudo contactar — quien llama decide qué
 * hacer con eso (acá NO se reintenta solo).
 */
async function emitirFacturaC({ importeTotal, docTipo = 99, docNro = 0 }) {
  const afip = getAfipClient();
  const ptoVta = Number(process.env.AFIP_PTO_VTA);
  if (!ptoVta) throw new Error("Falta configurar AFIP_PTO_VTA en el .env.");

  const ahora = new Date();

  // Factura C: no discrimina IVA (es el régimen típico de monotributo),
  // por eso ImpNeto = ImpTotal y no se manda el array de alícuotas de IVA.
  const data = {
    CantReg: 1,
    PtoVta: ptoVta,
    CbteTipo: CBTE_TIPO_FACTURA_C,
    Concepto: CONCEPTO_PRODUCTOS,
    DocTipo: docTipo,
    DocNro: docNro,
    CbteFch: fechaAfip(ahora),
    ImpTotal: importeTotal,
    ImpTotConc: 0,
    ImpNeto: importeTotal,
    ImpOpEx: 0,
    ImpIVA: 0,
    ImpTrib: 0,
    MonId: MONEDA_PESOS,
    MonCotiz: 1,
  };

  // createNextVoucher le pregunta a AFIP cuál es el próximo número real
  // para este punto de venta + tipo de comprobante, y lo usa — nunca
  // hace falta (ni se puede) fijar el número a mano.
  const res = await afip.ElectronicBilling.createNextVoucher(data);

  const qrUrl = armarQrUrl({
    fecha: ahora,
    cuit: process.env.AFIP_CUIT,
    ptoVta,
    nroCmp: res.voucher_number,
    importe: importeTotal,
    docTipo,
    docNro,
    cae: res.CAE,
  });

  return {
    tipoComprobante: CBTE_TIPO_FACTURA_C,
    puntoVenta: ptoVta,
    numero: res.voucher_number,
    cae: res.CAE,
    caeVencimiento: res.CAEFchVto,
    qrUrl,
    ambiente: process.env.AFIP_PRODUCTION === "true" ? "produccion" : "homologacion",
  };
}

module.exports = { emitirFacturaC };
