"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Database, Loader2, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  getFontes,
  setFonteAtiva,
  sincronizarFonte,
  sincronizarClientesFonte,
  type Fonte,
} from "@/lib/supabase/fontes";

export default function FontesPage() {
  const qc = useQueryClient();
  const { data: fontes = [], isLoading } = useQuery({ queryKey: ["fontes"], queryFn: getFontes });
  const [sincronizando, setSincronizando] = React.useState<string | null>(null);
  const [sincClientes, setSincClientes] = React.useState<string | null>(null);

  async function sincronizar(f: Fonte) {
    setSincronizando(f.id);
    try {
      const r = await sincronizarFonte(f.id);
      qc.invalidateQueries({ queryKey: ["fontes"] });
      toast.success(`Sincronizado: ${r.criadas} nova(s), ${r.atualizadas} atualizada(s)${r.erros ? `, ${r.erros} erro(s)` : ""}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na sincronização.");
    } finally {
      setSincronizando(null);
    }
  }

  async function sincronizarClientes(f: Fonte) {
    setSincClientes(f.id);
    try {
      const r = await sincronizarClientesFonte(f.id);
      qc.invalidateQueries({ queryKey: ["fontes"] });
      toast.success(
        `Clientes: ${r.clientes_criados ?? 0} novo(s), ${r.clientes_atualizados ?? 0} atualizado(s). ` +
          `Obras/usinas: ${r.enderecos_criados ?? 0} nova(s), ${r.enderecos_atualizados ?? 0} atualizada(s).`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro na sincronização de clientes.");
    } finally {
      setSincClientes(null);
    }
  }

  async function alternar(f: Fonte, ativo: boolean) {
    try {
      await setFonteAtiva(f.id, ativo);
      qc.invalidateQueries({ queryKey: ["fontes"] });
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
        <Database className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Fontes de dados</h1>
          <p className="text-sm text-muted-foreground">
            Bancos/planilhas externos que alimentam o sistema (NFs, etc.). Habilite e sincronize.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : fontes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Nenhuma fonte cadastrada.</CardContent></Card>
      ) : (
        fontes.map((f) => (
          <Card key={f.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2">
                  {f.nome}
                  {f.validado && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </span>
                <label className="flex items-center gap-1.5 text-xs font-normal">
                  Ativa <Switch checked={f.ativo} onCheckedChange={(v) => alternar(f, v)} />
                </label>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {f.tipo} · {f.url} · tabela <code>{f.tabela}</code>
              </p>
              {f.ultimo_resultado && (
                <p className="text-xs">
                  NFs: <strong>{f.ultimo_resultado.criadas ?? 0}</strong> novas ·{" "}
                  <strong>{f.ultimo_resultado.atualizadas ?? 0}</strong> atualizadas ·{" "}
                  {f.ultimo_resultado.erros ?? 0} erros
                  {f.ultima_sync ? ` · ${new Date(f.ultima_sync).toLocaleString("pt-BR")}` : ""}
                </p>
              )}
              {f.ultimo_resultado_clientes && (
                <p className="text-xs">
                  Clientes: <strong>{f.ultimo_resultado_clientes.clientes_criados ?? 0}</strong> novos ·{" "}
                  <strong>{f.ultimo_resultado_clientes.clientes_atualizados ?? 0}</strong> atualizados ·{" "}
                  Obras: <strong>{f.ultimo_resultado_clientes.enderecos_criados ?? 0}</strong> novas ·{" "}
                  <strong>{f.ultimo_resultado_clientes.enderecos_atualizados ?? 0}</strong> atualizadas
                  {f.ultima_sync_clientes ? ` · ${new Date(f.ultima_sync_clientes).toLocaleString("pt-BR")}` : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => sincronizar(f)} disabled={sincronizando === f.id || !f.ativo}>
                  {sincronizando === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sincronizar NFs
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sincronizarClientes(f)}
                  disabled={sincClientes === f.id || !f.ativo}
                >
                  {sincClientes === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Sincronizar clientes + obras
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
