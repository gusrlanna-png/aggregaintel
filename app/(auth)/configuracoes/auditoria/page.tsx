"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MonitorSmartphone, ShieldCheck, History } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAcessosRecentes,
  getDispositivos,
  setStatusDispositivo,
  type Dispositivo,
} from "@/lib/supabase/auditoria";

const STATUS_BADGE: Record<Dispositivo["status"], { label: string; cls: string }> = {
  aprovado: { label: "Aprovado", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  pendente: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  bloqueado: { label: "Bloqueado", cls: "bg-destructive/15 text-destructive" },
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function AuditoriaPage() {
  const qc = useQueryClient();
  const { data: dispositivos = [] } = useQuery({
    queryKey: ["auditoria-dispositivos"],
    queryFn: getDispositivos,
  });
  const { data: acessos = [], isLoading } = useQuery({
    queryKey: ["auditoria-acessos"],
    queryFn: () => getAcessosRecentes(200),
  });

  async function alterar(id: string, status: Dispositivo["status"]) {
    try {
      await setStatusDispositivo(id, status);
      qc.invalidateQueries({ queryKey: ["auditoria-dispositivos"] });
      toast.success("Dispositivo atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar.");
    }
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Auditoria e acessos</h1>
          <p className="text-sm text-muted-foreground">
            Dispositivos registrados e histórico de acessos/ações (apenas administradores).
          </p>
        </div>
      </div>

      {/* Dispositivos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MonitorSmartphone className="h-4 w-4" /> Dispositivos ({dispositivos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dispositivos.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum dispositivo registrado ainda.</p>
          ) : (
            <div className="divide-y">
              {dispositivos.map((d) => {
                const b = STATUS_BADGE[d.status];
                return (
                  <div key={d.id} className="flex items-center gap-2 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{d.label ?? `Dispositivo ${d.device_id.slice(0, 8)}`}</span>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${b.cls}`}>{b.label}</span>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {(d.user_agent ?? "—").slice(0, 60)} · {d.ip ?? "—"} · {d.n_acessos} acessos · {fmt(d.ultimo_acesso)}
                      </span>
                    </span>
                    {d.status !== "aprovado" && (
                      <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => alterar(d.id, "aprovado")}>
                        Aprovar
                      </Button>
                    )}
                    {d.status !== "bloqueado" && (
                      <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs text-destructive" onClick={() => alterar(d.id, "bloqueado")}>
                        Bloquear
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acessos recentes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Acessos recentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : acessos.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sem registros (ou sem permissão de administrador).</p>
          ) : (
            <div className="max-h-[28rem] divide-y overflow-y-auto">
              {acessos.map((a) => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      <span className="font-medium">{a.email ?? "—"}</span>
                      {a.tipo === "acao" ? (
                        <Badge variant="warning" className="ml-1.5 text-[10px]">{a.acao}</Badge>
                      ) : null}{" "}
                      <span className="text-muted-foreground">{a.recurso}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[a.geo_cidade, a.geo_uf].filter(Boolean).join("/") || a.ip || "—"} · {fmt(a.criado_em)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
