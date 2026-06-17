"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getVisitaById } from "@/lib/supabase/visitas";

export default function VisitaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["visita", id],
    queryFn: () => getVisitaById(id),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Visita não encontrada.</p>
        <Button asChild variant="outline">
          <Link href="/visitas">
            <ArrowLeft className="h-4 w-4" /> Visitas
          </Link>
        </Button>
      </div>
    );
  }

  const { visita: v, concorrentes, pessoas, brindes } = data;
  const nome = v.cliente?.razao_social || v.cliente_nome_livre || "Cliente";
  const mapa =
    v.lat != null && v.lng != null
      ? `https://www.google.com/maps?q=${v.lat},${v.lng}`
      : null;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/visitas">
          <ArrowLeft className="h-4 w-4" /> Visitas
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">{nome}</h1>
        {v.perda_venda && <Badge variant="warning">perda de venda</Badge>}
      </div>

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 p-4 text-sm">
          <Campo label="Chegada" valor={(v.checkin_at ?? "").slice(0, 16).replace("T", " ")} />
          <Campo label="Saída" valor={v.checkout_at ? v.checkout_at.slice(0, 16).replace("T", " ") : "—"} />
          <Campo label="Motivo" valor={v.motivo?.nome ?? "—"} />
          <Campo label="Categoria" valor={v.categoria?.nome ?? "—"} />
          <Campo label="Segmento" valor={v.segmento ?? "—"} />
          <Campo
            label="Distância do check-in"
            valor={
              v.distancia_m != null
                ? `${(v.distancia_m / 1000).toFixed(2)} km`
                : "—"
            }
          />
          <div>
            <p className="text-xs text-muted-foreground">Localização</p>
            {mapa ? (
              <a
                href={mapa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <MapPin className="h-3.5 w-3.5" /> Abrir no mapa
              </a>
            ) : (
              <p>—</p>
            )}
          </div>
          {v.observacoes && (
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Observações</p>
              <p className="whitespace-pre-wrap">{v.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {concorrentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Concorrentes ({concorrentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {concorrentes.map((c) => (
              <div key={c.id} className="p-3 text-sm">
                <p className="font-medium">{c.concorrente_nome || "—"}</p>
                <p className="text-xs text-muted-foreground">
                  {[
                    c.produto,
                    c.preco != null ? `R$ ${c.preco}` : null,
                    c.frete_valor != null ? `frete R$ ${c.frete_valor}/t` : null,
                    c.distancia_km != null ? `${c.distancia_km} km` : null,
                    c.rs_ton_km != null ? `${c.rs_ton_km} R$/t/km` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pessoas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Pessoas ({pessoas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {pessoas.map((p) => (
              <div key={p.id} className="p-3 text-sm">
                {p.pessoa_nome ?? "—"}
                {p.cargo ? (
                  <span className="text-xs text-muted-foreground"> · {p.cargo}</span>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {brindes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Brindes entregues</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {brindes.map((b) => (
              <div key={b.id} className="flex justify-between p-3 text-sm">
                <span>{b.brinde?.nome ?? "—"}</span>
                <span className="tabular-nums text-muted-foreground">
                  {b.quantidade} un.
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{valor}</p>
    </div>
  );
}
