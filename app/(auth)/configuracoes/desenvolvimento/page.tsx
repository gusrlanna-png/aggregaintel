"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Code2,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  getDevTasks,
  setDevTaskStatus,
  deleteDevTask,
  type DevTask,
} from "@/lib/supabase/dev-tasks";

const STATUS: Record<DevTask["status"], { label: string; variant: "secondary" | "success" | "warning" | "destructive" }> = {
  aguardando_aprovacao: { label: "aguardando aprovação", variant: "warning" },
  aprovado: { label: "aprovado (no backlog)", variant: "success" },
  recusado: { label: "recusado", variant: "destructive" },
  concluido: { label: "concluído", variant: "secondary" },
};

/** Render simples de markdown (títulos ## e texto). */
function Plano({ texto }: { texto: string }) {
  return (
    <div className="space-y-1 text-sm">
      {texto.split("\n").map((linha, i) => {
        const h = linha.match(/^##\s+(.*)/);
        if (h) return <p key={i} className="mt-2 font-semibold">{h[1]}</p>;
        if (!linha.trim()) return <div key={i} className="h-1" />;
        return <p key={i} className="text-muted-foreground">{linha}</p>;
      })}
    </div>
  );
}

export default function DesenvolvimentoPage() {
  const qc = useQueryClient();
  const [aberto, setAberto] = React.useState<string | null>(null);
  const [novoPedido, setNovoPedido] = React.useState("");
  const [gerando, setGerando] = React.useState(false);
  const [refino, setRefino] = React.useState("");
  const [refinando, setRefinando] = React.useState(false);

  async function refinarPlano(id: string) {
    const fb = refino.trim();
    if (!fb) return;
    setRefinando(true);
    try {
      const res = await fetch("/api/dev/refinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: id, feedback: fb }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Falha ao refinar.");
      toast.success("Plano atualizado com seu ajuste. Revise e aprove.");
      setRefino("");
      qc.invalidateQueries({ queryKey: ["dev-tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao refinar.");
    } finally {
      setRefinando(false);
    }
  }

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["dev-tasks"],
    queryFn: getDevTasks,
    refetchInterval: 15000,
  });

  async function gerarPlano() {
    const p = novoPedido.trim();
    if (!p) return;
    setGerando(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensagem: p,
          contexto: { pathname: "/configuracoes/desenvolvimento", forcarDev: true },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.acao?.tipo === "dev_task") {
        toast.success("Plano gerado. Revise abaixo.");
        setNovoPedido("");
      } else {
        toast.message(json.resposta ?? "Pedido enviado.");
      }
      qc.invalidateQueries({ queryKey: ["dev-tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar plano.");
    } finally {
      setGerando(false);
    }
  }

  async function mudar(id: string, status: DevTask["status"]) {
    try {
      await setDevTaskStatus(id, status);
      qc.invalidateQueries({ queryKey: ["dev-tasks"] });
      toast.success(status === "aprovado" ? "Aprovado — entrou no backlog." : "Atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  async function remover(id: string) {
    try {
      await deleteDevTask(id);
      qc.invalidateQueries({ queryKey: ["dev-tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro.");
    }
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes"><ArrowLeft className="h-4 w-4" /> Configurações</Link>
      </Button>
      <div className="flex items-center gap-2">
        <Code2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Desenvolvimento</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Descreva uma melhoria/correção: a IA gera uma <strong>análise crítica + plano</strong>.
        Ao <strong>aprovar</strong>, vira item de backlog implementado pelo fluxo controlado de
        desenvolvimento (não há auto-deploy em produção). Você também pode pedir pelo chat 🤖.
      </p>

      <Card>
        <CardContent className="space-y-2 p-3">
          <Textarea
            value={novoPedido}
            onChange={(e) => setNovoPedido(e.target.value)}
            placeholder="Ex.: criar tela de anexos nas visitas (foto/PDF/link)…"
            className="min-h-[72px] text-sm"
          />
          <Button onClick={gerarPlano} disabled={gerando || !novoPedido.trim()}>
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
            Gerar análise + plano
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tasks.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum pedido ainda.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.titulo ?? t.pedido.slice(0, 60)}</p>
                      <Badge variant={STATUS[t.status].variant} className="text-[10px]">
                        {STATUS[t.status].label}
                      </Badge>
                      {t.provedor && (
                        <span className="text-[10px] text-muted-foreground">via {t.provedor}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.pedido}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    onClick={() => remover(t.id)} aria-label="Excluir">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <button
                  onClick={() => {
                    setAberto(aberto === t.id ? null : t.id);
                    setRefino("");
                  }}
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-primary"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto === t.id ? "rotate-180" : ""}`} />
                  {aberto === t.id ? "Ocultar" : "Ver"} análise + plano
                </button>
                {aberto === t.id && t.plano && (
                  <div className="mt-2 space-y-2 rounded-md border bg-muted/30 p-3">
                    <Plano texto={t.plano} />
                    <div className="space-y-1.5 border-t pt-2">
                      <p className="text-xs font-medium">Opinar / pedir ajuste neste plano</p>
                      <Textarea
                        value={refino}
                        onChange={(e) => setRefino(e.target.value)}
                        placeholder="Ex.: foque só na correção do link; não mexa no layout; priorize X…"
                        className="min-h-[60px] text-sm"
                      />
                      <Button size="sm" onClick={() => refinarPlano(t.id)} disabled={refinando || !refino.trim()}>
                        {refinando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Code2 className="h-4 w-4" />}
                        Atualizar plano com meu ajuste
                      </Button>
                    </div>
                  </div>
                )}

                {t.status === "aguardando_aprovacao" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" onClick={() => mudar(t.id, "aprovado")}>
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => mudar(t.id, "recusado")}>
                      <X className="h-4 w-4" /> Recusar
                    </Button>
                  </div>
                )}
                {t.status === "aprovado" && (
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => mudar(t.id, "concluido")}>
                      <Check className="h-4 w-4" /> Marcar concluído
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
