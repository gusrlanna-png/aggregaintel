"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BuscaTabela, normalizar } from "@/components/ui/busca-tabela";
import { Card, CardContent } from "@/components/ui/card";
import { getPessoas } from "@/lib/supabase/pessoas";

const LIMITE = 200;

export default function PessoasPage() {
  const [busca, setBusca] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["pessoas"],
    queryFn: getPessoas,
  });

  const todos = React.useMemo(() => data ?? [], [data]);
  const filtrados = React.useMemo(() => {
    const q = normalizar(busca);
    if (!q) return todos;
    return todos.filter((p) => normalizar(`${p.nome} ${p.municipio ?? ""}`).includes(q));
  }, [todos, busca]);
  const visiveis = filtrados.slice(0, LIMITE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Pessoas (sócios)</h1>
        <Link
          href="/concorrentes"
          className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Produtores
        </Link>
      </div>

      <BuscaTabela
        value={busca}
        onChange={setBusca}
        sugestoes={todos.map((p) => p.nome)}
        placeholder="Buscar pessoa por nome ou município…"
        id="pessoas"
      />

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          {filtrados.length.toLocaleString("pt-BR")} pessoas
          {filtrados.length > LIMITE && ` · exibindo as primeiras ${LIMITE}`}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma pessoa cadastrada. Os sócios são criados ao usar{" "}
            <strong>Atualizar dados</strong> nos produtores (quadro societário da
            Receita Federal).
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {visiveis.map((p) => (
              <Link
                key={p.id}
                href={`/pessoas/${p.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
              >
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[p.cpf, [p.municipio, p.uf].filter(Boolean).join("/")]
                      .filter(Boolean)
                      .join("  ·  ") || "—"}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {p.n_empresas} empresa{p.n_empresas === 1 ? "" : "s"}
                </Badge>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
