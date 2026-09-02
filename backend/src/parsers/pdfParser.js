const { execFile } = require("child_process");
const util = require("util");

const execFileAsync = util.promisify(execFile);

/**
 * IMPORTANTE — por qué este parser usa "pdftotext" (poppler) en vez de la
 * librería pdf-parse/pdf.js: pdf.js puede partir una misma palabra en
 * varios "items" de texto (por kerning o ajustes internos del PDF), lo
 * que rompía códigos y precios en ciertos PDFs reales (ej: "LPL1000A" se
 * leía como "0A", o "1769.08" se leía como "176908.00" al perderse el
 * punto decimal). "pdftotext -bbox" (parte de poppler-utils, la misma
 * herramienta detrás de comandos como `pdftotext -layout`) devuelve cada
 * palabra ya reconstruida correctamente con su posición exacta, y es
 * mucho más confiable para este tipo de extracción.
 *
 * Esto significa que el servidor necesita tener instalado poppler-utils
 * (el comando `pdftotext`). En Linux/Debian/Ubuntu: `apt-get install
 * poppler-utils`. En Mac: `brew install poppler`. Ver el README para más
 * detalle.
 */

function parsePrice(raw, decimalComma) {
  let clean = raw.trim().replace(/\$/g, "").replace(/\s/g, "");
  if (decimalComma) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else {
    clean = clean.replace(/,/g, "");
  }
  const value = parseFloat(clean);
  return Number.isFinite(value) ? value : null;
}

function normalizar(texto) {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const WORD_TAG_RE = /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g;
const PRICE_TOKEN_RE = /^\$?[0-9][0-9.,]*[0-9]$|^\$?[0-9]$/;

/**
 * Corre "pdftotext -bbox" sobre el PDF (recibido como Buffer, se lo
 * pasamos por stdin) y devuelve el XML con la posición de cada palabra.
 * Es asíncrono (no bloquea el event loop) aunque por dentro use un
 * proceso hijo.
 */
function extraerXmlBbox(fileBuffer) {
  const promesa = execFileAsync("pdftotext", ["-bbox", "-", "-"], {
    maxBuffer: 1024 * 1024 * 200,
    encoding: "utf8",
  });
  // execFileAsync ya lanzó el proceso; le escribimos el PDF por stdin.
  promesa.child.stdin.on("error", () => {}); // evita crashear si el proceso corta stdin antes de tiempo
  promesa.child.stdin.write(fileBuffer);
  promesa.child.stdin.end();
  return promesa.then((r) => r.stdout);
}

/**
 * Agrupa las palabras de una página en "renglones" según su coordenada Y
 * (con tolerancia, porque distintas columnas de un mismo renglón no
 * siempre comparten exactamente el mismo Y).
 */
function agruparEnRenglones(items, toleranciaY = 2.5) {
  const ordenados = [...items].sort((a, b) => a.y - b.y);
  const renglones = [];

  for (const item of ordenados) {
    const ultimo = renglones[renglones.length - 1];
    if (ultimo && Math.abs(ultimo.y - item.y) <= toleranciaY) {
      ultimo.items.push(item);
      ultimo.y = (ultimo.y + item.y) / 2;
    } else {
      renglones.push({ y: item.y, items: [item] });
    }
  }

  for (const r of renglones) r.items.sort((a, b) => a.x - b.x);
  return renglones;
}

/**
 * Busca, dentro de un renglón, el texto de cada columna configurada y
 * devuelve el ORDEN de izquierda a derecha en que aparecen (no la
 * posición X exacta: en PDFs exportados de Excel el encabezado no
 * siempre arranca en el mismo X que el contenido real de la columna).
 */
function detectarOrdenColumnas(renglon, columnHeaders) {
  const objetivos = Object.entries(columnHeaders)
    .filter(([, label]) => !!label)
    .map(([campo, label]) => [campo, normalizar(label)]);

  const indices = {};
  for (const [campo, labelNorm] of objetivos) {
    const item = renglon.items.find((it) => normalizar(it.str).includes(labelNorm));
    if (item) indices[campo] = item.x;
  }

  if (indices.descripcion === undefined || indices.codigo === undefined || indices.costo === undefined) {
    return null;
  }

  return Object.entries(indices)
    .sort((a, b) => a[1] - b[1])
    .map(([campo]) => campo);
}

/**
 * Interpreta los tokens (palabras, en orden izquierda->derecha) de un
 * renglón de datos. El costo es siempre el último token (si parece un
 * número), y el código de proveedor el token inmediatamente anterior —
 * así sea puramente numérico, que es un caso real en algunas listas. La
 * familia (si está configurada como primera columna) es el primer token
 * restante. Todo lo que queda en el medio es la descripción.
 */
function parsearRenglon(tokens, orden) {
  if (tokens.length < 3) return null;

  const ultimo = tokens[tokens.length - 1];
  if (!PRICE_TOKEN_RE.test(ultimo)) return null;

  const costoTok = ultimo;
  const codigoTok = tokens[tokens.length - 2];
  let resto = tokens.slice(0, -2);

  const campos = { costo: costoTok, codigo: codigoTok };

  if (orden.includes("familia") && resto.length >= 1) {
    const posFamilia = orden.indexOf("familia");
    const posDescripcion = orden.indexOf("descripcion");
    if (posFamilia < posDescripcion) {
      campos.familia = resto[0];
      resto = resto.slice(1);
    } else {
      campos.familia = resto[resto.length - 1];
      resto = resto.slice(0, -1);
    }
  }

  campos.descripcion = resto.join(" ").trim();
  return campos;
}

/**
 * Extrae candidatos a producto de un PDF usando la configuración de
 * columnas del proveedor. Devuelve { items, errores, totalLineas }.
 */
async function parseSupplierPdf(fileBuffer, supplier) {
  const { columnHeaders, decimalComma } = supplier.parserConfig;

  let xml;
  try {
    xml = await extraerXmlBbox(fileBuffer);
  } catch (err) {
    console.error("[pdfParser] Error corriendo pdftotext:", err.message);
    throw new Error(
      "No se pudo leer el PDF con pdftotext. Verificá que poppler-utils esté instalado en el servidor " +
        "(`pdftotext -v`) y que el archivo sea un PDF de texto válido."
    );
  }

  // El XML trae un bloque <page ...> por cada página; los separamos para
  // no mezclar renglones de páginas distintas que compartan coordenada Y.
  const bloquesPagina = xml.split(/<page /).slice(1);

  const items = [];
  const errores = [];
  let totalLineas = 0;
  let orden = null;

  for (const bloque of bloquesPagina) {
    const palabras = [];
    const regex = new RegExp(WORD_TAG_RE);
    let m;
    while ((m = regex.exec(bloque)) !== null) {
      palabras.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), str: decodeEntities(m[5]) });
    }

    const renglones = agruparEnRenglones(palabras);

    for (const renglon of renglones) {
      const posibleOrden = detectarOrdenColumnas(renglon, columnHeaders);
      if (posibleOrden) {
        orden = posibleOrden;
        continue; // es un renglón de encabezado (se repite en cada página), no un dato
      }
      if (!orden) continue; // todavía no encontramos ningún encabezado (portada, etc.)

      totalLineas += 1;
      const tokens = renglon.items.map((it) => it.str);
      const campos = parsearRenglon(tokens, orden);

      if (!campos || !campos.descripcion || !campos.codigo) {
        errores.push(tokens.join(" "));
        continue;
      }

      const costo = parsePrice(campos.costo, decimalComma);
      if (costo === null) {
        errores.push(tokens.join(" "));
        continue;
      }

      items.push({
        familia: (campos.familia || "SIN FAMILIA").trim(),
        descripcion: campos.descripcion,
        codigoProveedor: campos.codigo.toUpperCase(),
        costo,
      });
    }
  }

  return { items, errores, totalLineas };
}

module.exports = { parseSupplierPdf, parsePrice };
