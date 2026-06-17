"use client";

import * as React from "react";
import { Building2, ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * Bloco de empresa agrupada (padrão do sistema): mostra a MATRIZ em destaque e
 * recolhe as filiais/unidades repetidas; expande ao clicar. Use com
 * agruparEmpresas(). `renderUnidade` desenha cada linha (matriz e filiais).
 */
export function GrupoEmpresaCard<T>({
  matriz,
  extras,
  renderUnidade,
}: {
  matriz: T;
  extras: T[];
  renderUnidade: (item: T, isMatriz: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const temFiliais = extras.length > 0;

  return (
    <div className="py-2">
      <div className="flex items-center gap-2">
        {temFiliais ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={open ? "Recolher unidades" : "Expandir unidades"}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">{renderUnidade(matriz, true)}</div>
        {temFiliais && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            +{extras.length} unidade{extras.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>
      {open && temFiliais && (
        <div className="ml-6 mt-1 space-y-1 border-l pl-3">
          {extras.map((u, i) => (
            <div key={i}>{renderUnidade(u, false)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
