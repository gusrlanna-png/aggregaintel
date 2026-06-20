"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserCheck } from "lucide-react";

import { contarAcessosPendentes, getMeuPerfil } from "@/lib/supabase/perfil";

/** Aviso (só admin) quando há acessos aguardando aprovação. */
export function AcessoPendenteBanner() {
  const { data: perfil } = useQuery({ queryKey: ["meu-perfil"], queryFn: getMeuPerfil });
  const { data: pendentes = 0 } = useQuery({
    queryKey: ["acessos-pendentes"],
    queryFn: contarAcessosPendentes,
    enabled: perfil === "admin",
    refetchInterval: 60000,
  });

  if (perfil !== "admin" || pendentes === 0) return null;

  return (
    <Link
      href="/configuracoes/usuarios"
      className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
    >
      <UserCheck className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        <strong>{pendentes}</strong> acesso(s) aguardando aprovação. Clique para revisar.
      </span>
    </Link>
  );
}
