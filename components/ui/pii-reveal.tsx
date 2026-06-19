"use client";

import * as React from "react";
import { Eye } from "lucide-react";

import { logAcao } from "@/lib/audit/log";
import { mascararPii, type TipoPii } from "@/lib/utils/pii";

/**
 * Exibe um dado pessoal MASCARADO por padrão (LGPD). O botão "revelar" mostra o
 * valor e registra a ação na auditoria (acao=revelar_pii).
 */
export function PiiReveal({
  valor,
  tipo,
  recurso,
}: {
  valor: string | null | undefined;
  tipo: TipoPii;
  recurso?: string;
}) {
  const [revelado, setRevelado] = React.useState(false);
  const v = (valor ?? "").trim();
  if (!v) return <span>—</span>;

  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {revelado ? v : mascararPii(v, tipo)}
      {!revelado && (
        <button
          type="button"
          onClick={() => {
            logAcao("revelar_pii", recurso, { tipo });
            setRevelado(true);
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Revelar dado"
          title="Revelar (registrado na auditoria)"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
    </span>
  );
}
