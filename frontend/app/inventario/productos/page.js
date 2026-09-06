"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/inventario?${qs}` : "/inventario");
  }, [router, searchParams]);

  return null;
}

export default function ProductosRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectContenido />
    </Suspense>
  );
}
