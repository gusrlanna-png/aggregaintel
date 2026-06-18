"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getAgentes,
  toggleAgente,
  salvarAgente,
  getExecucoes,
  getEventos,
  type Agente,
} from "@/lib/supabase/agentes";
import type { Job } from "@/lib/jobs/client";
import { custoBRL } from "@/lib/utils/ai-pricing";

function fmtData(s?: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_COR: Record<string, string> = {
  concluido: "text-emerald-600",
  parcial: "text-amber-600",
  erro: "text-destructive",
  processando: "text-primary",
  pendente: "text-amber-600",
  cancelado: "text-muted-foreground",
};

export default function AgentesPage() {
  const qc = useQueryClient();
  const [sel, setSel] = React.useState<Agente | null>(null);
  const [jobSel, setJobSel] = React.useState<Job | null>(null);
  const [novo, setNovo] = React.useState(false);

  const { data: agentes = [], isLoading } = useQuery({
    queryKey: ["agentes"],
    queryFn: getAgentes,
    refetchInterval: 10000,
  });

  if (jobSel) return <ExecucaoDetalhe job={jobSel} onBack={() => setJobSel(null)} />;
  if (sel) return <AgenteDetalhe agente={sel} onBack={() => setSel(null)} onJob={setJobSel} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link href="/configuracoes"><ArrowLeft className="h-4 w-4" /> Configurações</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setNovo((v) => !v)}>
          <Plus className="h-4 w-4" /> Novo agente
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Agentes e monitoramento</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Ative/desative, defina regras e acompanhe todas as ações executadas.
        <strong> &quot;Ativo&quot; não significa rodando sozinho</strong> — hoje os
        agentes são acionados por você (ex.: botões &quot;Atualizar dados&quot; /
        &quot;Atualizar (web)&quot;). Abra um agente para ver o gatilho, a IA usada,
        a estratégia e o consumo de tokens.
      </p>

      {novo && <FormAgente onDone={() => { setNovo(false); qc.invalidateQueries({ queryKey: ["agentes"] }); }} />}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : agentes.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum agente cadastrado.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {agentes.map((a) => (
            <AgenteCard key={a.id} agente={a} onOpen={() => setSel(a)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgenteCard({ agente, onOpen }: { agente: Agente; onOpen: () => void }) {
  const qc = useQueryClient();
  const { data: execs = [] } = useQuery({
    queryKey: ["agente-execs", agente.chave],
    queryFn: () => getExecucoes(agente.chave, 200),
    refetchInterval: 10000,
  });
  const concl = execs.filter((e) => e.status === "concluido").length;
  const erros = execs.filter((e) => e.status === "erro").length;
  const ativos = execs.filter((e) => e.status === "pendente" || e.status === "processando").length;

  async function alternar(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await toggleAgente(agente.id, !agente.ativo);
      qc.invalidateQueries({ queryKey: ["agentes"] });
      toast.success(agente.ativo ? "Agente desativado." : "Agente ativado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro.");
    }
  }

  return (
    <Card className="cursor-pointer transition-shadow hover:shadow-md" onClick={onOpen}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{agente.nome}</p>
              <Badge variant="outline" className="text-[10px] capitalize">{agente.tipo}</Badge>
              <Badge variant={agente.ativo ? "success" : "secondary"} className="text-[10px]">
                {agente.ativo ? "ativo" : "inativo"}
              </Badge>
            </div>
            {agente.descricao && (
              <p className="mt-0.5 text-xs text-muted-foreground">{agente.descricao}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>{execs.length} execuções</span>
              <span className="text-emerald-600">{concl} ok</span>
              {erros > 0 && <span className="text-destructive">{erros} erro(s)</span>}
              {ativos > 0 && <span className="text-primary">{ativos} em andamento</span>}
            </div>
          </div>
          <button
            onClick={alternar}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${agente.ativo ? "bg-primary" : "bg-muted"}`}
            aria-label={agente.ativo ? "Desativar" : "Ativar"}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${agente.ativo ? "left-[1.375rem]" : "left-0.5"}`} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

function AgenteDetalhe({
  agente, onBack, onJob,
}: { agente: Agente; onBack: () => void; onJob: (j: Job) => void }) {
  const { data: execs = [] } = useQuery({
    queryKey: ["agente-execs", agente.chave],
    queryFn: () => getExecucoes(agente.chave, 100),
    refetchInterval: 5000,
  });

  const reg = (agente.regras ?? {}) as Record<string, string>;
  const tokens = execs.reduce((s, j) => {
    const r = (j.resultado ?? {}) as Record<string, number>;
    return s + (Number(r.tokens_in) || 0) + (Number(r.tokens_out) || 0);
  }, 0);
  const custo = execs.reduce((s, j) => {
    const r = (j.resultado ?? {}) as Record<string, unknown>;
    return (
      s +
      custoBRL(
        (r.modelo as string) ?? null,
        Number(r.tokens_in) || 0,
        Number(r.tokens_out) || 0
      )
    );
  }, 0);
  const concl = execs.filter((e) => e.status === "concluido").length;
  const temRegras = !!(reg.gatilho || reg.provedor || reg.estrategia || reg.custo);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Agentes</Button>
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">{agente.nome}</h1>
        <Badge variant={agente.ativo ? "success" : "secondary"} className="text-[10px]">
          {agente.ativo ? "ativo" : "inativo"}
        </Badge>
      </div>

      {/* Como funciona: gatilho, IA/fonte, estratégia, custo */}
      {temRegras && (
        <Card><CardContent className="space-y-2 p-4 text-sm">
          <p className="font-medium">Como funciona</p>
          <InfoLinha rotulo="Gatilho" valor={reg.gatilho} />
          <InfoLinha rotulo="IA / fonte" valor={reg.provedor} />
          <InfoLinha rotulo="Modelo" valor={reg.modelo} />
          <InfoLinha rotulo="Estratégia" valor={reg.estrategia} />
          <InfoLinha rotulo="Custo" valor={reg.custo} />
        </CardContent></Card>
      )}

      {/* Consumo / métricas */}
      <Card><CardContent className="grid grid-cols-2 gap-2 p-3 text-sm sm:grid-cols-5">
        <Metric label="Execuções" value={String(execs.length)} />
        <Metric label="Concluídas" value={String(concl)} />
        <Metric label="Tokens (acum.)" value={tokens ? tokens.toLocaleString("pt-BR") : "0"} />
        <Metric
          label="Custo est."
          value={custo > 0 ? `R$ ${custo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "R$ 0,00"}
        />
        <Metric label="Última" value={fmtData(execs[0]?.criado_em)} />
      </CardContent></Card>

      {/* Regras avançadas (JSON) para agentes customizados sem campos padrão */}
      {!temRegras && Object.keys(reg).length > 0 && (
        <Card><CardContent className="p-3">
          <p className="mb-1 text-xs font-medium">Regras</p>
          <pre className="overflow-x-auto text-xs text-muted-foreground">{JSON.stringify(agente.regras, null, 2)}</pre>
        </CardContent></Card>
      )}
      <p className="text-sm font-medium">Execuções ({execs.length})</p>
      {execs.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nenhuma execução ainda.
        </CardContent></Card>
      ) : (
        <Card><CardContent className="divide-y p-0">
          {execs.map((j) => (
            <button key={j.id} onClick={() => onJob(j)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50">
              <StatusIcon status={j.status} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{j.titulo ?? j.tipo}</p>
                <p className="text-xs text-muted-foreground">{fmtData(j.criado_em)}</p>
                {j.erro && (
                  <p className="mt-0.5 truncate text-xs text-destructive" title={j.erro}>
                    ⚠ {j.erro}
                  </p>
                )}
              </div>
              <span className={`shrink-0 text-xs ${STATUS_COR[j.status] ?? ""}`}>
                {j.status === "processando" ? `${j.progresso}%` : j.status}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

function ExecucaoDetalhe({ job, onBack }: { job: Job; onBack: () => void }) {
  const { data: eventos = [] } = useQuery({
    queryKey: ["job-eventos", job.id],
    queryFn: () => getEventos(job.id),
    refetchInterval: job.status === "processando" || job.status === "pendente" ? 2500 : false,
  });
  const nivelCor: Record<string, string> = {
    sucesso: "text-emerald-600",
    erro: "text-destructive",
    aviso: "text-amber-600",
    info: "text-muted-foreground",
  };
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      <div className="flex items-center gap-2">
        <StatusIcon status={job.status} />
        <h1 className="text-lg font-bold tracking-tight">{job.titulo ?? job.tipo}</h1>
      </div>
      <Card><CardContent className="grid grid-cols-2 gap-2 p-3 text-sm sm:grid-cols-4">
        <Metric label="Status" value={job.status} />
        <Metric label="Progresso" value={`${job.progresso}%`} />
        <Metric label="Criado" value={fmtData(job.criado_em)} />
        <Metric label="Concluído" value={fmtData(job.concluido_em)} />
      </CardContent></Card>
      {job.erro && (
        <Card><CardContent className="p-3 text-sm text-destructive">{job.erro}</CardContent></Card>
      )}
      <p className="text-sm font-medium">Log de ações ({eventos.length})</p>
      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem ações registradas.</p>
      ) : (
        <Card><CardContent className="space-y-2 p-3">
          {eventos.map((ev) => (
            <div key={ev.id} className="flex gap-2 text-xs">
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {new Date(ev.criado_em).toLocaleTimeString("pt-BR")}
              </span>
              <span className={`shrink-0 font-medium uppercase ${nivelCor[ev.nivel] ?? ""}`}>{ev.nivel}</span>
              <span className="min-w-0 flex-1">{ev.mensagem}</span>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}

function FormAgente({ onDone }: { onDone: () => void }) {
  const [chave, setChave] = React.useState("");
  const [nome, setNome] = React.useState("");
  const [descricao, setDescricao] = React.useState("");
  const [tipo, setTipo] = React.useState("tarefa");
  const [regras, setRegras] = React.useState("{}");
  const [salvando, setSalvando] = React.useState(false);

  async function salvar() {
    if (!chave.trim() || !nome.trim()) {
      toast.error("Chave e nome são obrigatórios.");
      return;
    }
    let regrasObj: Record<string, unknown> = {};
    try {
      regrasObj = JSON.parse(regras || "{}");
    } catch {
      toast.error("Regras inválidas (JSON).");
      return;
    }
    setSalvando(true);
    try {
      await salvarAgente({ chave: chave.trim(), nome: nome.trim(), descricao, tipo, regras: regrasObj });
      toast.success("Agente salvo.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card><CardContent className="grid gap-3 p-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label className="text-xs">Chave (= tipo do job)</Label>
        <Input value={chave} onChange={(e) => setChave(e.target.value)} placeholder="ex: cascade_update" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Nome</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Descrição</Label>
        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Tipo</Label>
        <Input value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="enriquecimento | cascata | importacao | autonomo" />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs">Regras (JSON)</Label>
        <Textarea value={regras} onChange={(e) => setRegras(e.target.value)} className="font-mono text-xs" />
      </div>
      <div className="sm:col-span-2">
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar agente
        </Button>
      </div>
    </CardContent></Card>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "concluido") return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />;
  if (status === "parcial") return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />;
  if (status === "erro") return <XCircle className="h-4 w-4 shrink-0 text-destructive" />;
  if (status === "cancelado") return <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />;
  return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />;
}

function InfoLinha({ rotulo, valor }: { rotulo: string; valor?: string }) {
  if (!valor) return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <span className="shrink-0 font-medium text-muted-foreground sm:w-24">{rotulo}:</span>
      <span className="min-w-0 flex-1">{valor}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium capitalize">{value}</p>
    </div>
  );
}
