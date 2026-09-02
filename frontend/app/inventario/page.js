"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "../../components/NavBar";
import { api } from "../../lib/api";

export default function InventarioPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [supplierId, setSupplierId] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState({});
  const [margen, setMargen] = useState(45);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    api("/api/suppliers").then(setSuppliers).catch(() => {});
  }, []);

  const [filtroTexto, setFiltroTexto] = useState("");

  async function handleImport() {
    if (!supplierId || !file) return;
    setLoading(true);
    setMensaje("");
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const data = await api(`/api/suppliers/${supplierId}/import-pdf`, {
        method: "POST",
        body: formData,
        isFormData: true,
      });
      setPreview(data);
      setMargen(Math.round((data.supplier.defaultMargin || 0.45) * 100));
      // Destildados por defecto: con miles de productos por PDF es mucho
      // más rápido tildar los pocos que sí tenés que destildar el resto.
      const sel = {};
      data.items.forEach((_, i) => (sel[i] = false));
      setSelected(sel);
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleActivar() {
    const itemsElegidos = preview.items.filter((_, i) => selected[i]);
    if (itemsElegidos.length === 0) return;
    setLoading(true);
    try {
      const data = await api("/api/products/bulk-activate", {
        method: "POST",
        body: { supplierId, margen: margen / 100, items: itemsElegidos },
      });
      setMensaje(`${data.creados} productos agregados al inventario activo.`);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setMensaje(err.message);
    } finally {
      setLoading(false);
    }
  }

  const seleccionados = preview ? Object.values(selected).filter(Boolean).length : 0;

  const itemsFiltrados = preview
    ? preview.items
        .map((item, i) => ({ item, i }))
        .filter(({ item }) =>
          filtroTexto ? item.descripcion.toLowerCase().includes(filtroTexto.toLowerCase()) : true
        )
    : [];

  function marcarVisibles(valor) {
    setSelected((prev) => {
      const copia = { ...prev };
      itemsFiltrados.forEach(({ i }) => (copia[i] = valor));
      return copia;
    });
  }

  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-xs tracking-widest text-stamp-500 uppercase mb-1">Onboarding</p>
            <h1 className="text-2xl font-semibold text-ink-900">Importar lista de precios</h1>
            <p className="text-sm text-ink-400 mt-1">
              Elegí el proveedor, subí el PDF y seleccioná qué productos entran al inventario activo.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/inventario/productos" className="btn-ghost">
              Ver inventario completo
            </Link>
            <Link href="/inventario/categorias" className="btn-ghost">
              Categorías
            </Link>
            <Link href="/inventario/actualizar-precios" className="btn-ghost">
              Actualizar precios
            </Link>
            <Link href="/inventario/manual" className="btn-ghost">
              Agregar producto manual
            </Link>
          </div>
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
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Archivo PDF</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files[0])}
                className="text-sm text-ink-600 file:mr-3 file:btn-ghost file:border-0"
              />
            </div>

            <button
              onClick={handleImport}
              disabled={!supplierId || !file || loading}
              className="btn-primary"
            >
              {loading && !preview ? "Leyendo…" : "Leer PDF"}
            </button>
          </div>
          {mensaje && !preview && (
            <p className="text-sm text-ink-600 mt-3 border-t border-ink-50 pt-3">{mensaje}</p>
          )}
        </div>

        {preview && (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-semibold text-ink-900">
                  {preview.itemsParseados} productos encontrados
                </h2>
                {preview.lineasSinParsear > 0 && (
                  <p className="text-xs text-stamp-600 mt-0.5">
                    {preview.lineasSinParsear} líneas no se pudieron leer con el patrón actual de este proveedor.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-ink-400 uppercase">Margen</label>
                <div className="flex items-center rounded-lg border border-ink-100 overflow-hidden">
                  <input
                    type="number"
                    value={margen}
                    onChange={(e) => setMargen(Number(e.target.value))}
                    className="w-16 px-2 py-1.5 text-sm font-mono text-right focus:outline-none"
                  />
                  <span className="bg-ink-50 px-2 py-1.5 text-sm text-ink-400">%</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-3">
              <input
                type="text"
                placeholder="Buscar por descripción para tildar más rápido…"
                value={filtroTexto}
                onChange={(e) => setFiltroTexto(e.target.value)}
                className="input flex-1 min-w-[220px]"
              />
              <button onClick={() => marcarVisibles(true)} className="btn-ghost">
                Marcar visibles
              </button>
              <button onClick={() => marcarVisibles(false)} className="btn-ghost">
                Desmarcar visibles
              </button>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-lg border border-ink-50">
              <table className="table-ledger w-full min-w-[600px]">
                <thead className="sticky top-0 bg-white">
                  <tr>
                    <th className="w-10 px-3"></th>
                    <th>Familia</th>
                    <th>Descripción</th>
                    <th>Código</th>
                    <th className="text-right">Costo</th>
                    <th className="text-right pr-3">Precio venta</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.map(({ item, i }) => (
                    <tr key={i} className="hover:bg-ink-50/50">
                      <td className="px-3">
                        <input
                          type="checkbox"
                          checked={!!selected[i]}
                          onChange={(e) => setSelected({ ...selected, [i]: e.target.checked })}
                          className="accent-ink-700"
                        />
                      </td>
                      <td className="text-ink-400">{item.familia}</td>
                      <td className="text-ink-900">{item.descripcion}</td>
                      <td className="price text-ink-400">{item.codigoProveedor}</td>
                      <td className="price text-right">${item.costo.toFixed(2)}</td>
                      <td className="price text-right pr-3 font-semibold">
                        ${(item.costo * (1 + margen / 100)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-ink-400">{seleccionados} seleccionados</span>
              <button onClick={handleActivar} disabled={loading || seleccionados === 0} className="btn-primary bg-cash hover:bg-cash/90">
                Agregar seleccionados al inventario
              </button>
            </div>
            {mensaje && <p className="text-sm text-ink-600 mt-3 border-t border-ink-50 pt-3">{mensaje}</p>}
          </div>
        )}
      </main>
    </div>
  );
}
