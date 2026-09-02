"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "../../../components/NavBar";
import { api } from "../../../lib/api";
import { redondearPrecio } from "../../../lib/pricing";

function badgeClase(pct) {
  if (pct > 0) return "bg-red-50 text-red-700";
  if (pct < 0) return "bg-cash/10 text-cash";
  return "bg-ink-50 text-ink-400";
}

const FILTROS = [
  { key: "todas", label: "Todas" },
  { key: "increased", label: "Suben" },
  { key: "decreased", label: "Bajan" },
  { key: "unchanged", label: "Sin cambios" },
  { key: "unregistered", label: "No agregados" },
];

export default function ActualizarPreciosPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const [resumen, setResumen] = useState(null);
  const [filas, setFilas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todas");

  // Productos nuevos en el PDF, todavía no activos — se pueden dar de alta
  // directamente desde acá (misma mecánica que la vista previa de Inventario).
  const [filasNuevos, setFilasNuevos] = useState([]);
  const [margenNuevos, setMargenNuevos] = useState(45);

  useEffect(() => {
    api("/suppliers").then(setSuppliers).catch(() => {});
  }, []);

  async function handleAnalizar() {
    if (!supplierId || !file) return;
    setLoading(true);
    setError("");
    setAviso("");
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const data = await api(`/api/suppliers/${supplierId}/preview-update`, {
        method: "POST",
        body: formData,
        isFormData: true,
      });

      setResumen(data.resumen);
      setFiltroEstado("todas");

      const combinadas = [
        ...data.increased.map((f) => ({ ...f, estado: "increased" })),
        ...data.decreased.map((f) => ({ ...f, estado: "decreased" })),
        ...data.unchanged.map((f) => ({ ...f, estado: "unchanged" })),
      ].map((f) => ({
        ...f,
        margenPct: Math.round(f.margen * 100),
        selected: f.preseleccionado,
      }));
      setFilas(combinadas);

      const supplierElegido = suppliers.find((s) => s._id === supplierId);
      const margenDefault = Math.round((supplierElegido?.defaultMargin ?? 0.45) * 100);
      setMargenNuevos(margenDefault);
      setFilasNuevos(
        data.unregistered.map((u) => ({
          ...u,
          margenPct: margenDefault,
          precioVenta: redondearPrecio(u.costo * (1 + margenDefault / 100)),
          selected: false,
        }))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function actualizarFila(codigoProveedor, cambios) {
    setFilas((prev) =>
      prev.map((f) => (f.codigoProveedor === codigoProveedor ? { ...f, ...cambios } : f))
    );
  }

  function onEditarCosto(fila, valor) {
    const nuevoCosto = Number(valor);
    const nuevaVenta = redondearPrecio(nuevoCosto * (1 + fila.margenPct / 100));
    actualizarFila(fila.codigoProveedor, { newCostPrice: nuevoCosto, newSellingPrice: nuevaVenta });
  }

  function onEditarMargen(fila, valor) {
    const nuevoMargen = Number(valor);
    const nuevaVenta = redondearPrecio(fila.newCostPrice * (1 + nuevoMargen / 100));
    actualizarFila(fila.codigoProveedor, { margenPct: nuevoMargen, newSellingPrice: nuevaVenta });
  }

  function toggleTodos(checked) {
    setFilas((prev) =>
      prev.map((f) => (filtroEstado === "todas" || f.estado === filtroEstado ? { ...f, selected: checked } : f))
    );
  }

  // --- productos nuevos (no agregados) ---
  function actualizarFilaNuevo(codigoProveedor, cambios) {
    setFilasNuevos((prev) =>
      prev.map((f) => (f.codigoProveedor === codigoProveedor ? { ...f, ...cambios } : f))
    );
  }

  function onEditarMargenNuevo(fila, valor) {
    const nuevoMargen = Number(valor);
    const nuevoPrecio = redondearPrecio(fila.costo * (1 + nuevoMargen / 100));
    actualizarFilaNuevo(fila.codigoProveedor, { margenPct: nuevoMargen, precioVenta: nuevoPrecio });
  }

  function recalcularNuevosConMargenGlobal() {
    setFilasNuevos((prev) =>
      prev.map((f) => ({
        ...f,
        margenPct: margenNuevos,
        precioVenta: redondearPrecio(f.costo * (1 + margenNuevos / 100)),
      }))
    );
  }

  function toggleTodosNuevos(checked) {
    setFilasNuevos((prev) => prev.map((f) => ({ ...f, selected: checked })));
  }

  async function agregarNuevosSeleccionados() {
    const seleccionados = filasNuevos.filter((f) => f.selected);
    if (seleccionados.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const items = seleccionados.map((f) => ({
        familia: f.familia,
        descripcion: f.descripcion,
        codigoProveedor: f.codigoProveedor,
        costo: f.costo,
      }));
      const data = await api("/api/products/bulk-activate", {
        method: "POST",
        body: { supplierId, margen: margenNuevos / 100, items },
      });
      setAviso(`${data.creados} productos nuevos agregados al inventario.`);
      const codigosAgregados = new Set(seleccionados.map((f) => f.codigoProveedor));
      setFilasNuevos((prev) => prev.filter((f) => !codigosAgregados.has(f.codigoProveedor)));
      setResumen((r) => (r ? { ...r, unregistered: r.unregistered - seleccionados.length } : r));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filasVisibles = filas.filter((f) => filtroEstado === "todas" || f.estado === filtroEstado);
  const seleccionadas = filas.filter((f) => f.selected);
  const seleccionadasVisibles = filasVisibles.filter((f) => f.selected);
  const todasVisiblesSeleccionadas = filasVisibles.length > 0 && seleccionadasVisibles.length === filasVisibles.length;
  const seleccionadosNuevos = filasNuevos.filter((f) => f.selected);

  function cancelar() {
    setFilas([]);
    setFilasNuevos([]);
    setResumen(null);
    setFile(null);
    setFiltroEstado("todas");
  }

  async function aplicarActualizacion() {
    if (seleccionadas.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const updates = seleccionadas.map((f) => ({
        productId: f.productId,
        newCostPrice: f.newCostPrice,
        newMargin: f.margenPct / 100,
        newSellingPrice: f.newSellingPrice,
      }));
      const data = await api("/api/products/apply-price-update", { method: "POST", body: { updates } });
      setAviso(`${data.actualizados} productos actualizados en la caja.`);
      const codigosAplicados = new Set(seleccionadas.map((f) => f.codigoProveedor));
      setFilas((prev) => prev.filter((f) => !codigosAplicados.has(f.codigoProveedor)));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const mostrandoNuevos = filtroEstado === "unregistered";

  return (
    <div className="min-h-screen bg-paper pb-24">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Link href="/inventario" className="text-sm text-ink-400 hover:text-ink-700">
          ← Volver a Inventario
        </Link>

        <div>
          <p className="font-mono text-xs tracking-widest text-stamp-500 uppercase mb-1">
            Catálogo mayorista
          </p>
          <h1 className="text-2xl font-semibold text-ink-900">Actualizar precios por PDF</h1>
          <p className="text-sm text-ink-400 mt-1">
            Subí la nueva lista de precios del proveedor y revisá los cambios antes de aplicarlos.
          </p>
        </div>

        <div className="card">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Proveedor</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="input min-w-[220px]"
              >
                <option value="">Elegí un proveedor…</option>
                {suppliers.map((s) => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">
                Nueva lista (PDF)
              </label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="text-sm text-ink-600 file:mr-3 file:btn-ghost file:border-0"
              />
            </div>
            <button onClick={handleAnalizar} disabled={!supplierId || !file || loading} className="btn-primary">
              {loading && filas.length === 0 ? "Analizando…" : "Analizar PDF de precios"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600 mt-3 border-t border-ink-50 pt-3">{error}</p>}
          {aviso && <p className="text-sm text-cash mt-3 border-t border-ink-50 pt-3">{aviso}</p>}
        </div>

        {resumen && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setFiltroEstado("increased")}
                className={`card !p-4 text-left bg-red-50/60 border-red-100 transition-transform ${filtroEstado === "increased" ? "ring-2 ring-red-300" : "hover:-translate-y-0.5"}`}
              >
                <p className="text-2xl font-semibold text-red-700 price">{resumen.increased}</p>
                <p className="text-xs text-red-700/80 mt-0.5">Productos aumentan</p>
              </button>
              <button
                onClick={() => setFiltroEstado("decreased")}
                className={`card !p-4 text-left bg-cash/5 border-cash/20 transition-transform ${filtroEstado === "decreased" ? "ring-2 ring-cash/40" : "hover:-translate-y-0.5"}`}
              >
                <p className="text-2xl font-semibold text-cash price">{resumen.decreased}</p>
                <p className="text-xs text-cash/80 mt-0.5">Productos bajan</p>
              </button>
              <button
                onClick={() => setFiltroEstado("unchanged")}
                className={`card !p-4 text-left bg-ink-50 border-ink-100 transition-transform ${filtroEstado === "unchanged" ? "ring-2 ring-ink-300" : "hover:-translate-y-0.5"}`}
              >
                <p className="text-2xl font-semibold text-ink-600 price">{resumen.unchanged}</p>
                <p className="text-xs text-ink-400 mt-0.5">Sin cambios</p>
              </button>
              <button
                onClick={() => setFiltroEstado("unregistered")}
                className={`card !p-4 text-left bg-transfer/5 border-transfer/20 transition-transform ${filtroEstado === "unregistered" ? "ring-2 ring-transfer/40" : "hover:-translate-y-0.5"}`}
              >
                <p className="text-2xl font-semibold text-transfer price">{resumen.unregistered}</p>
                <p className="text-xs text-transfer/80 mt-0.5">Nuevos en PDF (sin agregar)</p>
              </button>
            </div>

            <div className="flex gap-1 bg-white border border-ink-100 rounded-lg p-1 w-fit">
              {FILTROS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFiltroEstado(f.key)}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    filtroEstado === f.key ? "bg-ink-700 text-white" : "text-ink-600 hover:bg-ink-50"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {!mostrandoNuevos && filasVisibles.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-ink-900 mb-4">Comparativa de precios</h2>

                <div className="max-h-[480px] overflow-auto rounded-lg border border-ink-50">
                  <table className="table-ledger w-full min-w-[760px]">
                    <thead className="sticky top-0 bg-white">
                      <tr>
                        <th className="w-10 px-3">
                          <input
                            type="checkbox"
                            checked={todasVisiblesSeleccionadas}
                            onChange={(e) => toggleTodos(e.target.checked)}
                            className="accent-ink-700"
                          />
                        </th>
                        <th>Producto</th>
                        <th>Cód.</th>
                        <th className="text-right">Costo viejo</th>
                        <th className="text-right">Costo nuevo</th>
                        <th className="text-center">Dif. %</th>
                        <th className="text-right">Margen %</th>
                        <th className="text-right">Venta actual</th>
                        <th className="text-right pr-3">Venta nueva</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasVisibles.map((f) => (
                        <tr key={f.codigoProveedor} className="hover:bg-ink-50/50">
                          <td className="px-3">
                            <input
                              type="checkbox"
                              checked={f.selected}
                              onChange={(e) =>
                                actualizarFila(f.codigoProveedor, { selected: e.target.checked })
                              }
                              className="accent-ink-700"
                            />
                          </td>
                          <td className="text-ink-900">{f.descripcion}</td>
                          <td className="price text-ink-400">{f.codigoProveedor}</td>
                          <td className="price text-right text-ink-400">${f.oldCostPrice.toFixed(2)}</td>
                          <td className="text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={f.newCostPrice}
                              onChange={(e) => onEditarCosto(f, e.target.value)}
                              className="w-24 text-right price rounded border border-ink-100 py-1 px-1.5"
                            />
                          </td>
                          <td className="text-center">
                            <span className={`price text-xs font-semibold px-2 py-1 rounded-full ${badgeClase(f.percentageChange)}`}>
                              {f.percentageChange > 0 ? "+" : ""}
                              {f.percentageChange.toFixed(1)}%
                            </span>
                          </td>
                          <td className="text-right">
                            <input
                              type="number"
                              value={f.margenPct}
                              onChange={(e) => onEditarMargen(f, e.target.value)}
                              className="w-16 text-right price rounded border border-ink-100 py-1 px-1.5"
                            />
                          </td>
                          <td className="price text-right text-ink-400">${f.oldSellingPrice.toFixed(2)}</td>
                          <td className="text-right pr-3">
                            <input
                              type="number"
                              step="0.01"
                              value={f.newSellingPrice}
                              onChange={(e) =>
                                actualizarFila(f.codigoProveedor, { newSellingPrice: Number(e.target.value) })
                              }
                              className="w-24 text-right price font-semibold rounded border border-ink-100 py-1 px-1.5"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!mostrandoNuevos && filasVisibles.length === 0 && (
              <p className="text-sm text-ink-400">No hay productos en esta categoría.</p>
            )}

            {mostrandoNuevos && (
              <div className="card">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-semibold text-ink-900">Productos nuevos en el PDF</h2>
                    <p className="text-sm text-ink-400">
                      Todavía no forman parte de tu inventario activo. Tildá los que tenés y agregalos.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-ink-400 uppercase">Margen</label>
                    <div className="flex items-center rounded-lg border border-ink-100 overflow-hidden">
                      <input
                        type="number"
                        value={margenNuevos}
                        onChange={(e) => setMargenNuevos(Number(e.target.value))}
                        className="w-16 px-2 py-1.5 text-sm font-mono text-right focus:outline-none"
                      />
                      <span className="bg-ink-50 px-2 py-1.5 text-sm text-ink-400">%</span>
                    </div>
                    <button onClick={recalcularNuevosConMargenGlobal} className="btn-ghost">
                      Recalcular todos
                    </button>
                  </div>
                </div>

                {filasNuevos.length === 0 ? (
                  <p className="text-sm text-ink-400 py-6 text-center">No quedan productos nuevos por agregar.</p>
                ) : (
                  <div className="max-h-[480px] overflow-auto rounded-lg border border-ink-50">
                    <table className="table-ledger w-full min-w-[760px]">
                      <thead className="sticky top-0 bg-white">
                        <tr>
                          <th className="w-10 px-3">
                            <input
                              type="checkbox"
                              checked={filasNuevos.length > 0 && seleccionadosNuevos.length === filasNuevos.length}
                              onChange={(e) => toggleTodosNuevos(e.target.checked)}
                              className="accent-ink-700"
                            />
                          </th>
                          <th>Familia</th>
                          <th>Descripción</th>
                          <th>Código</th>
                          <th className="text-right">Costo</th>
                          <th className="text-right">Margen %</th>
                          <th className="text-right pr-3">Precio venta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filasNuevos.map((f) => (
                          <tr key={f.codigoProveedor} className="hover:bg-ink-50/50">
                            <td className="px-3">
                              <input
                                type="checkbox"
                                checked={f.selected}
                                onChange={(e) =>
                                  actualizarFilaNuevo(f.codigoProveedor, { selected: e.target.checked })
                                }
                                className="accent-ink-700"
                              />
                            </td>
                            <td className="text-ink-400">{f.familia}</td>
                            <td className="text-ink-900">{f.descripcion}</td>
                            <td className="price text-ink-400">{f.codigoProveedor}</td>
                            <td className="price text-right">${f.costo.toFixed(2)}</td>
                            <td className="text-right">
                              <input
                                type="number"
                                value={f.margenPct}
                                onChange={(e) => onEditarMargenNuevo(f, e.target.value)}
                                className="w-16 text-right price rounded border border-ink-100 py-1 px-1.5"
                              />
                            </td>
                            <td className="price text-right pr-3 font-semibold">${f.precioVenta.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {(filas.length > 0 || filasNuevos.length > 0) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-ink-100 shadow-[0_-2px_8px_rgba(11,36,43,0.08)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
            {mostrandoNuevos ? (
              <>
                <span className="text-sm text-ink-600 font-medium">
                  {seleccionadosNuevos.length} producto{seleccionadosNuevos.length !== 1 ? "s" : ""} nuevo
                  {seleccionadosNuevos.length !== 1 ? "s" : ""} seleccionado
                  {seleccionadosNuevos.length !== 1 ? "s" : ""}
                </span>
                <div className="flex gap-2">
                  <button onClick={cancelar} className="btn-ghost">Cancelar / Descartar</button>
                  <button
                    onClick={agregarNuevosSeleccionados}
                    disabled={seleccionadosNuevos.length === 0 || loading}
                    className="btn-primary bg-cash hover:bg-cash/90"
                  >
                    {loading ? "Agregando…" : "Agregar seleccionados al inventario"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm text-ink-600 font-medium">
                  {seleccionadas.length} producto{seleccionadas.length !== 1 ? "s" : ""} seleccionado
                  {seleccionadas.length !== 1 ? "s" : ""} para actualizar
                </span>
                <div className="flex gap-2">
                  <button onClick={cancelar} className="btn-ghost">Cancelar / Descartar</button>
                  <button
                    onClick={aplicarActualizacion}
                    disabled={seleccionadas.length === 0 || loading}
                    className="btn-primary"
                  >
                    {loading ? "Aplicando…" : "Aplicar actualización en caja"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
