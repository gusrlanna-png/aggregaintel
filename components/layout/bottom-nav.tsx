"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  Building2,
  FileText,
  LayoutDashboard,
  MapPin,
  Settings,
  User,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getMeuPerfil } from "@/lib/supabase/perfil";
import { podeAcessar } from "@/lib/auth/rotas";

const NAV_ITEMS = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Início" },
  { href: "/visitas", icon: MapPin, label: "Visitas" },
  { href: "/nf", icon: FileText, label: "NFs" },
  { href: "/concorrentes", icon: Building2, label: "Mercado" },
  { href: "/clientes", icon: Users, label: "Clientes" },
  { href: "/pessoas", icon: User, label: "Contatos" },
  { href: "/inteligencia", icon: Brain, label: "Intel" },
  { href: "/configuracoes", icon: Settings, label: "Config" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: perfil } = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: getMeuPerfil,
  });

  // Enquanto carrega (undefined) mostra tudo; depois filtra pela alçada.
  const itens =
    perfil === undefined
      ? NAV_ITEMS
      : NAV_ITEMS.filter((i) => podeAcessar(perfil, i.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-safe">
      <ul className="mx-auto flex max-w-[600px] items-stretch justify-around">
        {itens.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium leading-tight transition-colors sm:text-[11px]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", active && "scale-110")} />
                <span className="w-full truncate text-center">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
