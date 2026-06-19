"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Pencil, RotateCw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TracaoCalculator,
  type ConsumoResult,
} from "@/components/clientes/tracao-calculator";
import {
  FornecedorMix,
  type MixRow,
} from "@/components/clientes/fornecedor-mix";
import { OportunidadeMBV } from "@/components/clientes/oportunidade-mbv";
import { NfsCliente } from "@/components/clientes/nfs-cliente";
import { PapeisEmpresa } from "@/components/empresas/papeis-empresa";
import { DistribuicaoMensal } from "@/components/clientes/distribuicao-mensal";
import {
  getClienteById,
  getClientesDoGrupo,
  atualizarCadastralCliente,
  getSociosCliente,
  salvarSociosCliente,
} from "@/lib/supabase/clientes";
import { getEmissores } from "@/lib/supabase/emissores";
import { getVinculoPorCnpj } from "@/lib/supabase/vinculos";
import { buscarCadastroCnpj } from "@/lib/utils/cnpj";
import { saveTraco, saveFornecedorMix } from "@/lib/supabase/consumo";
import { getNFsCliente } from "@/lib/supabase/nf";
import {
  SEGMENTOS,
  precoEfetivoMedioPorTipo,
  type Segmento,
} from "@/lib/utils/agregados";

const MapaEditavel = dynamic(
  () => import("@/components/maps/mapa-editavel").then((m) => m.MapaEditavel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[300px] items-center justify-center rounded-md border bg-muted text-muted-foreground">
        <MapPin className="h-6 w-6 animate-pulse" />
      </div>
    ),
  }
);

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  // Origem do acesso (ex.: vindo de uma visita) — permite voltar ao ponto que parou.
  const retorno = searchParams.get("retorno");
  const voltarHref = retorno || "/clientes";
  const voltarLabel = retorno ? "Voltar" : "Clientes";
  const queryClient = useQueryClient();
  const [consumo, setConsumo] = React.useState<ConsumoResult | null>(null);
  const [mix, setMix] = React.useState<MixRow[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [atualizando, setAtualizando] = React.useState(false);

  const handleConsumo = React.useCallback((r: ConsumoResult) => {
    setConsumo(r);
  }, []);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => getClienteById(id),
  });
  const { data: emissores } = useQuery({
    queryKey: ["emissores-all"],
    queryFn: () => getEmissores(),
  });
  const { data: vinculo } = useQuery({
    queryKey: ["vinculo", cliente?.cnpj],
    queryFn: () => getVinculoPorCnpj(cliente?.cnpj),
    enabled: !!cliente?.cnpj,
  });
  const { data: grupoMembros = [] } = useQuery({
    queryKey: ["cliente-grupo", cliente?.grupo_economico, id],
    queryFn: () =>
      cliente?.grupo_economico
        ? getClientesDoGrupo(cliente.grupo_economico, id)
        : Promise.resolve([]),
    enabled: Boolean(cliente?.grupo_economico),
  });
  const { data: socios = [] } = useQuery({
    queryKey: ["cliente-socios", id],
    queryFn: () => getSociosCliente(id),
  });
  // NFs reais do cliente → preço efetivo por produto (referência do planejamento).
  const { data: nfsCliente = [] } = useQuery({
    queryKey: ["cliente-nfs-preco", id],
    queryFn: () => getNFsCliente(id),
  });
  const precosEfetivos = React.useMemo(
    () => precoEfetivoMedioPorTipo(nfsCliente),
    [nfsCliente]
  );

  const produtos = consumo ? Object.keys(consumo.consumo_ton) : [];

  // Consumo anualizado para distribuir pela sazonalidade do segmento.
  const fatorAnual = consumo?.periodo_tipo === "mes" ? 12 : 1;
  const consumoAnual: Record<string, number> = Object.fromEntries(
    Object.entries(consumo?.consumo_ton ?? {}).map(([k, v]) => [
      k,
      v * fatorAnual,
    ])
  );
  const anoSaz =
    Number(consumo?.periodo_ref?.slice(0, 4)) || new Date().getFullYear();

  async function atualizarCadastro() {
    if (!cliente) return;
    setAtualizando(true);
    try {
      const c = await buscarCadastroCnpj(cliente.cnpj);
      await atualizarCadastralCliente(id, {
        razao_social: c.razao_social ?? cliente.razao_social,
        cnpj: c.cnpj ?? cliente.cnpj ?? undefined,
        logradouro: c.logradouro,
        bairro: c.bairro,
        municipio: c.municipio,
        uf: c.uf,
        cep: c.cep,
        fone: c.fone,
      });
      // Traz também o quadro societário (sócios) da Receita.
      let nSocios = 0;
      if (c.socios?.length) {
        await salvarSociosCliente(id, c.socios);
        nSocios = c.socios.filter((s) => s.nome?.trim()).length;
      }
      await queryClient.invalidateQueries({ queryKey: ["cliente", id] });
      await queryClient.invalidateQueries({ queryKey: ["cliente-socios", id] });
      toast.success(
        `Dados atualizados via Receita Federal${c.situacao ? ` · ${c.situacao}` : ""}${
          nSocios ? ` · ${nSocios} sócio(s)` : ""
        }.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar dados.");
    } finally {
      setAtualizando(false);
    }
  }

  async function salvar() {
    if (!consumo) return;
    setSaving(true);
    try {
      const traco = await saveTraco({
        cliente_id: id,
        segmento: consumo.segmento,
        subtipo: consumo.subtipo ?? null,
        periodo_tipo: consumo.periodo_tipo,
        periodo_ref: consumo.periodo_ref,
        producao_volume: consumo.producao_volume,
        producao_unit: consumo.producao_unit,
        traco_kg: consumo.traco_kg,
        caminhao_tipo: consumo.caminhao_tipo ?? null,
        caminhao_peso_t: consumo.caminhao_peso_t ?? null,
      });
      await saveFornecedorMix(
        traco.id,
        mix.map((m) => ({
          emissor_id: m.emissor_id,
          nome_fornecedor: m.nome_fornecedor,
          produto_tipo: m.produto_tipo,
          share_pct: m.share_pct,
          periodo_tipo: consumo.periodo_tipo,
          periodo_ref: consumo.periodo_ref,
        }))
      );
      toast.success("Traço e mix de fornecedores salvos.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!cliente) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Cliente não encontrado.</p>
        <Button asChild variant="outline">
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
    );
  }

  const seg = SEGMENTOS[cliente.segmento as Segmento] ?? SEGMENTOS.outro;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href={voltarHref}>
            <ArrowLeft className="h-4 w-4" /> {voltarLabel}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={atualizarCadastro}
            disabled={atualizando}
            title="Preenche os dados cadastrais pela Receita Federal (BrasilAPI)"
          >
            {atualizando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCw className="h-4 w-4" />
            )}
            Atualizar dados
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/clientes/${id}/editar${retorno ? `?retorno=${encodeURIComponent(retorno)}` : ""}`}>
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {cliente.razao_social}
          </h1>
          <p className="text-sm text-muted-foreground">
            {cliente.municipio ?? "—"} · {cliente.uf ?? ""} ·{" "}
            {cliente.cnpj ?? cliente.cpf ?? ""}
          </p>
        </div>
        <Badge className={seg.corClasse}>{seg.label}</Badge>
      </div>

      {vinculo?.emissor_id && (
        <Link
          href={`/concorrentes/${vinculo.emissor_id}`}
          className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm hover:bg-emerald-100"
        >
          <span className="flex items-center gap-2 text-emerald-800">
            <Badge variant="secondary">Também é produtor</Badge>
            Mesma empresa cadastrada como produtor — ver títulos/CFEM
          </span>
          <ArrowLeft className="h-4 w-4 rotate-180 text-emerald-700" />
        </Link>
      )}

      {/* Dados cadastrais */}
      <Card>
        <CardContent className="p-4">
          {(
            [
              ["Razão social / nome", cliente.razao_social],
              ["CNPJ", cliente.cnpj],
              ["CPF", cliente.cpf],
              ["Segmento", seg.label],
              ["Grupo econômico", cliente.grupo_economico],
              ["Transportadora", cliente.transportadora],
              ["Telefone", cliente.fone],
              ["Endereço", cliente.logradouro],
              ["Bairro", cliente.bairro],
              ["Município", cliente.municipio],
              ["UF", cliente.uf],
              ["CEP", cliente.cep],
            ] as [string, string | null | undefined][]
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex justify-between gap-4 py-1.5 text-sm"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="text-right font-medium">{value || "—"}</span>
            </div>
          ))}
          {cliente.notas && (
            <p className="mt-2 rounded-md bg-muted p-2 text-sm">
              {cliente.notas}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Localização no mapa */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <MapPin className="h-4 w-4" /> Localização no mapa
          </p>
          <MapaEditavel
            tabela="clientes"
            id={id}
            lat={cliente.lat ?? null}
            lng={cliente.lng ?? null}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ["cliente", id] });
              queryClient.invalidateQueries({ queryKey: ["mapa-clientes"] });
            }}
          />
        </CardContent>
      </Card>

      {/* Contatos */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">Contatos</p>
          {cliente.contatos && cliente.contatos.length > 0 ? (
            <ul className="space-y-2">
              {cliente.contatos.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium">{c.nome}</span>
                  {c.cargo ? (
                    <span className="text-muted-foreground"> · {c.cargo}</span>
                  ) : null}
                  {(c.fone || c.email) && (
                    <span className="block text-xs text-muted-foreground">
                      {[c.fone, c.email].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum contato cadastrado. Use <strong>Editar</strong> para
              adicionar.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Empresas do grupo econômico */}
      {cliente.grupo_economico && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium">
              Grupo {cliente.grupo_economico}
            </p>
            {grupoMembros.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma outra empresa vinculada a este grupo.
              </p>
            ) : (
              <ul className="space-y-1">
                {grupoMembros.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/clientes/${g.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {g.razao_social}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {g.municipio ?? "—"} · {g.cnpj ?? g.cpf ?? ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Papéis do cadastro único (produtor/cliente/fornecedor/transportador) */}
      <PapeisEmpresa empresaId={id} />

      {/* Quadro societário (sócios) — trazido pelo "Atualizar dados" */}
      {socios.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium">Quadro societário</p>
            <ul className="divide-y">
              {socios.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <Link
                    href={s.pessoa_id ? `/pessoas/${s.pessoa_id}` : "#"}
                    className={
                      s.pessoa_id
                        ? "min-w-0 truncate font-medium text-primary hover:underline"
                        : "min-w-0 truncate font-medium"
                    }
                  >
                    {s.nome}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {[s.qualificacao, s.faixa_etaria].filter(Boolean).join(" · ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Volume real confirmado (NFs recebidas) — referência para o planejamento */}
      <NfsCliente clienteId={id} />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          1. Calculadora de traço
        </h2>
        <TracaoCalculator onChange={handleConsumo} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          2. Mix de fornecedores
        </h2>
        <FornecedorMix
          produtos={produtos}
          emissores={emissores ?? []}
          rows={mix}
          onChange={setMix}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          3. Oportunidade MBV
        </h2>
        <OportunidadeMBV
          consumo={consumo?.consumo_ton ?? {}}
          mix={mix}
          precosEfetivos={precosEfetivos}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          4. Distribuição mensal (sazonalidade)
        </h2>
        <DistribuicaoMensal
          consumoAnual={consumoAnual}
          mix={mix}
          segmento={cliente.segmento}
          ano={anoSaz}
          precosEfetivos={precosEfetivos}
        />
      </section>

      <Button onClick={salvar} disabled={saving || !consumo} className="w-full" size="lg">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Salvar análise do cliente
      </Button>
    </div>
  );
}
