"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import NavBar from "../../../components/NavBar";
import { api } from "../../../lib/api";

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const data = await api("/categories");
      setCategorias(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setError("");
    setLoading(true);
    try {
      await api("/categories", { method: "POST", body: { nombre: nombre.trim() } });
      setNombre("");
      cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <NavBar />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/inventario" className="text-sm text-ink-400 hover:text-ink-700">
          ← Volver a Inventario
        </Link>

        <p className="font-mono text-xs tracking-widest text-stamp-500 uppercase mt-4 mb-1">
          Organización
        </p>
        <h1 className="text-2xl font-semibold text-ink-900 mb-1">Categorías</h1>
        <p className="text-sm text-ink-400 mb-6">
          Creá las categorías que necesites (Librería, Papelería, Mercería, Regalería, Fotocopias…). Después
          las vas a poder elegir al agregar un producto manual, o cambiarle la categoría a cualquier producto
          desde{" "}
          <Link href="/inventario/productos" className="underline">
            Inventario completo
          </Link>
          .
        </p>

        <form onSubmit={handleSubmit} className="card flex gap-3 items-end mb-6">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-ink-400 uppercase mb-1">
              Nueva categoría
            </label>
            <input
              className="input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Librería"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading || !nombre.trim()}>
            {loading ? "Agregando…" : "Agregar"}
          </button>
        </form>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="card">
          <h2 className="font-semibold text-ink-900 mb-3">
            {categorias.length} categoría{categorias.length !== 1 ? "s" : ""}
          </h2>
          {categorias.length === 0 ? (
            <p className="text-sm text-ink-400">Todavía no creaste ninguna categoría.</p>
          ) : (
            <div className="divide-y divide-ink-50">
              {categorias.map((c) => (
                <div key={c._id} className="flex items-center justify-between py-2.5">
                  <span className="text-ink-900">{c.nombre}</span>
                  <Link
                    href={`/inventario/productos?categoria=${encodeURIComponent(c.nombre)}`}
                    className="text-sm text-ink-400 hover:text-ink-700 underline"
                  >
                    Ver productos
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
