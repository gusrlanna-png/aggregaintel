"use client";

import { Wallet, ShieldCheck, FileText, TrendingUp } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export default function FinanceiroPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Módulo de análise de crédito e cadastro financeiro. Em preparação.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="text-sm text-muted-foreground">
            Este módulo está reservado e isolado por perfil (acesso só para o
            perfil <strong>Financeiro</strong> e administradores). Em breve:
          </p>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              Análise de crédito do cliente (situação cadastral, sócios, histórico de NFs).
            </li>
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              Cadastro financeiro (limites, condições, documentos).
            </li>
            <li className="flex items-start gap-2">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              Indicadores de risco e exposição por cliente/grupo econômico.
            </li>
          </ul>
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Estrutura preparada (rota, perfil e permissões). A implementação
            funcional entra numa próxima fase, sem mexer nos módulos
            Inteligência de Mercado e Comercial.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
