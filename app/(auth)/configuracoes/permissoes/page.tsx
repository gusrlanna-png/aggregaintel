"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getPerfilRotas, setPerfilRota } from "@/lib/supabase/perfil";

// Seções (prefixos) gerenciáveis e seus rótulos.
const SECOES: { prefixo: string; label: string }[] = [
  { prefixo: "/dashboard", label: "Início / Dashboard" },
  { prefixo: "/visitas", label: "Visitas" },
  { prefixo: "/nf", label: "Notas Fiscais" },
  { prefixo: "/concorrentes", label: "Mercado / Produtores" },
  { prefixo: "/clientes", label: "Clientes" },
  { prefixo: "/pessoas", label: "Contatos" },
  { prefixo: "/inteligencia", label: "Inteligência" },
  { prefixo: "/projecao", label: "Projeção" },
  { prefixo: "/vendas", label: "Planejamento / Vendas" },
  { prefixo: "/mapa", label: "Mapa" },
  { prefixo: "/mercados", label: "Mercados" },
  { prefixo: "/cfem", label: "CFEM / ANM" },
  { prefixo: "/grupos", label: "Grupos econômicos" },
  { prefixo: "/produtos", label: "Produtos" },
  { prefixo: "/ranking", label: "Ranking" },
  { prefixo: "/financeiro", label: "Financeiro" },
  { prefixo: "/configuracoes", label: "Configurações" },
];

// Perfis restringíveis (admin e gestor têm acesso total por definição).
const PERFIS_EDITAVEIS = ["vendedor", "analista_inteligencia", "financeiro"];

export default function PermissoesPage() {
  const qc = useQueryClient();
  const { data: rotas = [] } = useQuery({
    queryKey: ["perfil-rotas"],
    queryFn: getPerfilRotas,
  });
  const [salvando, setSalvando] = React.useState<string | null>(null);

  const temAcesso = (perfil: string, prefixo: string) =>
    rotas.some((r) => r.perfil === perfil && r.prefixo === prefixo);

  async function alternar(perfil: string, prefixo: string, valor: boolean) {
    const key = `${perfil}:${prefixo}`;
    setSalvando(key);
    try {
      await setPerfilRota(perfil, prefixo, valor);
      await qc.invalidateQueries({ queryKey: ["perfil-rotas"] });
      qc.invalidateQueries({ queryKey: ["minhas-rotas"] });
      toast.success("Permissão atualizada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSalvando(null);
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
        <KeyRound className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Permissões por perfil</h1>
          <p className="text-sm text-muted-foreground">
            Defina quais seções cada perfil pode acessar. Aplica-se ao menu e ao
            bloqueio de páginas. Apenas administradores.
          </p>
        </div>
      </div>

      <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="flex items-center gap-2 p-3 text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span><strong>admin</strong> e <strong>gestor</strong> têm acesso total (não configurável). Abaixo você ajusta os demais perfis.</span>
        </CardContent>
      </Card>

      {PERFIS_EDITAVEIS.map((perfil) => (
        <Card key={perfil}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base capitalize">{perfil}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {SECOES.map((s) => {
                const on = temAcesso(perfil, s.prefixo);
                const key = `${perfil}:${s.prefixo}`;
                return (
                  <label key={s.prefixo} className="flex items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.prefixo}</span>
                    </span>
                    <Switch
                      checked={on}
                      disabled={salvando === key}
                      onCheckedChange={(v) => alternar(perfil, s.prefixo, v)}
                    />
                  </label>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
