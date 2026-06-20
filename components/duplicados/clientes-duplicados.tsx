"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Merge, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getClientesDuplicados,
  mesclarClientes,
  type GrupoDuplicado,
} from "@/lib/supabase/clientes";
import { mascararCnpj } from "@/lib/utils/cnpj";

function GrupoCard({ grupo, onMesclado }: { grupo: GrupoDuplicado; onMesclado: () => void }) {
  const [masterId, setMasterId] = React.useState(grupo.membros[0]?.id ?? "");
  const [mesclando, setMesclando] = React.useState(false);

  async function mesclar() {
    const dups = grupo.membros.map((m) => m.id).filter((id) => id !== masterId);
    if (!masterId || dups.length === 0) return;
    if (
      !window.confirm(
        `Mesclar ${dups.length} duplicado(s) no cliente selecionado? ` +
          `Todas as NFs, visitas, brindes e contatos serão movidos para o mestre e os duplicados serão removidos. Esta ação não pode ser desfeita.`
      )
    )
      return;
    setMesclando(true);
    try {
      await mesclarClientes(masterId, dups);
      toast.success("Clientes mesclados.");
      onMesclado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao mesclar.");
    } finally {
      setMesclando(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="tabular-nums">{mascararCnpj(grupo.cnpj_digitos)}</span>
          <Badge variant="secondary">{grupo.membros.length} registros</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Escolha o registro <strong>mestre</strong> (o que será mantido). Os demais
          serão mesclados nele.
        </p>
        <div className="divide-y rounded-md border">
          {grupo.membros.map((m) => (
            <label
              key={m.id}
              className="flex cursor-pointer items-center gap-2 p-2 text-sm hover:bg-muted/50"
            >
              <input
                type="radio"
                name={`master-${grupo.cnpj_digitos}`}
                checked={masterId === m.id}
                onChange={() => setMasterId(m.id)}
                className="shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {m.fantasia?.trim() || m.razao_social}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.fantasia?.trim() ? `${m.razao_social} · ` : ""}
                  {[m.municipio, m.uf].filter(Boolean).join("/")}
                </span>
              </span>
              <Link
                href={`/clientes/${m.id}`}
                target="_blank"
                className="shrink-0 text-xs text-primary hover:underline"
              >
                abrir
              </Link>
            </label>
          ))}
        </div>
        <Button onClick={mesclar} disabled={mesclando} size="sm" className="w-full">
          {mesclando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Merge className="h-4 w-4" />
          )}
          Mesclar no mestre selecionado
        </Button>
      </CardContent>
    </Card>
  );
}

export function ClientesDuplicados({ embed = false }: { embed?: boolean }) {
  const qc = useQueryClient();
  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["clientes-duplicados"],
    queryFn: getClientesDuplicados,
  });

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["clientes-duplicados"] });
    qc.invalidateQueries({ queryKey: ["clientes-list-visita"] });
  }

  return (
    <div className="space-y-4">
      {!embed && (
        <>
          <Button asChild variant="ghost" size="sm">
            <Link href="/configuracoes">
              <ArrowLeft className="h-4 w-4" /> Configurações
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Merge className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">Clientes duplicados</h1>
              <p className="text-sm text-muted-foreground">
                Registros com o mesmo CNPJ. Mescle-os num único cadastro.
              </p>
            </div>
          </div>
        </>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : grupos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <ShieldCheck className="h-8 w-8 text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              Nenhum cliente duplicado por CNPJ. Tudo limpo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {grupos.length} grupo(s) com duplicidade.
          </p>
          {grupos.map((g) => (
            <GrupoCard key={g.cnpj_digitos} grupo={g} onMesclado={recarregar} />
          ))}
        </>
      )}
    </div>
  );
}
