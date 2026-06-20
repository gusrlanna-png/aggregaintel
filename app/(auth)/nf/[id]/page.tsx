"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Loader2, Pencil, Truck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getNFById, toggleDesconsiderada } from "@/lib/supabase/nf";
import { getNFUrl } from "@/lib/supabase/storage";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { NfObraSelect } from "@/components/nf/nf-obra-select";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fmtReais,
  fmtReaisDec,
  fmtToneladas1,
  labelProduto,
  precoEfetivoTon,
  temDescontoNota,
} from "@/lib/utils/agregados";
import { mascararCnpj } from "@/lib/utils/cnpj";
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
  const qc = useQueryClient();
  const [desconsiderando, setDesconsiderando] = React.useState(false);

  async function handleDesconsiderar(valor: boolean) {
    setDesconsiderando(true);
    try {
      await toggleDesconsiderada(id, valor);
      qc.invalidateQueries({ queryKey: ["nf", id] });
      toast.success(valor ? "NF marcada como desconsiderada." : "NF reativada nos cálculos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar NF.");
    } finally {
      setDesconsiderando(false);
    }
  }

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
          {n.desconsiderada ? (
            <Badge variant="destructive">Desconsiderada</Badge>
          ) : (
            <Badge variant={n.revisado ? "success" : "warning"}>
              {n.revisado ? "Revisado" : "Pendente de revisão"}
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className={n.desconsiderada ? "text-emerald-600" : "text-muted-foreground"}
            onClick={() => handleDesconsiderar(!n.desconsiderada)}
            disabled={desconsiderando}
            title={n.desconsiderada ? "Reativar esta NF nos cálculos" : "Desconsiderar — exclui dos cálculos"}
          >
            {desconsiderando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            {n.desconsiderada ? "Reativar" : "Desconsiderar"}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/nf/${n.id}/editar`}>
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </Button>
        </div>
      </div>

      {n.desconsiderada && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <Ban className="h-4 w-4 shrink-0" />
          <span>Esta NF está <strong>desconsiderada</strong> — não entra em nenhum cálculo, média ou projeção.</span>
        </div>
      )}

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
              <Row
                label="Valor unitário (destacado)"
                value={fmtReais(n.valor_unitario)}
              />
              <Row label="Valor total (produtos)" value={fmtReais(n.valor_total)} />
              <Row label="Valor da nota (líquido)" value={fmtReais(n.valor_total_nota)} />
              <Row
                label="Preço efetivo"
                value={
                  <span className="font-semibold">
                    {fmtReais(precoEfetivoTon(n))}/t
                  </span>
                }
              />
              {temDescontoNota(n) && (
                <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                  <strong>Desconto em nota</strong>: valor unitário destacado{" "}
                  {fmtReais(n.valor_unitario)}/t, mas o preço efetivo (nota ÷ peso)
                  é <strong>{fmtReais(precoEfetivoTon(n))}/t</strong>. O efetivo é a
                  referência usada no planejamento.
                </div>
              )}
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
              <Row label="Endereço de entrega" value={n.end_entrega} />
              <NfObraSelect nfId={n.id} clienteId={n.cliente_id ?? null} enderecoId={n.endereco_id ?? null} />
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
                    <Row label="Código ANTT" value={n.codigo_antt} />
                    <Row label="Transportador" value={n.transportador} />
                    <Row label="Motorista" value={n.motorista_nome} />
                    <Row
                      label="CNPJ transp."
                      value={n.transportador_doc ? mascararCnpj(n.transportador_doc) : null}
                    />
                    <Row label="IE transp." value={n.transportador_ie} />
                    <Row label="Placa" value={n.placa_veiculo} />
                    <Row label="UF veículo" value={n.uf_veiculo} />
                    <Row
                      label="Peso bruto"
                      value={n.peso_bruto ? `${n.peso_bruto} t` : null}
                    />
                    <Row
                      label="Peso líquido"
                      value={n.peso_liquido ? `${n.peso_liquido} t` : null}
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
                <ZoomableImage src={imgUrl} alt="NF" />
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
