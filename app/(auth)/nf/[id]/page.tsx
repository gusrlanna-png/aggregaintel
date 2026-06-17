"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Pencil, Truck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getNFById } from "@/lib/supabase/nf";
import { getNFUrl } from "@/lib/supabase/storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fmtReais,
  fmtReaisDec,
  fmtToneladas1,
  labelProduto,
} from "@/lib/utils/agregados";
import type { NotaFiscal } from "@/lib/supabase/types";

function cifFob(v?: string | null): "CIF" | "FOB" | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (s.includes("emit") || s.trim() === "0") return "CIF";
  if (s.includes("dest") || s.trim() === "1") return "FOB";
  return null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default function NFDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data: nf, isLoading } = useQuery({
    queryKey: ["nf", id],
    queryFn: () => getNFById(id),
  });

  const { data: imgUrl } = useQuery({
    queryKey: ["nf-img", nf?.arquivo_url],
    queryFn: () =>
      nf?.arquivo_url && isSupabaseConfigured()
        ? getNFUrl(nf.arquivo_url)
        : Promise.resolve(null),
    enabled: Boolean(nf?.arquivo_url),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!nf) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">NF não encontrada.</p>
        <Button asChild variant="outline">
          <Link href="/nf">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
    );
  }

  const n: NotaFiscal = nf;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/nf">
            <ArrowLeft className="h-4 w-4" /> NFs
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={n.revisado ? "success" : "warning"}>
            {n.revisado ? "Revisado" : "Pendente de revisão"}
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link href={`/nf/${n.id}/editar`}>
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight">
          NF {n.numero_nf}
          {n.serie ? `/${n.serie}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {n.emissor?.razao_social ?? "Emissor não identificado"} ·{" "}
          {n.data_emissao}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produto</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Row label="Tipo" value={labelProduto(n.produto_tipo)} />
              <Row label="Descrição" value={n.produto_desc} />
              <Row label="NCM" value={n.produto_ncm} />
              <Row
                label="Quantidade"
                value={`${fmtToneladas1(n.quantidade_ton)} t`}
              />
              <Row label="Valor unitário" value={fmtReais(n.valor_unitario)} />
              <Row label="Valor total" value={fmtReais(n.valor_total)} />
              {(() => {
                const calc =
                  n.quantidade_ton > 0 && (n.valor_total ?? 0) > 0
                    ? (n.valor_total as number) / n.quantidade_ton
                    : 0;
                const unit = n.valor_unitario ?? 0;
                const diverge =
                  unit > 0 && calc > 0 && Math.abs(unit - calc) / calc > 0.05;
                if (calc <= 0) return null;
                return (
                  <div
                    className={`mt-2 rounded-md p-2 text-xs ${
                      diverge
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    Preço (total ÷ peso): {fmtReais(calc)}/t
                    {diverge
                      ? ` — diverge do valor unitário (${fmtReais(unit)}/t).`
                      : ""}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emissor & destinatário</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Row label="Emissor" value={n.emissor?.razao_social} />
              <Row label="Município emissor" value={n.emissor?.municipio} />
              <Row label="Cliente" value={n.cliente?.razao_social} />
              <Row label="CFOP" value={n.cfop} />
              <Row label="Natureza" value={n.natureza_op} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="h-4 w-4" /> Transporte / Frete
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const cf = cifFob(n.frete_por_conta);
                const rsTonKm =
                  (n.frete_valor ?? 0) > 0 &&
                  n.quantidade_ton > 0 &&
                  (n.distancia_km ?? 0) > 0
                    ? (n.frete_valor as number) /
                      (n.quantidade_ton * (n.distancia_km as number))
                    : 0;
                return (
                  <>
                    <Row
                      label="Modalidade"
                      value={
                        cf ? (
                          <Badge variant={cf === "CIF" ? "info" : "secondary"}>
                            {cf}
                          </Badge>
                        ) : (
                          n.frete_por_conta
                        )
                      }
                    />
                    <Row label="Valor do frete" value={fmtReais(n.frete_valor)} />
                    <Row
                      label="Distância"
                      value={n.distancia_km ? `${n.distancia_km} km` : null}
                    />
                    <Row
                      label="R$/t/km"
                      value={rsTonKm > 0 ? fmtReaisDec(rsTonKm) : null}
                    />
                    <Row label="Transportador" value={n.transportador} />
                    <Row label="Placa" value={n.placa_veiculo} />
                    <Row label="UF veículo" value={n.uf_veiculo} />
                    <Row
                      label="Peso bruto"
                      value={n.peso_bruto ? `${n.peso_bruto} t` : null}
                    />
                    <Row label="Espécie" value={n.especie_carga} />
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Impostos</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Row
                label="ICMS"
                value={
                  n.icms_isento ? "Isento" : fmtReais(n.icms_valor)
                }
              />
              <Row label="Fundamento" value={n.icms_fundamento} />
            </CardContent>
          </Card>
        </div>

        <div className="order-first lg:order-last">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Imagem original</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {imgUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imgUrl}
                  alt="NF"
                  className="w-full rounded-md border"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {isSupabaseConfigured()
                    ? "Sem imagem anexada."
                    : "Imagem disponível somente com Supabase configurado."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
