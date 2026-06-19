"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Tags } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  getEmpresaPapeis,
  setEmpresaPapeis,
  PAPEIS_EMPRESA,
  type EmpresaPapeis,
} from "@/lib/supabase/empresas";

/**
 * Editor de papéis do cadastro único de empresa. Ligar/desligar um papel
 * habilita (ou remove) os recursos correspondentes e faz a empresa aparecer
 * na lista do papel (ex.: marcar Cliente num produtor o inclui no planejamento).
 */
export function PapeisEmpresa({
  empresaId,
  contexto,
}: {
  empresaId: string;
  /** Página atual, para não oferecer link para a própria visão. */
  contexto?: "cliente" | "produtor";
}) {
  const qc = useQueryClient();
  const { data: papeis } = useQuery({
    queryKey: ["empresa-papeis", empresaId],
    queryFn: () => getEmpresaPapeis(empresaId),
  });
  const [salvando, setSalvando] = React.useState<string | null>(null);

  async function alternar(chave: keyof EmpresaPapeis, valor: boolean) {
    setSalvando(chave);
    try {
      await setEmpresaPapeis(empresaId, { [chave]: valor });
      await qc.invalidateQueries({ queryKey: ["empresa-papeis", empresaId] });
      // Listas/contagens que dependem do papel.
      qc.invalidateQueries({ queryKey: ["clientes-list-visita"] });
      qc.invalidateQueries({ queryKey: ["emissores-all"] });
      toast.success("Papéis atualizados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar papéis.");
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="h-4 w-4 text-muted-foreground" /> Papéis do cadastro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Um mesmo CNPJ pode ter vários papéis. Cada papel habilita seus recursos.
        </p>
        <div className="divide-y rounded-md border">
          {PAPEIS_EMPRESA.map(({ chave, label, recursos }) => (
            <label key={chave} className="flex items-center gap-3 p-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{recursos}</span>
              </span>
              {salvando === chave ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Switch
                  checked={Boolean(papeis?.[chave])}
                  onCheckedChange={(v) => alternar(chave, v)}
                />
              )}
            </label>
          ))}
        </div>

        {/* Atalhos para a visão de cada papel ativo (mesmo cadastro/id). */}
        {(() => {
          const links: { href: string; label: string }[] = [];
          if (papeis?.eh_produtor && contexto !== "produtor")
            links.push({ href: `/concorrentes/${empresaId}`, label: "Abrir visão de Produtor (CFEM, produção)" });
          if (papeis?.eh_cliente && contexto !== "cliente")
            links.push({ href: `/clientes/${empresaId}`, label: "Abrir visão de Cliente (planejamento, vendas)" });
          if (links.length === 0) return null;
          return (
            <div className="flex flex-col gap-1.5">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <ArrowUpRight className="h-4 w-4" /> {l.label}
                </Link>
              ))}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}
