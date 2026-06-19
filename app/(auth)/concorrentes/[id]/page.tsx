"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Pencil, RefreshCw, Radar, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ProjecaoUI } from "@/components/concorrentes/projecao-ui";
import { AnaliseMercado } from "@/components/concorrentes/analise-mercado";
import { CfemPainel } from "@/components/concorrentes/cfem-painel";
import { ConcorrentesProximos } from "@/components/concorrentes/concorrentes-proximos";
import { GrupoSelect } from "@/components/concorrentes/grupo-select";
import { GrupoArvore } from "@/components/concorrentes/grupo-arvore";
import {
  getEmissorComNFs,
  upsertEmissor,
  getSocios,
  getUnidadesPorRaiz,
  getGruposEconomicos,
} from "@/lib/supabase/emissores";
import { setMonitorarAnm, sincronizarAnm } from "@/lib/supabase/cfem";
import { getVinculoPorCnpj } from "@/lib/supabase/vinculos";
import {
  getProcessosJuridicos,
  getProcessosAmbientais,
  getLinksEmpresa,
} from "@/lib/supabase/cadastro-empresa";
import { enqueueJob } from "@/lib/jobs/client";
import { EmissorNFsTab } from "@/components/concorrentes/emissor-nfs-tab";
import { PapeisEmpresa } from "@/components/empresas/papeis-empresa";
import {
  isMbvEmissor,
  fmtNumero,
  fmtReais,
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default function ConcorrenteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [savingMbv, setSavingMbv] = React.useState(false);
  const [savingMon, setSavingMon] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [atualizando, setAtualizando] = React.useState(false);

  async function atualizarCadastro() {
    if (!data) return;
    setAtualizando(true);
    try {
      await enqueueJob({
        tipo: "cascade_update",
        titulo: `Atualizar em cadeia: ${data.emissor.razao_social}`,
        entidade_tipo: "emissor",
        entidade_id: data.emissor.id,
        payload: { emissorId: data.emissor.id },
      });
      toast.success(
        "Atualização em cadeia iniciada em segundo plano (empresa + grupo + sócios). Pode sair da página — acompanhe em 'Tarefas'."
      );
      for (const ms of [10000, 25000, 45000, 70000]) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["emissor", id] });
          queryClient.invalidateQueries({ queryKey: ["socios", id] });
          queryClient.invalidateQueries({ queryKey: ["produtores-mercado"] });
        }, ms);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar a tarefa.");
    } finally {
      setAtualizando(false);
    }
  }

  async function toggleMonitorar(checked: boolean) {
    if (!data) return;
    setSavingMon(true);
    try {
      await setMonitorarAnm(data.emissor.id, checked);
      await queryClient.invalidateQueries({ queryKey: ["emissor", id] });
      toast.success(
        checked ? "Produtor incluído no monitoramento ANM." : "Monitoramento ANM desativado."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setSavingMon(false);
    }
  }

  async function atualizarAnm() {
    setSyncing(true);
    try {
      const r = await sincronizarAnm();
      if (r.ok) {
        toast.success(
          `ANM atualizada: ${r.titulos_upsert ?? 0} títulos, ${r.produtores_renomeados ?? 0} produtores.`
        );
        await queryClient.invalidateQueries({ queryKey: ["titulos-sigmine"] });
        await queryClient.invalidateQueries({ queryKey: ["emissor", id] });
      } else {
        toast.error("Falha na sincronização: " + (r.erro ?? "erro desconhecido"));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["emissor", id],
    queryFn: () => getEmissorComNFs(id),
  });
  const { data: vinculo } = useQuery({
    queryKey: ["vinculo", data?.emissor.cnpj],
    queryFn: () => getVinculoPorCnpj(data?.emissor.cnpj),
    enabled: !!data?.emissor.cnpj,
  });
  const { data: socios = [] } = useQuery({
    queryKey: ["socios", id],
    queryFn: () => getSocios(id),
    enabled: !!data,
  });
  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades", data?.emissor.cnpj],
    queryFn: () => getUnidadesPorRaiz(data?.emissor.cnpj, id),
    enabled: !!data?.emissor.cnpj,
  });
  const { data: procJur = [] } = useQuery({
    queryKey: ["proc-jur", id],
    queryFn: () => getProcessosJuridicos(id),
    enabled: !!data,
  });
  const { data: procAmb = [] } = useQuery({
    queryKey: ["proc-amb", id],
    queryFn: () => getProcessosAmbientais(id),
    enabled: !!data,
  });
  const { data: links = [] } = useQuery({
    queryKey: ["links-emp", id],
    queryFn: () => getLinksEmpresa(id),
    enabled: !!data,
  });
  const { data: gruposEcon = [] } = useQuery({
    queryKey: ["grupos-economicos"],
    queryFn: () => getGruposEconomicos(),
  });

  async function toggleMbv(checked: boolean) {
    if (!data) return;
    setSavingMbv(true);
    try {
      await upsertEmissor({
        id: data.emissor.id,
        razao_social: data.emissor.razao_social,
        cnpj: data.emissor.cnpj ?? undefined,
        eh_mbv: checked,
      });
      await queryClient.invalidateQueries({ queryKey: ["emissor", id] });
      await queryClient.invalidateQueries({ queryKey: ["concorrentes"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(
        checked
          ? "Marcada como nossa empresa (MBV)."
          : "Desmarcada como nossa empresa."
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    } finally {
      setSavingMbv(false);
    }
  }

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
        <p className="text-sm text-muted-foreground">Produtor não encontrado.</p>
        <Button asChild variant="outline">
          <Link href="/concorrentes">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>
    );
  }

  const { emissor, nfs, grupo } = data;
  // NFs desconsideradas saem de todos os cálculos de produção/projeção,
  // mas continuam visíveis (marcadas) na aba de NFs.
  const nfsAtivas = nfs.filter((n) => !n.desconsiderada);
  const mbv = isMbvEmissor(emissor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/concorrentes">
            <ArrowLeft className="h-4 w-4" /> Produtores
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
            <Link href={`/concorrentes/${id}/editar`}>
              <Pencil className="h-4 w-4" /> Editar
            </Link>
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">
            {emissor.razao_social}
          </h1>
          {mbv && <Badge>MBV</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          {emissor.municipio ?? "—"} · {emissor.uf ?? ""} · CNPJ{" "}
          {emissor.cnpj ?? "—"}
        </p>
      </div>

      {vinculo?.cliente_id && (
        <Link
          href={`/clientes/${vinculo.cliente_id}`}
          className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm hover:bg-blue-100"
        >
          <span className="flex items-center gap-2 text-blue-800">
            <Badge variant="secondary">Também é cliente</Badge>
            Mesma empresa cadastrada como cliente — ver cadastro
          </span>
          <ArrowLeft className="h-4 w-4 rotate-180 text-blue-700" />
        </Link>
      )}

      {/* Grupo econômico */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">Grupo econômico</p>
            <p className="text-xs text-muted-foreground">
              Vincule a um grupo existente ou crie um novo na hora.
            </p>
          </div>
          <GrupoSelect
            emissorId={emissor.id}
            grupoAtual={emissor.grupo_economico}
            grupos={gruposEcon}
            onChanged={() => {
              queryClient.invalidateQueries({ queryKey: ["emissor", id] });
              queryClient.invalidateQueries({ queryKey: ["grupos-economicos"] });
              queryClient.invalidateQueries({ queryKey: ["produtores-mercado"] });
            }}
          />
        </CardContent>
      </Card>

      {/* Papéis do cadastro único (produtor/cliente/fornecedor/transportador) */}
      <PapeisEmpresa empresaId={id} />

      {/* Toggle "nossa empresa (MBV)" */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <Label htmlFor="mbv-toggle" className="text-sm font-medium">
              Empresa do nosso grupo (não-concorrente)
            </Label>
            <p className="text-xs text-muted-foreground">
              Marque para tratar como nossa empresa nas análises. O grupo
              econômico fica no cadastro (Editar).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {savingMbv && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              id="mbv-toggle"
              checked={mbv}
              disabled={savingMbv}
              onCheckedChange={toggleMbv}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="dados">
        <TabsList className="grid w-full grid-cols-6 text-[11px]">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="producao">Produção</TabsTrigger>
          <TabsTrigger value="nfs">NFs</TabsTrigger>
          <TabsTrigger value="cfem">CFEM</TabsTrigger>
          <TabsTrigger value="compliance">Jurídico/Amb.</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardContent className="p-4">
              <Row label="Razão social" value={emissor.razao_social} />
              <Row label="CNPJ" value={emissor.cnpj} />
              <Row label="Inscrição estadual" value={emissor.inscricao_est} />
              <Row label="Endereço" value={emissor.logradouro} />
              <Row label="Município" value={emissor.municipio} />
              <Row label="UF" value={emissor.uf} />
              <Row label="CEP" value={emissor.cep} />
              <Row label="Telefone" value={emissor.fone} />
              <Row label="Tipo" value={emissor.tipo} />
              <Row label="Data de fundação" value={emissor.data_fundacao} />
              <Row
                label="Situação cadastral"
                value={
                  emissor.situacao_cadastral ? (
                    <Badge
                      variant={
                        /ativ/i.test(emissor.situacao_cadastral)
                          ? "success"
                          : "warning"
                      }
                    >
                      {emissor.situacao_cadastral}
                    </Badge>
                  ) : null
                }
              />
              <Row label="Atividade principal" value={emissor.atividade_principal} />
              <Row
                label="Capital social"
                value={
                  emissor.capital_social != null
                    ? fmtReais(emissor.capital_social)
                    : null
                }
              />
              <Row label="Natureza jurídica" value={emissor.natureza_juridica} />
              <Row
                label="Matriz/Filial"
                value={emissor.matriz_filial}
              />
              <Row
                label="Status legal"
                value={
                  <Badge
                    variant={
                      emissor.status_legal === "ativo" ? "secondary" : "warning"
                    }
                  >
                    {emissor.status_legal ?? "—"}
                  </Badge>
                }
              />
              <Row label="Grupo econômico" value={emissor.grupo_economico} />
              <Row
                label="Capacidade"
                value={
                  emissor.capacidade_ton_mes
                    ? `${fmtNumero(emissor.capacidade_ton_mes)} t/mês`
                    : null
                }
              />
              {emissor.notas && (
                <p className="mt-2 rounded-md bg-muted p-2 text-sm">
                  {emissor.notas}
                </p>
              )}
            </CardContent>
          </Card>

          {emissor.grupo_economico && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-medium">
                  Empresas do grupo {emissor.grupo_economico}
                </p>
                {grupo.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma outra empresa vinculada a este grupo.
                  </p>
                ) : (
                  <GrupoArvore membros={[emissor, ...grupo]} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Quadro societário */}
          <Card className="mt-3">
            <CardContent className="p-4">
              <p className="mb-2 text-sm font-medium">
                Quadro societário ({socios.length})
              </p>
              {socios.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem sócios cadastrados. Use <strong>Atualizar dados</strong> para
                  buscar na Receita Federal.
                </p>
              ) : (
                <ul className="space-y-1">
                  {socios.map((s) => (
                    <li key={s.id} className="text-sm">
                      {s.pessoa_id ? (
                        <Link
                          href={`/pessoas/${s.pessoa_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {s.nome}
                        </Link>
                      ) : (
                        <span className="font-medium">{s.nome}</span>
                      )}
                      {s.qualificacao && (
                        <span className="text-xs text-muted-foreground">
                          {" "}· {s.qualificacao}
                        </span>
                      )}
                      {s.faixa_etaria && (
                        <span className="text-xs text-muted-foreground">
                          {" "}· {s.faixa_etaria}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Filiais / unidades (mesma raiz de CNPJ) */}
          {unidades.length > 0 && (
            <Card className="mt-3">
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-medium">
                  Filiais / unidades — mesma raiz de CNPJ ({unidades.length})
                </p>
                <ul className="space-y-1">
                  {unidades.map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/concorrentes/${u.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {u.razao_social}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {" "}· {u.municipio ?? "—"} · {u.cnpj}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card className="mt-3">
            <CardContent className="p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <MapPin className="h-4 w-4" /> Localização no mapa
              </p>
              <MapaEditavel
                tabela="emissores"
                id={emissor.id}
                lat={emissor.lat ?? null}
                lng={emissor.lng ?? null}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ["emissor", id] });
                  queryClient.invalidateQueries({
                    queryKey: ["produtores-mercado"],
                  });
                }}
              />
            </CardContent>
          </Card>

          <ConcorrentesProximos emissorId={emissor.id} />
        </TabsContent>

        <TabsContent value="producao">
          <ProjecaoUI emissorId={emissor.id} nfs={nfsAtivas} />
        </TabsContent>

        <TabsContent value="nfs">
          <EmissorNFsTab nfs={nfs} emissorId={emissor.id} />
        </TabsContent>

        <TabsContent value="cfem">
          <Card className="mb-3">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="mon-toggle" className="text-sm font-medium">
                    Monitorar ANM (mensal)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Inclui no agente que atualiza títulos/licenciamento (SIGMINE) todo dia 5.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={atualizarAnm}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Atualizar ANM agora
                </Button>
                {savingMon && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id="mon-toggle"
                  checked={Boolean(
                    (emissor as { monitorar?: boolean }).monitorar
                  )}
                  disabled={savingMon}
                  onCheckedChange={toggleMonitorar}
                />
              </div>
            </CardContent>
          </Card>
          <CfemPainel cnpj={emissor.cnpj} />
        </TabsContent>

        <TabsContent value="compliance" className="space-y-3">
          {/* Situação jurídica */}
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-sm font-medium">
                Situação jurídica ({procJur.length})
              </p>
              {procJur.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum processo registrado. Rode a <strong>Análise de mercado</strong> para identificar e cadastrar processos.
                </p>
              ) : (
                <ul className="space-y-2">
                  {procJur.map((p) => (
                    <li key={p.id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.tipo ?? "Processo"}{p.numero ? ` · ${p.numero}` : ""}</span>
                        {p.risco && (
                          <Badge
                            variant={
                              /alto|critic/i.test(p.risco) ? "warning" : "secondary"
                            }
                          >
                            risco {p.risco}
                          </Badge>
                        )}
                      </div>
                      {p.descricao && (
                        <p className="text-xs text-muted-foreground">{p.descricao}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {[p.orgao, p.status, p.data_ref].filter(Boolean).join(" · ")}
                        {p.fonte_url && (
                          <>
                            {" · "}
                            <a href={p.fonte_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">fonte</a>
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Situação ambiental */}
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-sm font-medium">
                Situação ambiental ({procAmb.length})
              </p>
              {procAmb.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum processo/licença registrado. A <strong>Análise de mercado</strong> busca licenciamento (SEMAD/SIAM) e autuações.
                </p>
              ) : (
                <ul className="space-y-2">
                  {procAmb.map((p) => (
                    <li key={p.id} className="rounded-md border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.tipo ?? "Processo"}{p.numero ? ` · ${p.numero}` : ""}</span>
                        {p.classe && <Badge variant="secondary">Classe {p.classe}</Badge>}
                      </div>
                      {p.descricao && (
                        <p className="text-xs text-muted-foreground">{p.descricao}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {[p.orgao, p.status, p.data_ref].filter(Boolean).join(" · ")}
                        {p.fonte_url && (
                          <>
                            {" · "}
                            <a href={p.fonte_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">fonte</a>
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Presença digital */}
          <Card>
            <CardContent className="p-4">
              <p className="mb-2 text-sm font-medium">
                Presença digital ({links.length})
              </p>
              {links.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum site/rede social vinculado. A <strong>Análise de mercado</strong> identifica site, Instagram, Facebook, LinkedIn e YouTube.
                </p>
              ) : (
                <ul className="space-y-1">
                  {links.map((l) => (
                    <li key={l.id} className="text-sm">
                      <span className="capitalize text-muted-foreground">{l.tipo}: </span>
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {l.label ?? l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analise">
          <AnaliseMercado
            nome={emissor.razao_social}
            cnpj={emissor.cnpj}
            municipio={emissor.municipio}
            emissorId={emissor.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
