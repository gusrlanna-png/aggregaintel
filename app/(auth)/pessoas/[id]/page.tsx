"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, RotateCw, Save, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GrupoSelect } from "@/components/concorrentes/grupo-select";
import { GrupoEmpresaCard } from "@/components/empresas/grupo-empresa-card";
import { ContatoExtras } from "@/components/pessoas/contato-extras";
import { PessoaIdentidades } from "@/components/pessoas/pessoa-identidades";
import { agruparEmpresas } from "@/lib/utils/agrupar-empresas";
import { mascararCnpj } from "@/lib/utils/cnpj";
import { getGruposEconomicos } from "@/lib/supabase/emissores";
import { getHistoricoBrindes } from "@/lib/supabase/brindes";
import { EmailsContato } from "@/components/ms365/emails-contato";
import {
  getPessoaById,
  getEmpresasDaPessoa,
  atualizarPessoa,
  getPessoaSociedades,
  cadastrarSociedadeComoEmissor,
  type Pessoa,
} from "@/lib/supabase/pessoas";
import { enqueueJob } from "@/lib/jobs/client";

const CAMPOS: { k: keyof Pessoa; label: string; type?: string }[] = [
  { k: "cpf", label: "CPF" },
  { k: "email", label: "E-mail principal" },
  { k: "fone", label: "Telefone principal" },
  { k: "aniversario", label: "Aniversário", type: "date" },
  { k: "logradouro", label: "Endereço principal" },
  { k: "municipio", label: "Município" },
  { k: "uf", label: "UF" },
  { k: "cep", label: "CEP" },
];

export default function PessoaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [form, setForm] = React.useState<Partial<Pessoa>>({});
  const [salvando, setSalvando] = React.useState(false);
  const [atualizando, setAtualizando] = React.useState(false);
  const [cadastrando, setCadastrando] = React.useState<string | null>(null);

  async function cadastrarSoc(socId: string, cnpj: string | null, nome: string) {
    setCadastrando(socId);
    try {
      const eid = await cadastrarSociedadeComoEmissor(socId, cnpj, nome);
      if (!eid) {
        toast.error("Não foi possível cadastrar.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["pessoa-sociedades", id] });
      qc.invalidateQueries({ queryKey: ["pessoa-empresas", id] });
      qc.invalidateQueries({ queryKey: ["produtores-mercado"] });
      toast.success("Sociedade cadastrada como produtor (gestão completa).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar.");
    } finally {
      setCadastrando(null);
    }
  }

  const { data: pessoa, isLoading } = useQuery({
    queryKey: ["pessoa", id],
    queryFn: () => getPessoaById(id),
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ["pessoa-empresas", id],
    queryFn: () => getEmpresasDaPessoa(id),
  });
  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos-economicos"],
    queryFn: () => getGruposEconomicos(),
  });
  const { data: sociedades = [] } = useQuery({
    queryKey: ["pessoa-sociedades", id],
    queryFn: () => getPessoaSociedades(id),
  });
  const { data: brindesRecebidos = [] } = useQuery({
    queryKey: ["pessoa-brindes", id],
    queryFn: () => getHistoricoBrindes(id),
  });

  async function atualizarWeb() {
    if (!pessoa) return;
    setAtualizando(true);
    try {
      await enqueueJob({
        tipo: "person_analysis",
        titulo: `Atualizar contato: ${pessoa.nome}`,
        entidade_tipo: "pessoa",
        entidade_id: id,
        payload: {
          pessoaId: id,
          nome: pessoa.nome,
          empresas: empresas.map((e) => e.razao_social),
        },
      });
      toast.success(
        "Busca iniciada em segundo plano. Pode sair da página — acompanhe em 'Tarefas'."
      );
      // Atualiza os painéis quando o job terminar (polling leve por alguns ciclos)
      for (const ms of [8000, 16000, 30000, 50000]) {
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["pessoa", id] });
          qc.invalidateQueries({ queryKey: ["pessoa-links", id] });
          qc.invalidateQueries({ queryKey: ["pessoa-sociedades", id] });
        }, ms);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar a tarefa.");
    } finally {
      setAtualizando(false);
    }
  }

  React.useEffect(() => {
    if (pessoa) setForm(pessoa);
  }, [pessoa]);

  const gruposDistintos = React.useMemo(
    () => Array.from(new Set(empresas.map((e) => e.grupo_economico).filter(Boolean))),
    [empresas]
  );
  // "Outras sociedades" não deve repetir empresas já listadas como sócio.
  const sociedadesNovas = React.useMemo(() => {
    const ids = new Set(empresas.map((e) => e.emissor_id));
    const cnpjs = new Set(
      empresas.map((e) => (e.cnpj ?? "").replace(/\D/g, "")).filter(Boolean)
    );
    return sociedades.filter((s) => {
      if (s.emissor_id && ids.has(s.emissor_id)) return false;
      const d = (s.cnpj ?? "").replace(/\D/g, "");
      if (d && cnpjs.has(d)) return false;
      return true;
    });
  }, [sociedades, empresas]);

  // Agrupa empresas repetidas/filiais (matriz em destaque, alfabético).
  const empresasAgrupadas = React.useMemo(
    () => agruparEmpresas(empresas, (e) => e.cnpj, (e) => e.razao_social),
    [empresas]
  );
  const sociedadesAgrupadas = React.useMemo(
    () => agruparEmpresas(sociedadesNovas, (s) => s.cnpj, (s) => s.empresa),
    [sociedadesNovas]
  );
  const ehMatriz = (cnpj?: string | null) =>
    (cnpj ?? "").replace(/\D/g, "").slice(8, 12) === "0001";

  async function salvar() {
    setSalvando(true);
    try {
      await atualizarPessoa(id, {
        nome: form.nome,
        cpf: form.cpf ?? null,
        email: form.email ?? null,
        fone: form.fone ?? null,
        logradouro: form.logradouro ?? null,
        municipio: form.municipio ?? null,
        uf: form.uf ?? null,
        cep: form.cep ?? null,
        notas: form.notas ?? null,
      });
      qc.invalidateQueries({ queryKey: ["pessoa", id] });
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success("Cadastro salvo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!pessoa) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Pessoa não encontrada.</p>
        <Button asChild variant="outline">
          <Link href="/pessoas"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/pessoas"><ArrowLeft className="h-4 w-4" /> Pessoas</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={atualizarWeb}
          disabled={atualizando}
          title="Busca na internet: CPF, endereços, redes, e-mails e outras sociedades"
        >
          {atualizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          Atualizar (web)
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">{pessoa.nome}</h1>
      </div>

      {/* Análise (resumo) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-2xl font-bold tabular-nums">{empresas.length}</p>
            <p className="text-xs text-muted-foreground">empresas como sócio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-2xl font-bold tabular-nums">{gruposDistintos.length}</p>
            <p className="text-xs text-muted-foreground">grupos econômicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-2xl font-bold tabular-nums">
              {new Set(empresas.map((e) => e.municipio).filter(Boolean)).size}
            </p>
            <p className="text-xs text-muted-foreground">municípios</p>
          </CardContent>
        </Card>
      </div>

      {/* Dados cadastrais (principais) */}
      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Nome</Label>
            <Input
              value={form.nome ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            />
          </div>
          {CAMPOS.map((c) => (
            <div key={c.k} className="space-y-1.5">
              <Label className="text-xs">{c.label}</Label>
              <Input
                type={c.type}
                value={(form[c.k] as string) ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [c.k]: e.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Notas</Label>
            <Textarea
              value={form.notas ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar cadastro
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contatos: telefones, e-mails, endereços e redes (logo abaixo dos dados) */}
      <ContatoExtras pessoaId={id} />

      {/* Identidades de origem (M365, 365, LinkedIn, WhatsApp…) */}
      <PessoaIdentidades pessoaId={id} />

      {/* Empresas em que é sócio */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">
            Empresas em que é sócio ({empresas.length})
          </p>
          {empresas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma empresa vinculada.
            </p>
          ) : (
            <div className="divide-y">
              {empresasAgrupadas.map((g) => (
                <GrupoEmpresaCard
                  key={g.chave}
                  matriz={g.matriz}
                  extras={g.unidades.slice(1)}
                  renderUnidade={(e, isMatriz) => (
                    <div className="flex items-start gap-2">
                      <Link
                        href={`/concorrentes/${e.emissor_id}`}
                        className="min-w-0 flex-1 hover:underline"
                      >
                        <p className="truncate text-sm leading-snug">
                          <span className={isMatriz ? "font-semibold" : "font-medium"}>
                            {e.razao_social}
                          </span>
                          {ehMatriz(e.cnpj) && (
                            <Badge variant="outline" className="ml-1 text-[10px]">
                              matriz
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            e.cnpj ? mascararCnpj(e.cnpj) : null,
                            [e.municipio, e.uf].filter(Boolean).join("/") || null,
                            e.cargo,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </Link>
                      <GrupoSelect
                        emissorId={e.emissor_id}
                        grupoAtual={e.grupo_economico}
                        grupos={grupos}
                        compact
                        onChanged={() => {
                          qc.invalidateQueries({ queryKey: ["pessoa-empresas", id] });
                          qc.invalidateQueries({ queryKey: ["grupos-economicos"] });
                          qc.invalidateQueries({ queryKey: ["produtores-mercado"] });
                        }}
                      />
                    </div>
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outras sociedades encontradas na web */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-2 text-sm font-medium">
            Outras sociedades encontradas ({sociedadesNovas.length})
          </p>
          {sociedadesNovas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma sociedade adicional além das já listadas acima. Use{" "}
              <strong>Atualizar (web)</strong> para buscar mais.
            </p>
          ) : (
            <div className="divide-y">
              {sociedadesAgrupadas.map((g) => (
                <GrupoEmpresaCard
                  key={g.chave}
                  matriz={g.matriz}
                  extras={g.unidades.slice(1)}
                  renderUnidade={(s) => (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{s.empresa}</span>
                        {ehMatriz(s.cnpj) && (
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            matriz
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {[
                            s.cnpj ? mascararCnpj(s.cnpj) : null,
                            s.cargo,
                            s.situacao,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                            ? ` · ${[
                                s.cnpj ? mascararCnpj(s.cnpj) : null,
                                s.cargo,
                                s.situacao,
                              ]
                                .filter(Boolean)
                                .join(" · ")}`
                            : ""}
                        </span>
                        {s.fonte_url && (
                          <a
                            href={s.fonte_url}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-1 text-xs text-primary hover:underline"
                          >
                            (fonte)
                          </a>
                        )}
                      </div>
                      {s.emissor_id ? (
                        <Link
                          href={`/concorrentes/${s.emissor_id}`}
                          className="shrink-0 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                        >
                          Ver cadastro
                        </Link>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 text-xs"
                          disabled={cadastrando === s.id}
                          onClick={() => cadastrarSoc(s.id, s.cnpj, s.empresa)}
                        >
                          {cadastrando === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          Cadastrar
                        </Button>
                      )}
                    </div>
                  )}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* E-mails Microsoft 365 */}
      {pessoa.email && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-3 text-sm font-medium">E-mails (Microsoft 365)</p>
            <EmailsContato email={pessoa.email} />
          </CardContent>
        </Card>
      )}

      {/* Brindes recebidos */}
      {brindesRecebidos.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium">
              Brindes recebidos ({brindesRecebidos.length})
            </p>
            <ul className="divide-y">
              {brindesRecebidos.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {b.brinde?.nome ?? "—"}
                    {b.cliente?.razao_social ? (
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        · {b.cliente.razao_social}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {b.quantidade} un. · {(b.criado_em ?? "").slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
