"use client";

import Link from "next/link";
import {
  Bot,
  Briefcase,
  CalendarDays,
  ChevronRight,
  Code2,
  Database,
  Gift,
  Merge,
  Package,
  ShieldCheck,
  SlidersHorizontal,
  Users,
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
    href: "/configuracoes/agentes",
    icon: Bot,
    titulo: "Agentes e monitoramento",
    descricao:
      "Agentes automáticos (enriquecimento, cascata, importação). Ative/desative, defina regras e acompanhe o log de todas as ações executadas.",
  },
  {
    href: "/configuracoes/desenvolvimento",
    icon: Code2,
    titulo: "Desenvolvimento",
    descricao:
      "Peça melhorias/correções: a IA gera análise crítica + plano. Aprove e o item entra no backlog de desenvolvimento. Também pelo chat 🤖.",
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
  {
    href: "/configuracoes/contatos-m365",
    icon: Users,
    titulo: "Contatos Microsoft 365",
    descricao:
      "Sincronize seus contatos do Outlook para o sistema. Requer login com conta Microsoft corporativa.",
  },
  {
    href: "/configuracoes/clientes-duplicados",
    icon: Merge,
    titulo: "Clientes duplicados",
    descricao:
      "Encontra cadastros de cliente repetidos pelo mesmo CNPJ e mescla num único registro, movendo NFs, visitas e contatos.",
  },
  {
    href: "/configuracoes/pessoas-duplicadas",
    icon: Merge,
    titulo: "Pessoas duplicadas",
    descricao:
      "Encontra pessoas repetidas (mesmo CPF ou nome) e mescla num único cadastro, movendo vínculos, identidades e sociedades.",
  },
  {
    href: "/configuracoes/importar-contatos",
    icon: Users,
    titulo: "Importar contatos (CSV)",
    descricao:
      "Importa contatos de Google Contacts / celular (CSV) como pessoas, com telefones e e-mails. Ignora quem já existe (De→Para por nome).",
  },
  {
    href: "/configuracoes/permissoes",
    icon: ShieldCheck,
    titulo: "Permissões por perfil",
    descricao:
      "Define quais seções cada perfil acessa (menu + bloqueio de páginas). admin/gestor têm acesso total. Apenas administradores.",
  },
  {
    href: "/configuracoes/fontes",
    icon: Database,
    titulo: "Fontes de dados",
    descricao:
      "Bancos/planilhas externos (NFs Martins Lanna/MBV/TCL e outros) que alimentam o sistema. Habilite e sincronize as importações.",
  },
  {
    href: "/configuracoes/auditoria",
    icon: ShieldCheck,
    titulo: "Auditoria e acessos",
    descricao:
      "Dispositivos registrados (aprovar/bloquear) e histórico de acessos/ações com IP e localização. Base de segurança e LGPD. Apenas administradores.",
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
