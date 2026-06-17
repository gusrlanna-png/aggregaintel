"use client";

import Link from "next/link";
import {
  Briefcase,
  CalendarDays,
  ChevronRight,
  Database,
  Gift,
  Package,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface ConfigItem {
  href: string;
  icon: LucideIcon;
  titulo: string;
  descricao: string;
}

const ITENS: ConfigItem[] = [
  {
    href: "/configuracoes/integracao",
    icon: Database,
    titulo: "Integração com o sistema",
    descricao:
      "Sincroniza clientes, produtos e propostas do sistema comercial (diário às 01:00 + sob demanda). Base da sazonalidade pelas vendas.",
  },
  {
    href: "/configuracoes/sazonalidade",
    icon: SlidersHorizontal,
    titulo: "Sazonalidade mensal",
    descricao:
      "Distribuição do volume anual por mês. Varia por ano e por segmento de cliente. Usada nas projeções.",
  },
  {
    href: "/configuracoes/dias-uteis",
    icon: CalendarDays,
    titulo: "Peso de dias / mês",
    descricao:
      "Peso de dia útil, sábado e domingo, feriados nacionais e extras. Define os dias úteis ponderados de cada mês.",
  },
  {
    href: "/produtos",
    icon: Package,
    titulo: "Catálogo de produtos",
    descricao:
      "Produtos identificados nas NFs. Mescle nomes similares e padronize a classificação.",
  },
  {
    href: "/configuracoes/usuarios",
    icon: ShieldCheck,
    titulo: "Usuários e permissões",
    descricao:
      "Perfis de acesso (admin, gestor, vendedor). Define o que cada pessoa enxerga. Apenas administradores.",
  },
  {
    href: "/configuracoes/carteiras",
    icon: Briefcase,
    titulo: "Carteiras de vendas",
    descricao:
      "Carteiras por segmento + região/porte → vendedor responsável. Categoriza os clientes e prepara metas/comissionamento.",
  },
  {
    href: "/configuracoes/brindes",
    icon: Gift,
    titulo: "Brindes",
    descricao:
      "Catálogo e estoque de brindes. A baixa acontece na entrega durante a visita (categoria Entrega de brindes).",
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Tabelas e parâmetros do sistema. Novas configurações aparecem aqui.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ITENS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{item.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.descricao}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
