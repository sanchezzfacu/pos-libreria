"use client";
import { useEffect, useRef, useState } from "react";
import NavBar from "../../components/NavBar";
import FacturaImprimible from "../../components/FacturaImprimible";
import { api } from "../../lib/api";

const METODO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta" };

export default function PosPage() {
  const [cart, setCart] = useState([]);
  const [aviso, setAviso] = useState(null); // { tipo: 'error'|'warn', texto } — solo para búsqueda/escáner
  const [accesoRapido, setAccesoRapido] = useState([]);

  const [ultimaVenta, setUltimaVenta] = useState(null); // { _id, items, total, metodoPago, fecha, docTipo, docNro, clienteNombre, factura }

  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef(null);

  // --- Facturar a nombre de un cliente (opcional) ---
  const [mostrarCliente, setMostrarCliente] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null); // {nombre, docTipo, docNro}
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [resultadosCliente, setResultadosCliente] = useState([]);
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoDocTipo, setNuevoDocTipo] = useState(96);
  const [nuevoDocNro, setNuevoDocNro] = useState("");
  const [guardarCliente, setGuardarCliente] = useState(true);
  const debounceClienteRef = useRef(null);

  const scanBuffer = useRef("");
  const scanTimer = useRef(null);

  useEffect(() => {
    api("/products?accesoRapido=true&onlyActive=true&pageSize=100")
      .then((data) => setAccesoRapido(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key === "Enter") {
        // Sin esto, si un botón quedó con foco, el navegador interpreta
        // el Enter del lector como un click sobre ese botón.
        e.preventDefault();
        const code = scanBuffer.current.trim();
        scanBuffer.current = "";
        if (code.length >= 6) buscarPorCodigo(code);
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        scanBuffer.current += e.key;
        clearTimeout(scanTimer.current);
        scanTimer.current = setTimeout(() => (scanBuffer.current = ""), 300);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function buscarPorCodigo(barcode) {
    try {
      const producto = await api(`/products/barcode/${barcode}`);
      agregarAlCarrito(producto);
    } catch (err) {
      setAviso({ tipo: "error", texto: `Código "${barcode}" no encontrado.` });
    }
  }

  function onCambiarBusqueda(valor) {
    setBusqueda(valor);
    clearTimeout(debounceRef.current);
    if (!valor.trim()) {
      setResultados([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const params = new URLSearchParams({ q: valor, onlyActive: "true", pageSize: "8" });
        const data = await api(`/products?${params.toString()}`);
        setResultados(data.items);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 250);
  }

  function onEnterBusqueda(e) {
    if (e.key === "Enter" && resultados.length > 0) {
      agregarAlCarrito(resultados[0]);
      setBusqueda("");
      setResultados([]);
    }
  }

  function seleccionarResultado(producto) {
    agregarAlCarrito(producto);
    setBusqueda("");
    setResultados([]);
  }

  function agregarAlCarrito(producto) {
    if ((producto.stock ?? 0) <= 0) {
      setAviso({ tipo: "warn", texto: `"${producto.descripcion}" figura sin stock — se agrega igual.` });
    } else {
      setAviso(null);
    }

    setCart((prev) => {
      const idx = prev.findIndex((it) => it.productId === producto._id);
      if (idx >= 0) {
        return prev.map((it, i) => (i === idx ? { ...it, cantidad: it.cantidad + 1 } : it));
      }
      return [
        ...prev,
        {
          productId: producto._id,
          descripcion: producto.descripcion,
          precioUnitario: producto.precioVenta,
          cantidad: 1,
          descuento: 0,
        },
      ];
    });
  }

  function actualizarCantidad(i, cantidad) {
    if (cantidad < 1) return;
    setCart((prev) => prev.map((it, idx) => (idx === i ? { ...it, cantidad } : it)));
  }

  function actualizarDescuento(i, descuento) {
    setCart((prev) => prev.map((it, idx) => (idx === i ? { ...it, descuento } : it)));
  }

  function eliminarItem(i) {
    setCart((prev) => prev.filter((_, idx) => idx !== i));
  }

  function agregarGenerico(producto) {
    agregarAlCarrito(producto);
  }

  const total = cart.reduce((acc, it) => acc + it.precioUnitario * it.cantidad - it.descuento, 0);

  // --- Cliente para la factura ---

  function onCambiarBusquedaCliente(valor) {
    setBusquedaCliente(valor);
    clearTimeout(debounceClienteRef.current);
    if (!valor.trim()) {
      setResultadosCliente([]);
      return;
    }
    debounceClienteRef.current = setTimeout(async () => {
      try {
        const data = await api(`/customers?q=${encodeURIComponent(valor)}`);
        setResultadosCliente(data);
      } catch {
        setResultadosCliente([]);
      }
    }, 250);
  }

  function elegirCliente(c) {
    setClienteSeleccionado({ nombre: c.nombre, docTipo: c.docTipo, docNro: c.docNro });
    setBusquedaCliente("");
    setResultadosCliente([]);
    setMostrarNuevoCliente(false);
  }

  async function confirmarNuevoCliente() {
    if (!nuevoNombre.trim() || !nuevoDocNro.trim()) return;
    const datos = { nombre: nuevoNombre.trim(), docTipo: nuevoDocTipo, docNro: Number(nuevoDocNro) };
    if (guardarCliente) {
      try {
        const creado = await api("/customers", { method: "POST", body: datos });
        setClienteSeleccionado({ nombre: creado.nombre, docTipo: creado.docTipo, docNro: creado.docNro });
      } catch (err) {
        setAviso({ tipo: "error", texto: `No se pudo guardar el cliente: ${err.message}` });
        return;
      }
    } else {
      setClienteSeleccionado(datos);
    }
    setNuevoNombre("");
    setNuevoDocNro("");
    setMostrarNuevoCliente(false);
  }

  function quitarCliente() {
    setClienteSeleccionado(null);
  }

  // --- Cobro (simple: se confirma y ya se puede imprimir el ticket) ---
  // Nota: la facturación electrónica AFIP está pausada por ahora (ver
  // AFIP_ENABLED en el backend) mientras se termina de resolver un tema
  // de certificados — así que acá no se espera ni se consulta nada de
  // eso, se imprime un ticket simple.

  async function cobrar(metodoPago, label) {
    if (cart.length === 0) return;
    try {
      const itemsVendidos = cart.map((it) => ({
        product: it.productId,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        precioUnitario: it.precioUnitario,
        descuento: it.descuento,
      }));

      const venta = await api("/sales", {
        method: "POST",
        body: {
          metodoPago,
          items: itemsVendidos,
          docTipo: clienteSeleccionado ? clienteSeleccionado.docTipo : 99,
          docNro: clienteSeleccionado ? clienteSeleccionado.docNro : 0,
          clienteNombre: clienteSeleccionado ? clienteSeleccionado.nombre : undefined,
        },
      });

      setUltimaVenta({
        _id: venta._id,
        items: itemsVendidos,
        total,
        metodoPago,
        fecha: new Date().toISOString(),
        docTipo: venta.docTipo,
        docNro: venta.docNro,
        clienteNombre: venta.clienteNombre,
        factura: venta.factura || null,
      });

      setClienteSeleccionado(null);
      setMostrarCliente(false);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setCart([]);
      api("/products?accesoRapido=true&onlyActive=true&pageSize=100")
        .then((data) => setAccesoRapido(data.items))
        .catch(() => {});
    } catch (err) {
      setAviso({ tipo: "error", texto: `No se pudo cobrar: ${err.message}` });
    }
  }

  function imprimirTicket() {
    window.print();
  }

  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="space-y-6">
          <div className="card relative">
            <h2 className="font-semibold text-ink-900 mb-3">Buscar producto por nombre</h2>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => onCambiarBusqueda(e.target.value)}
              onKeyDown={onEnterBusqueda}
              placeholder="Escribí parte del nombre… (Enter agrega el primer resultado)"
              className="input"
            />
            {resultados.length > 0 && (
              <div className="absolute left-4 right-4 sm:left-5 sm:right-5 mt-1 bg-white border border-ink-100 rounded-lg shadow-ledger z-10 max-h-64 overflow-y-auto">
                {resultados.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => seleccionarResultado(p)}
                    className="w-full text-left px-3 py-2 hover:bg-ink-50 flex items-center justify-between text-sm"
                  >
                    <span className="text-ink-900">{p.descripcion}</span>
                    <span className="price text-ink-400 ml-3 shrink-0">${p.precioVenta.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
            {buscando && <p className="text-xs text-ink-400 mt-1">Buscando…</p>}
          </div>

          <div className="card">
            <h2 className="font-semibold text-ink-900 mb-3">Acceso rápido</h2>
            {accesoRapido.length === 0 ? (
              <p className="text-sm text-ink-400">
                No marcaste ningún producto como acceso rápido todavía. Podés hacerlo desde{" "}
                <a href="/inventario/productos" className="underline">Inventario completo</a>.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accesoRapido.map((p) => (
                  <button key={p._id} onClick={() => agregarGenerico(p)} className="btn-ghost">
                    {p.descripcion}
                    <span className="price ml-2 text-ink-400">${p.precioVenta.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center text-ink-600">
                ▤
              </div>
              <div>
                <h2 className="font-semibold text-ink-900">Escáner de código de barras</h2>
                <p className="text-sm text-ink-400">
                  Apuntá el lector al producto — se agrega solo al carrito, sin tocar la pantalla.
                </p>
              </div>
            </div>
          </div>

          {/* Facturar a nombre de un cliente (opcional) */}
          <div className="card">
            {!clienteSeleccionado ? (
              <>
                <button
                  onClick={() => setMostrarCliente((v) => !v)}
                  className="text-sm text-ink-400 hover:text-ink-700 underline"
                >
                  {mostrarCliente ? "Ocultar" : "Facturar a nombre de un cliente (opcional)"}
                </button>
                {mostrarCliente && (
                  <div className="mt-3 space-y-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={busquedaCliente}
                        onChange={(e) => onCambiarBusquedaCliente(e.target.value)}
                        placeholder="Buscar cliente por nombre o DNI/CUIT…"
                        className="input"
                      />
                      {resultadosCliente.length > 0 && (
                        <div className="absolute left-0 right-0 mt-1 bg-white border border-ink-100 rounded-lg shadow-ledger z-10 max-h-48 overflow-y-auto">
                          {resultadosCliente.map((c) => (
                            <button
                              key={c._id}
                              onClick={() => elegirCliente(c)}
                              className="w-full text-left px-3 py-2 hover:bg-ink-50 text-sm"
                            >
                              <span className="text-ink-900">{c.nombre}</span>
                              <span className="text-ink-400 ml-2">
                                {c.docTipo === 80 ? "CUIT" : "DNI"} {c.docNro}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {!mostrarNuevoCliente ? (
                      <button
                        onClick={() => setMostrarNuevoCliente(true)}
                        className="text-sm text-ink-600 hover:text-ink-900 underline"
                      >
                        + Cliente nuevo
                      </button>
                    ) : (
                      <div className="space-y-2 border-t border-ink-50 pt-3">
                        <input
                          type="text"
                          value={nuevoNombre}
                          onChange={(e) => setNuevoNombre(e.target.value)}
                          placeholder="Nombre y apellido"
                          className="input"
                        />
                        <div className="flex gap-2">
                          <select
                            value={nuevoDocTipo}
                            onChange={(e) => setNuevoDocTipo(Number(e.target.value))}
                            className="input max-w-[110px]"
                          >
                            <option value={96}>DNI</option>
                            <option value={80}>CUIT</option>
                          </select>
                          <input
                            type="number"
                            value={nuevoDocNro}
                            onChange={(e) => setNuevoDocNro(e.target.value)}
                            placeholder="Número"
                            className="input"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm text-ink-600">
                          <input
                            type="checkbox"
                            checked={guardarCliente}
                            onChange={(e) => setGuardarCliente(e.target.checked)}
                            className="accent-ink-700"
                          />
                          Guardar para la próxima
                        </label>
                        <button onClick={confirmarNuevoCliente} className="btn-ghost">
                          Usar este cliente
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm text-ink-700">
                  Facturando a: <strong>{clienteSeleccionado.nombre}</strong>{" "}
                  <span className="text-ink-400">
                    ({clienteSeleccionado.docTipo === 80 ? "CUIT" : "DNI"} {clienteSeleccionado.docNro})
                  </span>
                </p>
                <button onClick={quitarCliente} className="text-sm text-ink-400 hover:text-red-500">
                  Quitar
                </button>
              </div>
            )}
          </div>

          {aviso && (
            <div className={`card ${aviso.tipo === "error" ? "border-red-200 bg-red-50" : "border-stamp-400/40 bg-stamp-400/10"}`}>
              <p className={`text-sm ${aviso.tipo === "error" ? "text-red-700" : "text-stamp-600"}`}>{aviso.texto}</p>
            </div>
          )}

          {ultimaVenta && (
            <div className="card border-cash/30 bg-cash/5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-cash font-medium">
                  Cobrado por {METODO_LABEL[ultimaVenta.metodoPago]} · ${ultimaVenta.total.toFixed(2)}
                </p>
                <button onClick={imprimirTicket} className="btn-ghost shrink-0">
                  🖨️ Imprimir ticket
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card h-fit sticky top-6">
          <h2 className="font-semibold text-ink-900 mb-3">Carrito</h2>

          {cart.length === 0 ? (
            <p className="text-sm text-ink-400 py-8 text-center">Todavía no hay productos.</p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto -mx-1 px-1">
              <table className="table-ledger w-full">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="text-center w-16">Cant.</th>
                    <th className="text-right">Precio</th>
                    <th className="w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((it, i) => (
                    <tr key={i}>
                      <td className="text-ink-900">{it.descripcion}</td>
                      <td className="text-center">
                        <input
                          type="number"
                          value={it.cantidad}
                          onChange={(e) => actualizarCantidad(i, Number(e.target.value))}
                          className="w-12 text-center price rounded border border-ink-100 py-0.5"
                        />
                      </td>
                      <td className="price text-right">${it.precioUnitario.toFixed(2)}</td>
                      <td>
                        <button
                          onClick={() => eliminarItem(i)}
                          className="text-ink-300 hover:text-red-500 px-1"
                          aria-label={`Quitar ${it.descripcion}`}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-dashed border-ink-100 mt-4 pt-4 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-ink-400 uppercase tracking-wide">Total</span>
            <span className="price text-2xl font-semibold text-ink-900">${total.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <button
              onClick={() => cobrar("efectivo", "efectivo")}
              disabled={cart.length === 0}
              className="btn bg-cash text-white hover:bg-cash/90 flex-col gap-0.5 h-14 sm:h-16 text-xs sm:text-sm px-1"
            >
              Efectivo
            </button>
            <button
              onClick={() => cobrar("transferencia", "transferencia")}
              disabled={cart.length === 0}
              className="btn bg-transfer text-white hover:bg-transfer/90 flex-col gap-0.5 h-14 sm:h-16 text-xs sm:text-sm px-1"
            >
              Transf./QR
            </button>
            <button
              onClick={() => cobrar("tarjeta", "tarjeta")}
              disabled={cart.length === 0}
              className="btn bg-card text-white hover:bg-card/90 flex-col gap-0.5 h-14 sm:h-16 text-xs sm:text-sm px-1"
            >
              Tarjeta
            </button>
          </div>
        </div>
      </main>

      <FacturaImprimible venta={ultimaVenta} />
    </div>
  );
}
