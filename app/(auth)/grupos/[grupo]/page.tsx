"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getGrupoEconomico, type MembroGrupo } from "@/lib/supabase/grupos";
import { fmtReais, fmtToneladas1 } from "@/lib/utils/agregados";
import { mascararCnpj } from "@/lib/utils/cnpj";

function papeis(m: MembroGrupo): { label: string; cls: string }[] {
  const out: { label: string; cls: string }[] = [];
  if (m.eh_cliente) out.push({ label: "Cliente", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" });
  if (m.eh_produtor) out.push({ label: "Produtor", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" });
  if (m.eh_fornecedor) out.push({ label: "Fornecedor", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" });
  if (m.eh_transportador) out.push({ label: "Transportador", cls: "bg-purple-500/15 text-purple-700 dark:text-purple-400" });
  return out;
}

function hrefMembro(m: MembroGrupo): string {
  if (m.eh_cliente) return `/clientes/${m.id}`;
  if (m.eh_produtor) return `/concorrentes/${m.id}`;
  return `/clientes/${m.id}`;
}

export default function GrupoPage() {
  const params = useParams<{ grupo: string }>();
  const nome = decodeURIComponent(params.grupo ?? "");

  const { data, isLoading } = useQuery({
    queryKey: ["grupo-economico", nome],
    queryFn: () => getGrupoEconomico(nome),
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/grupos">
          <ArrowLeft className="h-4 w-4" /> Grupos econômicos
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">{nome}</h1>
          <p className="text-sm text-muted-foreground">Grupo econômico · visão consolidada</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.membros.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma empresa neste grupo.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Resumo titulo="Empresas" valor={String(data.membros.length)} />
            <Resumo titulo="Volume (t)" valor={fmtToneladas1(data.ton)} />
            <Resumo titulo="Faturamento" valor={fmtReais(data.faturamento)} />
            <Resumo titulo="NFs" valor={String(data.nfs)} />
          </div>

          <Card>
            <CardContent className="divide-y p-0">
              {data.membros.map((m) => (
                <Link
                  key={m.id}
                  href={hrefMembro(m)}
                  className="flex items-start gap-2 p-3 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium">
                      <span className="truncate">{m.fantasia?.trim() || m.razao_social}</span>
                      {papeis(m).map((p) => (
                        <span key={p.label} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.cls}`}>
                          {p.label}
                        </span>
                      ))}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        m.cnpj ? mascararCnpj(m.cnpj) : m.cpf,
                        [m.municipio, m.uf].filter(Boolean).join("/"),
                        m.segmento,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {m.nfs > 0 && (
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold tabular-nums">{fmtToneladas1(m.ton)} t</p>
                      <p className="text-muted-foreground tabular-nums">{fmtReais(m.faturamento)}</p>
                    </div>
                  )}
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Resumo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="text-lg font-bold tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
}
