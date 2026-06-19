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
  Mail,
  MapPin,
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

interface Grupo {
  titulo: string;
  descricao: string;
  itens: ConfigItem[];
}

// Configurações agrupadas por área. Novos itens entram no grupo correspondente
// (padrão a manter): Acessos, Microsoft 365, Dados/Importação, Limpeza,
// Parâmetros do sistema, Automação.
const GRUPOS: Grupo[] = [
  {
    titulo: "Acessos e segurança",
    descricao: "Quem entra, o que cada um vê e o histórico de acessos.",
    itens: [
      {
        href: "/configuracoes/usuarios",
        icon: ShieldCheck,
        titulo: "Usuários e acessos",
        descricao:
          "Aprove novos acessos, defina o perfil (admin/gestor/vendedor) e bloqueie. Apenas administradores.",
      },
      {
        href: "/configuracoes/permissoes",
        icon: ShieldCheck,
        titulo: "Permissões por perfil",
        descricao:
          "Quais seções cada perfil acessa (menu + bloqueio de páginas). admin/gestor têm acesso total.",
      },
      {
        href: "/configuracoes/auditoria",
        icon: ShieldCheck,
        titulo: "Auditoria e acessos",
        descricao:
          "Dispositivos (aprovar/bloquear) e histórico de acessos/ações com IP, localização e mapa. LGPD.",
      },
    ],
  },
  {
    titulo: "Contatos e Microsoft 365",
    descricao: "Contatos, e-mails e a integração com o Outlook/M365.",
    itens: [
      {
        href: "/configuracoes/contatos-m365",
        icon: Users,
        titulo: "Contatos Microsoft 365",
        descricao:
          "Sincronize e concilie seus contatos do Outlook com o sistema. Requer login Microsoft corporativo.",
      },
      {
        href: "/configuracoes/historico-contatos-m365",
        icon: Users,
        titulo: "Histórico de contatos M365",
        descricao:
          "Quem vinculou cada contato, de qual conta e quando, com os dados capturados. Histórico por usuário.",
      },
      {
        href: "/configuracoes/emails",
        icon: Mail,
        titulo: "E-mails indexados (M365)",
        descricao:
          "Busca e extração (correspondentes) dos e-mails abertos. Cada um vê os seus; admin consolida. Só metadados.",
      },
      {
        href: "/configuracoes/importar-contatos",
        icon: Users,
        titulo: "Importar contatos (CSV)",
        descricao:
          "Importa contatos de Google/celular (CSV) como pessoas, com telefones e e-mails. Ignora quem já existe.",
      },
    ],
  },
  {
    titulo: "Fontes e importação de dados",
    descricao: "Origens externas que alimentam o sistema (NFs, clientes, BI).",
    itens: [
      {
        href: "/configuracoes/fontes",
        icon: Database,
        titulo: "Fontes de dados",
        descricao:
          "Bancos/planilhas externos (NFs e clientes Martins Lanna/MBV/TCL). Habilite e sincronize as importações.",
      },
      {
        href: "/configuracoes/integracao",
        icon: Database,
        titulo: "Integração com o sistema",
        descricao:
          "Sincroniza clientes, produtos e propostas do sistema comercial (diário 01:00 + sob demanda).",
      },
      {
        href: "/configuracoes/geocode",
        icon: MapPin,
        titulo: "Geocodificar endereços",
        descricao:
          "Localiza no mapa, em lote, os cadastros com endereço mas sem coordenada. Não altera coordenadas salvas manualmente.",
      },
    ],
  },
  {
    titulo: "Limpeza de dados",
    descricao: "Encontrar e mesclar cadastros repetidos.",
    itens: [
      {
        href: "/configuracoes/clientes-duplicados",
        icon: Merge,
        titulo: "Clientes duplicados",
        descricao:
          "Encontra clientes repetidos pelo mesmo CNPJ e mescla, movendo NFs, visitas e contatos.",
      },
      {
        href: "/configuracoes/pessoas-duplicadas",
        icon: Merge,
        titulo: "Pessoas duplicadas",
        descricao:
          "Encontra pessoas repetidas (mesmo CPF/nome) e mescla, movendo vínculos, identidades e sociedades.",
      },
    ],
  },
  {
    titulo: "Parâmetros do sistema",
    descricao: "Tabelas e regras que alimentam projeções e categorização.",
    itens: [
      {
        href: "/configuracoes/sazonalidade",
        icon: SlidersHorizontal,
        titulo: "Sazonalidade mensal",
        descricao:
          "Distribuição do volume anual por mês, por ano e segmento. Usada nas projeções.",
      },
      {
        href: "/configuracoes/dias-uteis",
        icon: CalendarDays,
        titulo: "Peso de dias / mês",
        descricao:
          "Peso de dia útil, sábado, domingo e feriados. Define os dias úteis ponderados de cada mês.",
      },
      {
        href: "/produtos",
        icon: Package,
        titulo: "Catálogo de produtos",
        descricao:
          "Produtos identificados nas NFs. Mescle nomes similares e padronize a classificação.",
      },
      {
        href: "/configuracoes/carteiras",
        icon: Briefcase,
        titulo: "Carteiras de vendas",
        descricao:
          "Carteiras por segmento + região/porte → vendedor responsável. Prepara metas/comissionamento.",
      },
      {
        href: "/configuracoes/brindes",
        icon: Gift,
        titulo: "Brindes",
        descricao:
          "Catálogo e estoque de brindes. A baixa acontece na entrega durante a visita.",
      },
    ],
  },
  {
    titulo: "Automação e desenvolvimento",
    descricao: "Agentes automáticos e evolução do sistema.",
    itens: [
      {
        href: "/configuracoes/agentes",
        icon: Bot,
        titulo: "Agentes e monitoramento",
        descricao:
          "Agentes automáticos (enriquecimento, cascata, importação). Ative/desative e acompanhe o log.",
      },
      {
        href: "/configuracoes/desenvolvimento",
        icon: Code2,
        titulo: "Desenvolvimento",
        descricao:
          "Peça melhorias/correções: a IA gera análise + plano. Aprove e o item entra no backlog. Também pelo chat 🤖.",
      },
    ],
  },
];

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Organizadas por área. Novos itens entram no grupo correspondente.
        </p>
      </div>

      {GRUPOS.map((grupo) => (
        <section key={grupo.titulo} className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo.titulo}
            </h2>
            <p className="text-xs text-muted-foreground">{grupo.descricao}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {grupo.itens.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-3 p-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{item.titulo}</p>
                        <p className="text-xs text-muted-foreground">{item.descricao}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
