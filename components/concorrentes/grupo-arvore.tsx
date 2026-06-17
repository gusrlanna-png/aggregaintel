"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Membro {
  id: string;
  razao_social: string;
  municipio: string | null;
  cnpj: string | null;
  matriz_filial?: string | null;
}

const digitos = (s?: string | null) => (s ?? "").replace(/\D/g, "");
const raizDe = (s?: string | null) => digitos(s).slice(0, 8);
const ehMatriz = (m: Membro) =>
  m.matriz_filial === "matriz" || digitos(m.cnpj).slice(8, 12) === "0001";

/**
 * Lista de empresas do grupo agrupando filiais sob a matriz (mesma raiz de CNPJ),
 * com recolher/expandir e ordem alfabética.
 */
export function GrupoArvore({ membros }: { membros: Membro[] }) {
  const grupos = React.useMemo(() => {
    const porRaiz = new Map<string, Membro[]>();
    for (const m of membros) {
      const r = raizDe(m.cnpj) || `id:${m.id}`;
      if (!porRaiz.has(r)) porRaiz.set(r, []);
      porRaiz.get(r)!.push(m);
    }
    return Array.from(porRaiz.values())
      .map((lista) => {
        const matriz =
          lista.find(ehMatriz) ??
          [...lista].sort((a, b) => a.razao_social.localeCompare(b.razao_social))[0];
        const filiais = lista
          .filter((m) => m.id !== matriz.id)
          .sort((a, b) =>
            (a.municipio ?? "").localeCompare(b.municipio ?? "") ||
            a.razao_social.localeCompare(b.razao_social)
          );
        return { matriz, filiais };
      })
      .sort((a, b) => a.matriz.razao_social.localeCompare(b.matriz.razao_social));
  }, [membros]);

  const [abertos, setAbertos] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <ul className="space-y-0.5">
      {grupos.map(({ matriz, filiais }) => {
        const aberto = abertos.has(matriz.id);
        return (
          <li key={matriz.id}>
            <div className="flex items-center gap-1">
              {filiais.length > 0 ? (
                <button
                  onClick={() => toggle(matriz.id)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
                  title={aberto ? "Recolher filiais" : "Expandir filiais"}
                >
                  {aberto ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <span className="w-[18px] shrink-0" />
              )}
              <Link
                href={`/concorrentes/${matriz.id}`}
                className="truncate text-sm font-medium text-primary hover:underline"
              >
                {matriz.razao_social}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                · {matriz.municipio ?? "—"}
                {filiais.length > 0 ? ` · ${filiais.length} filial(is)` : ""}
              </span>
            </div>
            {aberto && filiais.length > 0 && (
              <ul className="ml-5 border-l pl-2">
                {filiais.map((f) => (
                  <li key={f.id} className="py-0.5">
                    <Link
                      href={`/concorrentes/${f.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      {f.razao_social}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {" "}· {f.municipio ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
