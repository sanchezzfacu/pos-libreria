"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import NavBar from "../../components/NavBar";
import { api } from "../../lib/api";

const RANGOS = [
  { dias: 0, label: "Hoy" },
  { dias: 6, label: "7 días" },
  { dias: 29, label: "30 días" },
];

function isoDesdeHace(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function EstadisticasPage() {
  const [dias, setDias] = useState(6);
  const [data, setData] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [gastos, setGastos] = useState([]);
  const [descripcionGasto, setDescripcionGasto] = useState("");
  const [montoGasto, setMontoGasto] = useState("");
  const [categoriaGasto, setCategoriaGasto] = useState("otros");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [stats, gastosData, productos] = await Promise.all([
        api(`/sales/stats?dias=${dias}`),
        api(`/expenses?from=${isoDesdeHace(dias)}`),
        api(`/sales/stats/productos?dias=${dias}`),
      ]);
      setData(stats);
      setGastos(gastosData);
      setRanking(productos.ranking);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  async function agregarGasto(e) {
    e.preventDefault();
    if (!descripcionGasto || !montoGasto) return;
    try {
      await api("/expenses", {
        method: "POST",
        body: { descripcion: descripcionGasto, monto: Number(montoGasto), categoria: categoriaGasto },
      });
      setDescripcionGasto("");
      setMontoGasto("");
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrarGasto(id) {
    try {
      await api(`/expenses/${id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-mono text-xs tracking-widest text-stamp-500 uppercase mb-1">Negocio</p>
            <h1 className="text-2xl font-semibold text-ink-900">Estadísticas de ventas</h1>
          </div>
          <div className="flex gap-1 bg-white border border-ink-100 rounded-lg p-1">
            {RANGOS.map((r) => (
              <button
                key={r.dias}
                onClick={() => setDias(r.dias)}
                className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                  dias === r.dias ? "bg-ink-700 text-white" : "text-ink-600 hover:bg-ink-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card
                label="Ventas"
                valor={data.ventasTotales}
                info="Total facturado en el período, sin descontar nada."
              />
              <Card
                label="Costo mercadería"
                valor={data.costoTotal}
                tono="text-ink-400"
                info="Lo que te costó a vos (precio de costo) todo lo que vendiste en el período."
              />
              <Card
                label="Ganancia bruta"
                valor={data.gananciaBruta}
                tono="text-cash"
                info="Ventas menos costo de mercadería. Todavía no descuenta gastos como alquiler o sueldos."
              />
              <Card
                label="Gastos"
                valor={data.gastosTotales}
                tono="text-red-600"
                info="Suma de los gastos operativos que cargaste en este período (abajo, en \'Gastos del período\')."
              />
              <Card
                label="Ganancia neta"
                valor={data.gananciaNeta}
                tono="text-ink-900"
                destacado
                info="Ganancia bruta menos los gastos del período. Es lo que realmente te queda."
              />
              <Card
                label="Margen prom."
                valor={`${data.margenPromedio.toFixed(1)}%`}
                esPorcentaje
                info="Ganancia bruta como porcentaje de las ventas totales del período."
              />
            </div>

            <div className="card">
              <h2 className="font-semibold text-ink-900 mb-4">Ventas y ganancia neta por día</h2>
              {data.porDia.length === 0 ? (
                <p className="text-sm text-ink-400 py-8 text-center">No hay ventas en este período.</p>
              ) : (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <ComposedChart data={data.porDia}>
                      <CartesianGrid stroke="#EEF3F4" vertical={false} />
                      <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: "#3E6E7A" }} tickLine={false} axisLine={{ stroke: "#D7E2E4" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#3E6E7A" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: "1px solid #D7E2E4", fontSize: 12 }}
                        formatter={(value) => `$${Number(value).toFixed(2)}`}
                      />
                      <Bar dataKey="ventas" fill="#D6A02E" radius={[4, 4, 0, 0]} name="Ventas" />
                      <Line type="monotone" dataKey="gananciaNeta" stroke="#153A44" strokeWidth={2} dot={false} name="Ganancia neta" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="font-semibold text-ink-900 mb-1">Productos más vendidos</h2>
              <p className="text-sm text-ink-400 mb-4">
                Para saber qué está funcionando y reponer a tiempo antes de quedarte sin stock.
              </p>
              {ranking.length === 0 ? (
                <p className="text-sm text-ink-400 py-6 text-center">No hay ventas en este período.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-ink-50">
                  <table className="table-ledger w-full min-w-[480px]">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="text-right">Cant. vendida</th>
                        <th className="text-right">Ingresos</th>
                        <th className="text-right">Stock actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.slice(0, 20).map((r, i) => (
                        <tr key={r.productId || r.descripcion}>
                          <td className="text-ink-900">
                            <span className="text-ink-300 font-mono text-xs mr-2">#{i + 1}</span>
                            {r.descripcion}
                          </td>
                          <td className="price text-right font-semibold">{r.cantidad}</td>
                          <td className="price text-right text-ink-400">${r.ingresos.toFixed(2)}</td>
                          <td className="text-right">
                            {r.stockActual === null ? (
                              <span className="text-ink-300">—</span>
                            ) : (
                              <span className={`price ${r.stockActual <= 0 ? "text-red-600 font-semibold" : "text-ink-600"}`}>
                                {r.stockActual}
                              </span>
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

        <div className="card">
          <h2 className="font-semibold text-ink-900 mb-4">Gastos del período</h2>
          <form onSubmit={agregarGasto} className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Descripción</label>
              <input
                className="input"
                value={descripcionGasto}
                onChange={(e) => setDescripcionGasto(e.target.value)}
              />
            </div>
            <div className="w-24 sm:w-28">
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Monto</label>
              <input
                type="number"
                step="0.01"
                className="input price"
                value={montoGasto}
                onChange={(e) => setMontoGasto(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">Categoría</label>
              <select
                className="input"
                value={categoriaGasto}
                onChange={(e) => setCategoriaGasto(e.target.value)}
              >
                <option value="alquiler">Alquiler</option>
                <option value="sueldos">Sueldos</option>
                <option value="servicios">Servicios</option>
                <option value="mercaderia">Mercadería</option>
                <option value="impuestos">Impuestos</option>
                <option value="otros">Otros</option>
              </select>
            </div>
            <button type="submit" className="btn-primary">Agregar gasto</button>
          </form>

          {gastos.length === 0 ? (
            <p className="text-sm text-ink-400">No hay gastos cargados en este período.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-ink-50">
              <table className="table-ledger w-full min-w-[480px]">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th className="text-right">Monto</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {gastos.map((g) => (
                    <tr key={g._id}>
                      <td className="text-ink-400">{new Date(g.fecha).toLocaleDateString("es-AR")}</td>
                      <td className="text-ink-900">{g.descripcion}</td>
                      <td className="text-ink-400 capitalize">{g.categoria}</td>
                      <td className="price text-right">${g.monto.toFixed(2)}</td>
                      <td>
                        <button onClick={() => borrarGasto(g._id)} className="text-ink-300 hover:text-red-500 px-1">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Card({ label, valor, tono = "text-ink-900", destacado = false, esPorcentaje = false, info }) {
  return (
    <div className={`group relative card !p-4 ${destacado ? "border-ink-700/20 bg-ink-50/50" : ""}`}>
      <p className={`text-xl font-semibold price ${tono}`}>
        {esPorcentaje ? valor : `$${Number(valor).toFixed(2)}`}
      </p>
      <p className="text-xs text-ink-400 mt-0.5 flex items-center gap-1">
        {label}
        {info && (
          <span className="w-3.5 h-3.5 rounded-full bg-ink-100 text-ink-500 text-[10px] leading-[14px] text-center font-semibold cursor-help">
            i
          </span>
        )}
      </p>
      {info && (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <div className="bg-ink-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
            {info}
          </div>
        </div>
      )}
    </div>
  );
}
