"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("pos_token") : null;
    router.replace(token ? "/pos" : "/login");
  }, [router]);
  return null;
}
