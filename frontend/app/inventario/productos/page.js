"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import NavBar from "../../../components/NavBar";
import { api } from "../../../lib/api";
import { redondearPrecio } from "../../../lib/pricing";

const PAGE_SIZE = 50;

export default function InventarioCompletoPage() {
  return (
    <Suspense fallback={null}>
      <InventarioCompletoContenido />
    </Suspense>
  );
}

function InventarioCompletoContenido() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState(searchParams.get("categoria") || "");
  const [categorias, setCategorias] = useState([]);
  const [sortBy, setSortBy] = useState("descripcion");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState({}); // { [productId]: true }
  const debounceRef = useRef(null);

  const [ajusteAbierto, setAjusteAbierto] = useState(false);
  const [porcentajeAjuste, setPorcentajeAjuste] = useState("2.1");
  const [confirmandoAjuste, setConfirmandoAjuste] = useState(false);
  const [aplicandoAjuste, setAplicandoAjuste] = useState(false);
  const [avisoAjuste, setAvisoAjuste] = useState("");

  useEffect(() => {
    api("/categories")
      .then(setCategorias)
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        q: query,
        sortBy,
        sortDir,
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (categoriaFiltro) params.set("familia", categoriaFiltro);
      const resultado = await api(`/products?${params.toString()}`);
      setData(resultado);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [query, categoriaFiltro, sortBy, sortDir, page]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function ordenarPor(campo) {
    if (sortBy === campo) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(campo);
      setSortDir(campo === "stock" || campo === "precioVenta" ? "desc" : "asc");
    }
    setPage(1);
  }

  async function guardarCampo(producto, cambios) {
    setGuardando((g) => ({ ...g, [producto._id]: true }));
    try {
      const actualizado = await api(`/products/${producto._id}`, { method: "PATCH", body: cambios });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((p) => (p._id === producto._id ? actualizado : p)),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando((g) => ({ ...g, [producto._id]: false }));
    }
  }

  async function guardarBarcode(producto, valor) {
    if (valor === (producto.barcode || "")) return;
    setGuardando((g) => ({ ...g, [producto._id]: true }));
    try {
      const actualizado = await api(`/products/${producto._id}/barcode`, {
        method: "PATCH",
        body: { barcode: valor },
      });
      setData((prev) => ({
        ...prev,
        items: prev.items.map((p) => (p._id === producto._id ? actualizado : p)),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando((g) => ({ ...g, [producto._id]: false }));
    }
  }

  async function aplicarAjusteGlobal() {
    const pct = Number(porcentajeAjuste);
    if (!pct) return;
    setAplicandoAjuste(true);
    setAvisoAjuste("");
    try {
      const resultado = await api("/products/bulk-price-adjustment", {
        method: "POST",
        body: { percent: pct },
      });
      setAvisoAjuste(`Listo: ${resultado.actualizados} productos ajustados ${pct > 0 ? "+" : ""}${pct}%.`);
      setConfirmandoAjuste(false);
      cargar();
    } catch (err) {
      setAvisoAjuste(err.message);
    } finally {
      setAplicandoAjuste(false);
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Link href="/inventario" className="text-sm text-ink-400 hover:text-ink-700">
          ← Volver a Inventario
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xs tracking-widest text-stamp-500 uppercase mb-1">Catálogo</p>
            <h1 className="text-2xl font-semibold text-ink-900">Inventario completo</h1>
            <p className="text-sm text-ink-400 mt-1 max-w-2xl">
              Consultá, editá precios y stock, vinculá códigos de barra y elegí qué aparece como acceso
              rápido en el punto de venta.
            </p>
          </div>
          <button onClick={() => setAjusteAbierto((v) => !v)} className="btn-ghost shrink-0">
            {ajusteAbierto ? "Cerrar" : "Ajustar todos los precios"}
          </button>
        </div>

        {ajusteAbierto && (
          <div className="card bg-stamp-400/10 border-stamp-400/30">
            <h2 className="font-semibold text-ink-900 mb-1">Ajuste general de precios</h2>
            <p className="text-sm text-ink-600 mb-3">
              Sube o baja el precio de venta de <strong>todos los productos activos</strong> un mismo
              porcentaje (ej. para acompañar la inflación mensual). Usá un número negativo para bajar
              precios. El resultado se redondea a múltiplo de $10 y el margen se recalcula solo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-ink-100 overflow-hidden bg-white">
                <input
                  type="number"
                  step="0.1"
                  value={porcentajeAjuste}
                  onChange={(e) => {
                    setPorcentajeAjuste(e.target.value);
                    setConfirmandoAjuste(false);
                  }}
                  className="w-24 px-3 py-2 text-sm font-mono text-right focus:outline-none"
                />
                <span className="bg-ink-50 px-3 py-2 text-sm text-ink-400">%</span>
              </div>

              {!confirmandoAjuste ? (
                <button
                  onClick={() => setConfirmandoAjuste(true)}
                  disabled={!Number(porcentajeAjuste)}
                  className="btn-primary"
                >
                  Aplicar a todos los activos
                </button>
              ) : (
                <>
                  <span className="text-sm text-ink-700 font-medium">
                    ¿Confirmás {Number(porcentajeAjuste) > 0 ? "+" : ""}
                    {porcentajeAjuste}% en TODOS los productos activos?
                  </span>
                  <button onClick={aplicarAjusteGlobal} disabled={aplicandoAjuste} className="btn-primary bg-red-600 hover:bg-red-700">
                    {aplicandoAjuste ? "Aplicando…" : "Sí, confirmar"}
                  </button>
                  <button onClick={() => setConfirmandoAjuste(false)} className="btn-ghost">
                    Cancelar
                  </button>
                </>
              )}
            </div>
            {avisoAjuste && <p className="text-sm text-ink-700 mt-3">{avisoAjuste}</p>}
          </div>
        )}

        <div className="card !p-4 bg-ink-50/60 border-ink-100">
          <p className="text-sm text-ink-600">
            <strong>Sobre el código de barras:</strong> no hace falta cargarlo para poder vender un
            producto — en el mostrador ya podés buscarlo por el código que trae la lista del proveedor.
            Usá este campo solo si el producto tiene un código de barras real impreso: hacé click adentro,
            escaneá con la pistola (escribe el número y presiona Enter solo) y listo.
          </p>
        </div>

        <div className="card">
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por descripción, código de proveedor o código de barras…"
              defaultValue={query}
              onChange={(e) => {
                clearTimeout(debounceRef.current);
                const valor = e.target.value;
                debounceRef.current = setTimeout(() => {
                  setQuery(valor);
                  setPage(1);
                }, 300);
              }}
              className="input flex-1 min-w-[220px]"
            />
            <select
              value={categoriaFiltro}
              onChange={(e) => {
                setCategoriaFiltro(e.target.value);
                setPage(1);
              }}
              className="input max-w-[200px]"
            >
              <option value="">Todas las categorías</option>
              {categorias.map((c) => (
                <option key={c._id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <div className="overflow-x-auto rounded-lg border border-ink-50">
            <table className="table-ledger w-full min-w-[820px]">
              <thead className="bg-white">
                <tr>
                  <th className="cursor-pointer select-none" onClick={() => ordenarPor("descripcion")}>
                    Producto {sortBy === "descripcion" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right cursor-pointer select-none" onClick={() => ordenarPor("costo")}>
                    Costo {sortBy === "costo" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right">Margen</th>
                  <th className="text-right cursor-pointer select-none" onClick={() => ordenarPor("precioVenta")}>
                    Venta {sortBy === "precioVenta" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="text-right cursor-pointer select-none" onClick={() => ordenarPor("stock")}>
                    Stock {sortBy === "stock" && (sortDir === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Cód. barras</th>
                  <th className="text-center">Acc. rápido</th>
                  <th className="text-center">Activo</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <FilaProducto
                    key={p._id}
                    producto={p}
                    categorias={categorias}
                    guardando={!!guardando[p._id]}
                    onGuardarCampo={guardarCampo}
                    onGuardarBarcode={guardarBarcode}
                  />
                ))}
                {!loading && data.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-ink-400 py-8">
                      No se encontraron productos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            <span className="text-sm text-ink-400">
              {data.total} productos {loading && "· cargando…"}
            </span>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ← Anterior
              </button>
              <span className="text-sm text-ink-600 px-2">
                Página {page} de {totalPaginas}
              </span>
              <button
                className="btn-ghost"
                disabled={page >= totalPaginas}
                onClick={() => setPage((p) => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function FilaProducto({ producto, categorias, guardando, onGuardarCampo, onGuardarBarcode }) {
  const [stockLocal, setStockLocal] = useState(producto.stock ?? 0);
  const [barcodeLocal, setBarcodeLocal] = useState(producto.barcode || "");
  const [costoLocal, setCostoLocal] = useState(String(producto.costo ?? 0));
  const [margenLocal, setMargenLocal] = useState(String(Math.round((producto.margen ?? 0) * 100)));
  const [ventaLocal, setVentaLocal] = useState(String(producto.precioVenta ?? 0));

  function onChangeCosto(v) {
    setCostoLocal(v);
    const costo = Number(v) || 0;
    const margen = Number(margenLocal) || 0;
    if (costo > 0) setVentaLocal(String(redondearPrecio(costo * (1 + margen / 100))));
  }

  function onChangeMargen(v) {
    setMargenLocal(v);
    const costo = Number(costoLocal) || 0;
    const margen = Number(v) || 0;
    if (costo > 0) setVentaLocal(String(redondearPrecio(costo * (1 + margen / 100))));
  }

  function onChangeVenta(v) {
    setVentaLocal(v);
    const costo = Number(costoLocal) || 0;
    const venta = Number(v) || 0;
    if (costo > 0) setMargenLocal(String(Math.round(((venta - costo) / costo) * 100)));
  }

  function onBlurCosto() {
    onGuardarCampo(producto, { costo: Number(costoLocal) || 0, margen: (Number(margenLocal) || 0) / 100 });
  }
  function onBlurMargen() {
    onGuardarCampo(producto, { costo: Number(costoLocal) || 0, margen: (Number(margenLocal) || 0) / 100 });
  }
  function onBlurVenta() {
    const redondeado = redondearPrecio(Number(ventaLocal) || 0);
    setVentaLocal(String(redondeado));
    onGuardarCampo(producto, { costo: Number(costoLocal) || 0, precioVenta: redondeado });
  }

  return (
    <tr className={`hover:bg-ink-50/50 ${guardando ? "opacity-60" : ""}`}>
      <td className="text-ink-900">
        {producto.descripcion}
        <select
          value={producto.familia === "SIN FAMILIA" ? "" : producto.familia || ""}
          onChange={(e) => onGuardarCampo(producto, { familia: e.target.value })}
          className="block mt-1 text-xs text-ink-400 border border-transparent hover:border-ink-100 rounded px-1 py-0.5 -ml-1 bg-transparent"
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c._id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </select>
      </td>
      <td className="text-right">
        <input
          type="number"
          step="0.01"
          value={costoLocal}
          onChange={(e) => onChangeCosto(e.target.value)}
          onBlur={onBlurCosto}
          className="w-20 text-right price rounded border border-ink-100 py-1 px-1.5"
        />
      </td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-0.5">
          <input
            type="number"
            value={margenLocal}
            onChange={(e) => onChangeMargen(e.target.value)}
            onBlur={onBlurMargen}
            className="w-14 text-right price rounded border border-ink-100 py-1 px-1.5"
          />
          <span className="text-ink-300 text-xs">%</span>
        </div>
      </td>
      <td className="text-right">
        <input
          type="number"
          step="10"
          value={ventaLocal}
          onChange={(e) => onChangeVenta(e.target.value)}
          onBlur={onBlurVenta}
          className="w-24 text-right price font-semibold rounded border border-ink-100 py-1 px-1.5"
        />
      </td>
      <td className="text-right">
        <input
          type="number"
          value={stockLocal}
          onChange={(e) => setStockLocal(e.target.value)}
          onBlur={() => onGuardarCampo(producto, { stock: Number(stockLocal) })}
          className={`w-20 text-right price rounded border py-1 px-1.5 ${
            Number(stockLocal) <= 0 ? "border-red-200 bg-red-50 text-red-700" : "border-ink-100"
          }`}
        />
      </td>
      <td>
        <input
          type="text"
          value={barcodeLocal}
          placeholder="Sin código"
          onChange={(e) => setBarcodeLocal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          onBlur={() => onGuardarBarcode(producto, barcodeLocal)}
          className="w-32 price rounded border border-ink-100 py-1 px-1.5"
        />
      </td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={!!producto.mostrarEnAccesoRapido}
          onChange={(e) => onGuardarCampo(producto, { mostrarEnAccesoRapido: e.target.checked })}
          className="accent-ink-700"
        />
      </td>
      <td className="text-center">
        <input
          type="checkbox"
          checked={!!producto.isActive}
          onChange={(e) => onGuardarCampo(producto, { isActive: e.target.checked })}
          className="accent-cash"
        />
      </td>
    </tr>
  );
}
