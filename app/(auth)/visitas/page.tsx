"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Loader2, MapPin, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BuscaTabela, matchBusca } from "@/components/ui/busca-tabela";
import { getVisitas } from "@/lib/supabase/visitas";

export default function VisitasPage() {
  const [busca, setBusca] = React.useState("");
  const { data: visitas = [], isLoading } = useQuery({
    queryKey: ["visitas"],
    queryFn: getVisitas,
  });

  const rows = visitas.filter((v) =>
    matchBusca(
      busca,
      v.cliente?.razao_social,
      v.cliente_nome_livre,
      v.pessoa_nome,
      v.motivo?.nome,
      v.segmento
    )
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">Visitas</h1>
        <Link
          href="/visitas/nova"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" /> Nova visita
        </Link>
      </div>

      <BuscaTabela
        value={busca}
        onChange={setBusca}
        placeholder="Buscar por cliente, pessoa, motivo…"
        id="visitas"
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma visita registrada. Toque em <strong>Nova visita</strong> para
            fazer o check-in.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((v) => {
              const nome =
                v.cliente?.razao_social ||
                v.cliente_nome_livre ||
                "Cliente não informado";
              const data = (v.checkin_at ?? "").slice(0, 16).replace("T", " ");
              return (
                <Link
                  key={v.id}
                  href={`/visitas/${v.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{nome}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[data, v.motivo?.nome, v.pessoa_nome]
                        .filter(Boolean)
                        .join("  ·  ")}
                    </p>
                  </div>
                  {v.perda_venda && (
                    <Badge variant="warning" className="shrink-0 text-[10px]">
                      perda
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
