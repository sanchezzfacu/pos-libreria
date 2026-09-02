"use client";
import { useCallback, useEffect, useState } from "react";
import NavBar from "../../components/NavBar";
import { api } from "../../lib/api";

const FILAS = [
  { key: "efectivo", label: "Efectivo", color: "text-cash" },
  { key: "transferencia", label: "Transferencia / QR", color: "text-transfer" },
  { key: "tarjeta", label: "Tarjeta", color: "text-card" },
];

const METODO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" };

function hoyISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function resumenItems(items) {
  const texto = items.map((it) => `${it.cantidad}× ${it.descripcion}`).join(", ");
  return texto.length > 60 ? `${texto.slice(0, 60)}…` : texto;
}

export default function CierrePage() {
  const [fecha, setFecha] = useState(hoyISO());
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [confirmandoId, setConfirmandoId] = useState(null);
  const [eliminando, setEliminando] = useState(false);

  const esHoy = fecha === hoyISO();

  const cargar = useCallback(async () => {
    setError("");
    try {
      const resultado = await api(`/sales/by-date?date=${fecha}`);
      setData(resultado);
    } catch (err) {
      setError(err.message);
    }
  }, [fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function eliminarVenta(id) {
    setEliminando(true);
    setAviso("");
    try {
      await api(`/sales/${id}`, { method: "DELETE" });
      setAviso("Venta eliminada. El stock vendido se repuso solo.");
      setConfirmandoId(null);
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <p className="font-mono text-xs tracking-widest text-stamp-500 uppercase mb-1">
              {esHoy
                ? "Hoy"
                : new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
            </p>
            <h1 className="text-2xl font-semibold text-ink-900">Cierre de caja</h1>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        {aviso && <p className="text-cash text-sm mb-4">{aviso}</p>}

        {data && (
          <>
            <div className="card mb-6">
              <p className="text-sm text-ink-400 mb-4">
                {data.resumen.cantidadVentas} venta{data.resumen.cantidadVentas !== 1 ? "s" : ""} registrada
                {data.resumen.cantidadVentas !== 1 ? "s" : ""} {esHoy ? "hoy" : "ese día"}
              </p>

              <div className="divide-y divide-ink-50">
                {FILAS.map((f) => (
                  <div key={f.key} className="flex items-center justify-between py-3">
                    <span className={`font-medium ${f.color}`}>{f.label}</span>
                    <span className="price text-lg">${data.resumen[f.key].toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-dashed border-ink-200 mt-2 pt-4 flex items-baseline justify-between">
                <span className="font-semibold text-ink-900 uppercase tracking-wide text-sm">Total del día</span>
                <span className="price text-3xl font-semibold text-ink-900">
                  ${data.resumen.totalGeneral.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="card">
              <h2 className="font-semibold text-ink-900 mb-1">Historial de ventas</h2>
              <p className="text-sm text-ink-400 mb-4">
                Si te equivocaste en una venta, la podés eliminar — el stock vendido se repone solo.
              </p>

              {data.ventas.length === 0 ? (
                <p className="text-sm text-ink-400 py-6 text-center">No hay ventas registradas ese día.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-ink-50">
                  <table className="table-ledger w-full min-w-[560px]">
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Ítems</th>
                        <th>Método</th>
                        <th className="text-right">Total</th>
                        <th className="w-40"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.ventas].reverse().map((v) => (
                        <tr key={v._id}>
                          <td className="price text-ink-400">
                            {new Date(v.createdAt).toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="text-ink-900">{resumenItems(v.items)}</td>
                          <td className="text-ink-600">{METODO_LABEL[v.metodoPago]}</td>
                          <td className="price text-right font-semibold">${v.total.toFixed(2)}</td>
                          <td className="text-right">
                            {confirmandoId === v._id ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => eliminarVenta(v._id)}
                                  disabled={eliminando}
                                  className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded px-2 py-1"
                                >
                                  Confirmar
                                </button>
                                <button
                                  onClick={() => setConfirmandoId(null)}
                                  className="text-xs text-ink-400 hover:text-ink-700 px-2 py-1"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmandoId(v._id)}
                                className="text-xs text-ink-300 hover:text-red-500"
                              >
                                Eliminar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
