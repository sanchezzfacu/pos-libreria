"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "../lib/api";

const links = [
  { href: "/inventario", label: "Inventario" },
  { href: "/pos", label: "Punto de venta" },
  { href: "/cierre", label: "Cierre de caja" },
  { href: "/estadisticas", label: "Estadísticas" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="bg-ink-900">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 flex items-center gap-1 overflow-x-auto">
        <span className="text-white font-mono font-semibold tracking-tight py-4 pr-4 sm:pr-6 border-r border-white/10 mr-1 sm:mr-2 shrink-0 text-sm sm:text-base">
          POS
        </span>
        {links.map((l) => {
          const active = pathname?.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-2.5 sm:px-4 py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? "text-white border-stamp-400"
                  : "text-ink-100/70 border-transparent hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
        <button
          onClick={() => {
            clearToken();
            router.push("/login");
          }}
          className="ml-auto pl-3 shrink-0 text-xs sm:text-sm font-medium text-ink-100/70 hover:text-white py-4 whitespace-nowrap"
        >
          Salir
        </button>
      </div>
    </header>
  );
}
