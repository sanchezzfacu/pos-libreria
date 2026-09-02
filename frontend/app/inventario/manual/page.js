"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "../../../components/NavBar";
import { api } from "../../../lib/api";

import { redondearPrecio } from "../../../lib/pricing";

const VACIO = { descripcion: "", familia: "", costo: "", margenPct: "45", precioVenta: "", barcode: "", stock: "" };

export default function ProductoManualPage() {
  const [form, setForm] = useState(VACIO);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    api("/categories")
      .then(setCategorias)
      .catch(() => {});
  }, []);

  // Costo -> recalcula precio de venta (redondeado a $10) manteniendo el margen actual.
  function onChangeCosto(valor) {
    const costo = Number(valor) || 0;
    const margenPct = Number(form.margenPct) || 0;
    const precioVenta = costo > 0 ? redondearPrecio(costo * (1 + margenPct / 100)) : form.precioVenta;
    setForm((f) => ({ ...f, costo: valor, precioVenta: precioVenta ? String(precioVenta) : f.precioVenta }));
  }

  // Margen -> recalcula precio de venta (redondeado a $10) manteniendo el costo actual.
  function onChangeMargen(valor) {
    const margenPct = Number(valor) || 0;
    const costo = Number(form.costo) || 0;
    const precioVenta = costo > 0 ? redondearPrecio(costo * (1 + margenPct / 100)) : form.precioVenta;
    setForm((f) => ({ ...f, margenPct: valor, precioVenta: precioVenta ? String(precioVenta) : f.precioVenta }));
  }

  // Precio de venta -> recalcula el margen real (esto es lo que faltaba:
  // antes el margen se quedaba clavado en 45% aunque cambiaras el precio a mano).
  // No se redondea mientras se tipea (sería raro que salte el número a mitad
  // de escribirlo) — se redondea recién al salir del campo.
  function onChangePrecioVenta(valor) {
    const costo = Number(form.costo) || 0;
    const precioVenta = Number(valor) || 0;
    if (costo > 0) {
      const margenPct = Math.round(((precioVenta - costo) / costo) * 100);
      setForm((f) => ({ ...f, precioVenta: valor, margenPct: String(margenPct) }));
    } else {
      setForm((f) => ({ ...f, precioVenta: valor }));
    }
  }

  function onBlurPrecioVenta() {
    const costo = Number(form.costo) || 0;
    const precioRedondeado = redondearPrecio(Number(form.precioVenta) || 0);
    const margenPct = costo > 0 ? Math.round(((precioRedondeado - costo) / costo) * 100) : form.margenPct;
    setForm((f) => ({ ...f, precioVenta: String(precioRedondeado), margenPct: String(margenPct) }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setAviso("");
    setLoading(true);
    try {
      await api("/products/manual", {
        method: "POST",
        body: {
          descripcion: form.descripcion,
          familia: form.familia || undefined,
          costo: Number(form.costo) || 0,
          margen: (Number(form.margenPct) || 0) / 100,
          precioVenta: Number(form.precioVenta) || 0,
          barcode: form.barcode || undefined,
          stock: Number(form.stock) || 0,
        },
      });
      setAviso(`"${form.descripcion}" agregado. Listo para cargar el siguiente.`);
      setForm(VACIO);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const costoInvalido = Number(form.costo) <= 0;

  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/inventario" className="text-sm text-ink-400 hover:text-ink-700">
          ← Volver a Inventario
        </Link>

        <p className="font-mono text-xs tracking-widest text-stamp-500 uppercase mt-4 mb-1">
          Alta manual
        </p>
        <h1 className="text-2xl font-semibold text-ink-900 mb-1">Agregar producto</h1>
        <p className="text-sm text-ink-400 mb-6">
          Para productos que se compran por fuera de los mayoristas habituales.
        </p>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">
              Descripción
            </label>
            <input
              className="input"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-ink-400 uppercase">
                Categoría (opcional)
              </label>
              <Link href="/inventario/categorias" className="text-xs text-ink-400 hover:text-ink-700 underline">
                ¿Falta una? Creala acá
              </Link>
            </div>
            <select
              className="input"
              value={form.familia}
              onChange={(e) => setForm((f) => ({ ...f, familia: e.target.value }))}
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c._id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Costo</label>
              <input
                type="number"
                step="0.01"
                className="input price"
                value={form.costo}
                onChange={(e) => onChangeCosto(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Stock</label>
              <input
                type="number"
                className="input price"
                value={form.stock}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Margen %</label>
              <input
                type="number"
                className="input price"
                value={form.margenPct}
                onChange={(e) => onChangeMargen(e.target.value)}
                disabled={costoInvalido}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">
                Precio de venta
              </label>
              <input
                type="number"
                step="0.01"
                className="input price font-semibold"
                value={form.precioVenta}
                onChange={(e) => onChangePrecioVenta(e.target.value)}
                onBlur={onBlurPrecioVenta}
              />
            </div>
          </div>
          <p className="text-xs text-ink-400 -mt-2">
            {costoInvalido
              ? "Cargá el costo para poder calcular el margen real."
              : "Margen y precio de venta se recalculan solos, edites el que edites. El precio final siempre redondea a múltiplo de $10."}
          </p>

          <div>
            <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">
              Código de barras (opcional)
            </label>
            <input
              className="input"
              value={form.barcode}
              onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))}
              placeholder="Hacé click y escaneá, o escribilo a mano"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {aviso && <p className="text-sm text-cash">{aviso}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Guardando…" : "Agregar al inventario"}
          </button>
        </form>
      </main>
    </div>
  );
}
