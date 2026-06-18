"use client";

import Link from "next/link";
import { useMs365 } from "@/hooks/use-ms365";

/** Indicador compacto de conexão M365 para o cabeçalho. */
export function Ms365Status() {
  const { connected, displayName, email } = useMs365();

  if (!connected) return null;

  const initials = displayName
    ? displayName
        .split(" ")
        .slice(0, 2)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : email?.[0]?.toUpperCase() ?? "M";

  return (
    <Link
      href="/configuracoes/contatos-m365"
      title={`Microsoft 365: ${displayName ?? email ?? "conectado"}`}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0078d4] text-[11px] font-bold text-white hover:opacity-90"
    >
      {initials}
    </Link>
  );
}
