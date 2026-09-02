# POS Librería

Sistema de punto de venta para librería: importa listas de precios en PDF de
distintos proveedores (columnas configurables por proveedor), arma el
inventario activo, permite vender por escáner de código de barras o botones
rápidos, actualiza precios masivamente reimportando el PDF con vista previa
comparativa, permite altas manuales, y da estadísticas de ventas con
ganancia bruta/neta y gráfico.

Stack: **Express + Node.js** (backend) · **Next.js App Router + Tailwind**
(frontend) · **MongoDB + Mongoose** (Atlas).

## ⚠️ Si ya venías usando una versión anterior de este proyecto

Hubo dos problemas distintos con la lectura de PDF en versiones
anteriores, ya corregidos acá:

1. **El motor de lectura del PDF partía palabras a la mitad.** Usaba la
   librería `pdf-parse` (JavaScript puro), que en algunos PDFs corta una
   misma palabra en varios fragmentos — por eso códigos como `LPL1000A`
   podían leerse como `0A`, o precios como `1769.08` podían leerse como
   `176908.00` (perdiendo el punto decimal en el corte). Esta versión usa
   `pdftotext` (poppler) en su lugar, que reconstruye cada palabra
   correctamente — ver el requisito de sistema más abajo.
2. **El proveedor "Martinez y Martinez" quedó con `decimalComma` en
   `true`** desde la primera versión (un valor que ya no correspondía),
   lo que también deformaba los precios. Se corrige así:

```bash
cd backend
npm run fix:parser   # corrige la configuración del proveedor
```

Después, para corregir los productos que ya se importaron con el precio
mal calculado, subí el mismo PDF de nuevo en **Actualizar precios**
(`/inventario/actualizar-precios`): va a comparar el precio viejo (mal)
contra el nuevo (bien calculado) para cada producto, y al aplicar la
actualización queda corregido. Si nunca usaste una versión anterior a
esta, podés ignorar todo este bloque (igual no está de más correr
`fix:parser` una vez, no hace nada si no hace falta).

## 1. Backend

### Requisito del sistema: poppler-utils

El parser de PDF usa el comando `pdftotext` (de poppler-utils) en vez de
una librería 100% JavaScript, porque es mucho más confiable para leer
correctamente números y códigos de PDFs exportados de Excel. Hace falta
tenerlo instalado en la máquina donde corre el backend:

```bash
# Linux (Debian/Ubuntu)
sudo apt-get install poppler-utils

# Mac
brew install poppler
```

Verificá que esté disponible con `pdftotext -v`. Sin esto, la importación
de PDF va a fallar.

```bash
cd backend
npm install
cp .env.example .env
```

Completá en `.env`:
- `MONGODB_URI`: connection string de tu cluster de MongoDB Atlas
- `JWT_SECRET`: cualquier string largo y random
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: el usuario con el que va a entrar tu mamá

```bash
npm run seed:admin      # crea el usuario de login
npm run seed:proveedor  # crea el proveedor "Martinez y Martinez"
npm run dev             # http://localhost:4000
```

El servidor loguea en consola todas las peticiones HTTP que recibe (con
`morgan`), útil para debuggear qué está pidiendo el frontend.

## 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev              # http://localhost:3000
```

## 3. Flujo de uso

1. **Login** con el usuario/contraseña del `.env`.
2. **Inventario** (`/inventario`): elegís el proveedor, subís el PDF de la
   lista de precios, y en la vista previa **buscás por nombre y tildás
   solo lo que realmente tenés** (todo arranca destildado — con miles de
   productos por PDF es mucho más rápido así que destildar uno por uno).
3. **Categorías** (`/inventario/categorias`): creás las categorías que
   quieras (Librería, Papelería, Mercería, Regalería, Fotocopias…) desde
   un formulario simple. Después las elegís al agregar un producto manual,
   o se las cambiás a cualquier producto ya cargado desde Inventario
   completo. Cada categoría tiene un link "Ver productos" para consultar
   rápido qué tiene cargado.
4. **Inventario completo** (`/inventario/productos`): tabla con todos los
   productos (de cualquier origen) para consultar y **editar precio, margen
   y stock directamente** (los tres se recalculan entre sí, igual que en
   alta manual), vincular un **código de barras real** si el producto lo
   tiene, marcar cuáles aparecen como **acceso rápido** en el POS, y
   **cambiar la categoría** de cualquier producto con un click. Se busca
   por descripción, código de proveedor o código de barras, se puede
   filtrar por categoría, y se puede ordenar por costo, precio o stock
   tocando el encabezado de esa columna. Todo precio de venta redondea
   solo a múltiplo de $10 (para arriba, nunca se pierde margen) — ya no
   circulan monedas.

   Desde acá también está el botón **"Ajustar todos los precios"**: sube o
   baja el precio de venta de todos los productos activos un mismo
   porcentaje de una sola vez (por ej. +2.1% para acompañar la inflación
   mensual, o negativo para bajar precios), con un paso de confirmación
   antes de aplicarlo.

   *Sobre el código de barras:* no es obligatorio. Para vender un producto
   alcanza con el código que ya trae el PDF del proveedor (se busca
   automáticamente en el POS). Este campo es solo para cuando un producto
   tiene impreso un código de barras real: hacé click adentro, escaneá con
   la pistola (el lector escribe el número y presiona Enter solo) o
   escribilo a mano.
5. **Actualizar precios** (`/inventario/actualizar-precios`): cuando el
   mismo proveedor manda una lista nueva, la subís acá. Se compara cada
   código contra lo que ya tenés activo. Las tarjetas de resumen (y la
   barra de filtros debajo) funcionan como filtro con un click: "Suben",
   "Bajan", "Sin cambios" o "No agregados". Los que suben vienen
   pre-tildados; los que bajan quedan sin tildar para revisarlos antes de
   bajar un precio en el mostrador. El margen de cada producto se edita
   fila por fila (no hay un margen global que se aplique a todos, porque
   en la práctica cada categoría suele manejarse distinto). Los "No
   agregados" (nuevos en el PDF) se pueden tildar y dar de alta
   directamente ahí mismo, con margen editable.
6. **Alta manual** (`/inventario/manual`): para productos que se compran
   por fuera de los mayoristas habituales. Margen y precio de venta se
   recalculan solos sin importar cuál de los dos edites, e incluye stock
   inicial. Después de guardar, la página queda lista para cargar el
   siguiente producto.
7. **Punto de venta** (`/pos`): escaneás productos, los **buscás por
   nombre** (con Enter agregás el primer resultado), o usás los botones de
   acceso rápido (los que marcaste en Inventario completo). Si un producto
   no tiene stock cargado, se avisa pero igual se puede vender. Ajustás
   cantidades/descuentos y cobrás en efectivo, transferencia o tarjeta —
   el stock de cada producto vendido se descuenta solo. Después de cobrar
   aparece un botón **"Imprimir ticket"** que manda la impresión directo a
   la térmica. *(La facturación electrónica AFIP está pausada por ahora
   mientras se resuelve un tema de certificados — ver la sección
   correspondiente más abajo. Mientras tanto se imprime un ticket simple,
   sin CAE ni QR.)*
8. **Cierre de caja** (`/cierre`): totales del día agrupados por método de
   pago, con selector de fecha para consultar cualquier día anterior.
   Abajo, el **historial de ventas** de ese día con la hora de cada una —
   si alguna está mal, se puede eliminar directamente (pide confirmación)
   y el stock que esa venta había descontado se repone solo.
9. **Estadísticas** (`/estadisticas`): ventas, costo de mercadería, ganancia
   bruta y neta (ya descontando los gastos que cargues ahí mismo), margen
   promedio y un gráfico de ventas/ganancia por día — cada KPI tiene un
   ícono con tooltip explicando qué significa. Más abajo, un ranking de
   **productos más vendidos** en el período (con el stock actual de cada
   uno) para saber qué reponer antes de quedarte sin stock. Rango: hoy,
   últimos 7 o últimos 30 días.

## Facturación electrónica AFIP (Factura C) e impresión

⚠️ **Pausada por ahora** (`AFIP_ENABLED=false` en el `.env`, que es el
default): mientras se termina de resolver un problema de certificados con
AFIP, el POS imprime un ticket simple (sin CAE ni QR) y no intenta
facturar nada. Todo el código de esta sección sigue andando y quedó
listo para cuando se retome — para activarlo de nuevo alcanza con poner
`AFIP_ENABLED=true` (además de las otras variables de más abajo, que ya
tienen que estar completas).

Cuando está activa: cada venta que se cobra en `/pos` se factura
automáticamente ante AFIP (Factura C) usando `@afipsdk/afip.js`. El cobro
es **instantáneo** — no espera a AFIP para confirmarse — y la factura se
emite en segundo plano mientras la pantalla muestra "Emitiendo
factura…". El botón "Imprimir factura" imprime esa factura (con CAE y
QR) en la térmica, con el mismo mecanismo de `window.print()` de antes —
no instala nada.

### Configuración necesaria (antes de que esto funcione)

Esto requiere pasos previos en el portal de AFIP que **solo vos podés
hacer** (no es algo que el código resuelva):

1. Tener un **Punto de Venta dado de alta como "Facturación Electrónica"
   (Web Services)** en AFIP — ya lo tenés, es el n° 2.
2. Tener el **certificado digital** (`.crt` y `.key`) para Facturación
   Electrónica con ese CUIT — **uno para producción y otro para
   homologación** (son trámites separados, en portales distintos: el de
   producción en el sitio normal de AFIP, el de homologación en
   `wsaahomo.afip.gov.ar`). Mezclarlos da error 400 — fue justo lo que
   pasó la primera vez que se probó esto.
3. Una cuenta en [afipsdk.com](https://app.afipsdk.com) con un
   **access_token** — la librería que uso lo necesita para manejar la
   autenticación con AFIP (WSAA) por vos. Tiene plan gratuito (1.000
   pedidos/mes), de sobra para una librería.

Con eso, completá en `backend/.env`:

```
AFIP_PRODUCTION=false        # false = homologación (pruebas), true = real
AFIP_CUIT=27254113455
AFIP_PTO_VTA=2
AFIP_ACCESS_TOKEN=<tu access_token de afipsdk.com>

AFIP_CERT_HOMOLOGACION=<contenido del certificado de homologación>
AFIP_KEY_HOMOLOGACION=<contenido de la clave de homologación>

AFIP_CERT_PRODUCCION=<contenido del certificado de producción>
AFIP_KEY_PRODUCCION=<contenido de la clave de producción>
```

El sistema elige automáticamente el par de certificado/clave según
`AFIP_PRODUCTION` — no hace falta tocar nada más al cambiar de ambiente.

Para pegar el certificado/clave: se puede pegar el contenido completo
del archivo, o todo en una sola línea reemplazando cada salto de línea
por `\n` (dos caracteres, barra + n) — el código ya lo convierte solo
(ver `normalizarPem` en `backend/src/services/afipService.js`).

**Recomendación fuerte: dejá `AFIP_PRODUCTION=false` (homologación)
hasta haber hecho varias ventas de prueba** y confirmar que la factura
sale bien, el CAE se autoriza y el QR escanea correctamente. En
homologación las facturas no tienen validez fiscal real — el ticket lo
va a aclarar bien grande ("COMPROBANTE DE PRUEBA"). Cuando estés
conforme, cambiá `AFIP_PRODUCTION=true` y listo.

### Cómo funciona (por si algo falla)

- El número de cada factura **no lo inventa el sistema**: en cada venta
  se le pregunta a AFIP cuál es el próximo número real
  (`createNextVoucher`), así que arranca donde corresponda según el
  historial real de ese punto de venta — no hay forma de "elegir" un
  número de arranque, AFIP lo controla.
- El cobro se confirma de inmediato (venta guardada, stock descontado) y
  la factura se pide a AFIP en segundo plano — el frontend consulta
  `GET /api/sales/:id` cada 1.5s hasta que aparece el CAE (o un error).
  Si AFIP está caído o rechaza la solicitud, **la venta ya quedó cobrada
  igual** (no se traba el mostrador) — queda guardada sin CAE, y aparece
  un botón **"Reintentar factura"**.
- El botón "Imprimir factura" queda deshabilitado hasta que llega el CAE
  — a propósito: imprimir una factura sin CAE ni QR sería entregar un
  comprobante fiscal incompleto. Si en algún momento preferís poder
  imprimir antes (por ejemplo para no hacer esperar al cliente en el
  mostrador) avisame y lo cambiamos a que imprima un comprobante
  "provisorio" mientras se resuelve.
- Por default, todas las ventas son "A Consumidor Final". Si un cliente
  pide la factura a su nombre, hay un campo opcional "Facturar a nombre
  de un cliente" en el POS: se busca por nombre o DNI/CUIT entre los ya
  cargados, o se carga uno nuevo al vuelo (con la opción de guardarlo
  para la próxima vez). Se maneja con una colección propia de clientes
  (`backend/src/models/Customer.js`) — AFIP en sí no pide ni devuelve un
  nombre, así que ese dato es solo para que la factura impresa diga a
  quién corresponde.

### Impresión

Al hacer click en "Imprimir factura", el navegador abre el diálogo de
impresión, y el CSS (`app/globals.css`) hace que se vea **solo la
factura** (no el resto de la pantalla del POS), centrada y recortada al
ancho de 80mm, con el QR generado en el momento (librería `qrcode`).

Para que salga bien en la OCPP-80T (o cualquier térmica de 80mm):
- En el diálogo de impresión del navegador, elegí esa impresora como
  destino.
- Desactivá "Encabezados y pies de página" si tu navegador los agrega por
  defecto (Chrome: más opciones → destildar esa casilla). Es una
  configuración del navegador, no hace falta repetirla cada vez, queda
  guardada.
- Márgenes en "Ninguno" o "Mínimo".

Los datos del local que aparecen en la factura (nombre, CUIT, domicilio,
condición de IVA, inicio de actividades) son constantes fijas al
principio de `frontend/components/FacturaImprimible.js` — ya están
completados con tus datos, pero **revisá especialmente
`CONDICION_IVA_EMISOR`** ("Responsable Monotributo" por ahora): si tu
situación real ante AFIP es otra, cambiala ahí.

## Multi-proveedor: cómo funciona el parser

Cada proveedor (`Supplier`) guarda en `parserConfig.columnHeaders` el
nombre EXACTO de cada columna tal como aparece en el encabezado de SU PDF
(ej: `{ familia: "FAMILIA", descripcion: "Descripción", codigo: "Código",
costo: "2.Cliente" }`). El parser (`backend/src/parsers/pdfParser.js`)
corre `pdftotext -bbox` (poppler) sobre el PDF, que devuelve cada palabra
con su posición exacta ya reconstruida correctamente (a diferencia de
librerías de PDF en JavaScript puro, que en ciertos PDFs pueden partir una
palabra en varios fragmentos), y con eso:

1. Encontrar el renglón de encabezado en cada página (se repite página a
   página) y determinar en qué ORDEN aparecen las columnas configuradas
   (no la posición exacta en píxeles, que en PDFs exportados de Excel casi
   nunca coincide con el inicio real del contenido de la columna).
2. En cada renglón de datos: el último token de la fila es el costo (si
   tiene forma de número), el token inmediatamente anterior es el código
   de producto (aunque sea puramente numérico — es un caso real en la
   lista de Martinez y Martinez), y si hay columna de familia configurada
   como primera columna, el primer token es la familia. Todo lo que queda
   en el medio es la descripción.

Esto se validó contra un PDF real de Martinez y Martinez (122 páginas,
8751 productos): **8746 se leyeron bien (99.94%)**, y los 5 que fallaron
son un problema real de esa página del PDF de origen (texto solapado en la
última familia, "BANDEJAS PARA HUEVO") — quedan reportados como "líneas
sin parsear" en vez de inventar un dato.

### Sumar un proveedor nuevo con columnas distintas

No hace falta tocar código. Se crea vía API con las columnas de ESE PDF:

```bash
curl -X POST http://localhost:4000/api/suppliers \
  -H "Authorization: Bearer <tu token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Otro Mayorista",
    "defaultMargin": 0.4,
    "parserConfig": {
      "columnHeaders": {
        "familia": null,
        "descripcion": "Producto",
        "codigo": "SKU",
        "costo": "Precio Lista"
      },
      "decimalComma": true
    }
  }'
```

Y para ajustar uno que ya existe (ej. si Martinez y Martinez cambia el
nombre de una columna en una lista futura):

```bash
curl -X PATCH http://localhost:4000/api/suppliers/<id>/parser \
  -H "Authorization: Bearer <tu token>" \
  -H "Content-Type: application/json" \
  -d '{ "parserConfig": { "columnHeaders": { "costo": "Precio Mayorista" } } }'
```

## Desplegar en producción: backend en Railway, frontend en Vercel

**Backend (Railway):**
1. Creá un servicio nuevo en Railway apuntando a este repo, con la
   **carpeta raíz del servicio en `/backend`** (importante: es un
   monorepo, Railway tiene que saber que el código está ahí adentro).
2. Railway va a detectar el `Dockerfile` de `/backend` automáticamente y
   construir la imagen con él — ese Dockerfile instala `poppler-utils`
   solo, así que no hay nada manual que hacer para que `pdftotext`
   funcione en producción.
3. En las variables de entorno del servicio (panel de Railway, no
   `.env`), cargá las mismas que en `.env.example`: `MONGODB_URI`,
   `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, y `FRONTEND_URL`
   (poné acá la URL que te dé Vercel, para que el CORS funcione).
4. Los scripts de seed (`npm run seed:admin`, `npm run seed:proveedor`,
   `npm run fix:parser`) se corren una vez desde la terminal que Railway
   te da para el servicio (botón "Shell" o similar en su panel).

**Frontend (Vercel):**
1. Importá el repo en Vercel con el **root directory en `/frontend`**.
2. Variable de entorno: `NEXT_PUBLIC_API_URL` apuntando a la URL pública
   que te dé Railway para el backend (algo como
   `https://tu-proyecto.up.railway.app/api`).
3. Deploy — Next.js es exactamente para lo que Vercel está pensado, no
   hace falta nada especial acá.

## Qué ampliaría primero

1. Una pantalla en el frontend para crear/editar proveedores y sus columnas
   (hoy es vía API/curl, como se ve arriba).
2. Vista para editar a mano las líneas que el parser no pudo leer, en vez
   de solo reportarlas.
3. Alertas de stock bajo (ej. avisar en Inventario completo cuando un
   producto queda por debajo de cierto mínimo, no solo cuando llega a 0).
4. Persistir el carrito del POS en el navegador, para no perder una venta
   en curso si se recarga la página.
5. El ranking de productos más vendidos hoy es general — se podría filtrar
   por familia o por proveedor.
