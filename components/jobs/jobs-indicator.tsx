"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Loader2, XCircle } from "lucide-react";

import { getJobsRecentes, type Job } from "@/lib/jobs/client";
import { cn } from "@/lib/utils";

const ATIVOS = new Set(["pendente", "processando"]);

export function JobsIndicator() {
  const [aberto, setAberto] = React.useState(false);

  const { data: jobs = [] } = useQuery({
    queryKey: ["jobs-recentes"],
    queryFn: getJobsRecentes,
    // enquanto houver tarefa ativa, atualiza rápido; senão, devagar
    refetchInterval: (q) => {
      const lista = (q.state.data as Job[] | undefined) ?? [];
      return lista.some((j) => ATIVOS.has(j.status)) ? 2500 : 15000;
    },
  });

  const ativos = jobs.filter((j) => ATIVOS.has(j.status));
  const recentes = jobs.slice(0, 8);
  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 z-40">
      {aberto && (
        <div className="mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Tarefas em segundo plano</p>
            <button onClick={() => setAberto(false)} aria-label="Fechar">
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <ul className="space-y-2">
            {recentes.map((j) => (
              <li key={j.id} className="rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <StatusIcon status={j.status} />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {j.titulo ?? j.tipo}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {j.status === "concluido"
                      ? "ok"
                      : j.status === "erro"
                        ? "erro"
                        : `${j.progresso}%`}
                  </span>
                </div>
                {ATIVOS.has(j.status) && (
                  <>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${j.progresso}%` }}
                      />
                    </div>
                    {j.etapa && (
                      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {j.etapa}
                      </p>
                    )}
                  </>
                )}
                {j.status === "erro" && j.erro && (
                  <p className="mt-0.5 truncate text-[10px] text-destructive">{j.erro}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={() => setAberto((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-xs font-medium shadow-lg backdrop-blur transition-colors hover:bg-muted",
          ativos.length > 0 && "border-primary text-primary"
        )}
      >
        {ativos.length > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        )}
        {ativos.length > 0
          ? `${ativos.length} tarefa${ativos.length > 1 ? "s" : ""}…`
          : "Tarefas"}
      </button>
    </div>
  );
}

function StatusIcon({ status }: { status: Job["status"] }) {
  if (status === "concluido")
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />;
  if (status === "erro")
    return <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />;
  return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />;
}
