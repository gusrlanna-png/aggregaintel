"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  desmarcarConcorrente,
  getSugestaoConcorrentes,
  marcarConcorrente,
  type SugestaoConcorrente,
} from "@/lib/supabase/concorrentes-prod";
import { cn } from "@/lib/utils";

const RAIO = 60;

export function ConcorrentesProximos({ emissorId }: { emissorId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["sugestao-concorrentes", emissorId],
    queryFn: () => getSugestaoConcorrentes(emissorId, RAIO),
  });

  const invalida = () =>
    qc.invalidateQueries({ queryKey: ["sugestao-concorrentes", emissorId] });

  const toggle = useMutation({
    mutationFn: async (s: SugestaoConcorrente) => {
      if (s.ja_marcado) await desmarcarConcorrente(emissorId, s.id);
      else await marcarConcorrente(emissorId, s.id, s.distancia_km);
    },
    onSuccess: invalida,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });

  const autoPreencher = useMutation({
    mutationFn: async (lista: SugestaoConcorrente[]) => {
      for (const s of lista.filter((x) => !x.ja_marcado)) {
        await marcarConcorrente(emissorId, s.id, s.distancia_km, "auto");
      }
    },
    onSuccess: () => {
      toast.success("Concorrentes próximos vinculados.");
      invalida();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro."),
  });

  const lista = data ?? [];
  const naoMarcados = lista.filter((s) => !s.ja_marcado).length;

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>Concorrentes próximos (≤ {RAIO} km)</span>
          {naoMarcados > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => autoPreencher.mutate(lista)}
              disabled={autoPreencher.isPending}
            >
              {autoPreencher.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Vincular todos ({naoMarcados})
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : lista.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhum produtor georreferenciado num raio de {RAIO} km (a
            geocodificação por município pode ainda estar em andamento).
          </p>
        ) : (
          <ul className="divide-y">
            {lista.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/concorrentes/${s.id}`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {s.razao_social}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.municipio ?? "—"} · {s.distancia_km} km
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={s.ja_marcado ? "secondary" : "outline"}
                  onClick={() => toggle.mutate(s)}
                  disabled={toggle.isPending}
                  className={cn("shrink-0", s.ja_marcado && "text-primary")}
                >
                  {s.ja_marcado ? (
                    <>
                      <Check className="h-4 w-4" /> Concorrente
                    </>
                  ) : (
                    "Marcar"
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
