"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Datos del emisor. Cambiá estos textos si algo no es exacto (sobre todo
// CONDICION_IVA_EMISOR, que depende de tu situación real ante AFIP).
const NOMBRE_LOCAL = "LIBRERIA DOÑA CARMEN";
const CUIT_EMISOR = "27-25411345-5";
const DOMICILIO_EMISOR = "Barrio Pereyra Rozas Mza 636 casa 16 etapa 10";
const INICIO_ACTIVIDADES = "01/2026";
const CONDICION_IVA_EMISOR = "Responsable Monotributo";

function formatearFechaHora(fecha) {
  const d = new Date(fecha);
  return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function pad(numero, largo) {
  return String(numero ?? 0).padStart(largo, "0");
}

const METODO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" };

export default function FacturaImprimible({ venta }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const qrUrl = venta?.factura?.qrUrl;

  useEffect(() => {
    if (!qrUrl) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(qrUrl, { margin: 0, width: 160 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [qrUrl]);

  if (!venta) return null;

  const factura = venta.factura || {};
  const facturada = !!factura.cae;
  const subtotalItem = (it) => it.precioUnitario * it.cantidad - (it.descuento || 0);

  return (
    <div id="ticket-imprimible">
      <div
        style={{
          width: "72mm",
          maxWidth: "72mm",
          margin: "0 auto",
          padding: "4mm 0",
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#000",
          boxSizing: "border-box",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: "13px", fontWeight: "bold" }}>{NOMBRE_LOCAL}</div>
          <div>{DOMICILIO_EMISOR}</div>
          <div>CUIT: {CUIT_EMISOR}</div>
          <div>{CONDICION_IVA_EMISOR}</div>
          <div>Inicio de actividades: {INICIO_ACTIVIDADES}</div>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "4px 0" }} />

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <div style={{ fontSize: "13px", fontWeight: "bold" }}>{facturada ? "FACTURA C" : "COMPROBANTE DE VENTA"}</div>
          {facturada && (
            <div>
              Punto de Venta: {pad(factura.puntoVenta, 4)} &nbsp; Comp. N°: {pad(factura.numero, 8)}
            </div>
          )}
          <div>Fecha: {formatearFechaHora(venta.fecha)}</div>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

        <div style={{ marginBottom: 4 }}>
          {venta.clienteNombre ? (
            <div style={{ fontWeight: "bold" }}>{venta.clienteNombre}</div>
          ) : (
            <div style={{ fontWeight: "bold" }}>A CONSUMIDOR FINAL</div>
          )}
          {venta.docNro ? (
            <div>
              {venta.docTipo === 80 ? "CUIT" : "DNI"}: {venta.docNro}
            </div>
          ) : null}
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

        {venta.items.map((it, i) => (
          <div key={i} style={{ marginBottom: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{it.descripcion}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {it.cantidad} x ${it.precioUnitario.toFixed(2)}
                {it.descuento > 0 ? ` (desc. $${it.descuento.toFixed(2)})` : ""}
              </span>
              <span>${subtotalItem(it).toFixed(2)}</span>
            </div>
          </div>
        ))}

        <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px" }}>
          <span>TOTAL</span>
          <span>${venta.total.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <span>Forma de pago</span>
          <span>{METODO_LABEL[venta.metodoPago] || venta.metodoPago}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Condición de venta</span>
          <span>Contado</span>
        </div>

        <div style={{ borderTop: "1px solid #000", margin: "6px 0" }} />

        {facturada && (
          <>
            <div style={{ textAlign: "center" }}>
              <div>CAE N°: {factura.cae}</div>
              <div>Vto. CAE: {factura.caeVencimiento}</div>
              {factura.ambiente === "homologacion" && (
                <div style={{ fontWeight: "bold", marginTop: 2 }}>
                  *** COMPROBANTE DE PRUEBA (HOMOLOGACIÓN) ***
                </div>
              )}
            </div>
            {qrDataUrl && (
              <div style={{ textAlign: "center", marginTop: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR AFIP" style={{ width: 120, height: 120, margin: "0 auto" }} />
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: 4, fontSize: "9px" }}>Comprobante autorizado</div>
            <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
          </>
        )}

        <div style={{ textAlign: "center" }}>¡Gracias por su compra!</div>
      </div>
    </div>
  );
}
