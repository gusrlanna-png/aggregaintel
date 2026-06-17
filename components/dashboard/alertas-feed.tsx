"use client";

import Link from "next/link";
import { AlertTriangle, TrendingUp, UserPlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import type { InteligenciaMercado } from "@/lib/supabase/types";

function iconFor(item: InteligenciaMercado) {
  if (item.tags?.includes("novo-emissor")) return UserPlus;
  if (item.classificacao === "volume") return TrendingUp;
  return AlertTriangle;
}

export function AlertasFeed({ items }: { items: InteligenciaMercado[] }) {
  if (!items.length)
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum alerta ativo.
      </p>
    );

  return (
    <ul className="divide-y">
      {items.map((item) => {
        const Icon = iconFor(item);
        const when = item.criado_em
          ? formatDistanceToNow(new Date(item.criado_em), {
              addSuffix: true,
              locale: ptBR,
            })
          : "";
        return (
          <li key={item.id} className="flex gap-3 py-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">{item.texto_extraido}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="warning" className="text-[10px]">
                  {item.classificacao ?? "alerta"}
                </Badge>
                <span className="text-xs text-muted-foreground">{when}</span>
                <Link
                  href="/inteligencia"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  ver detalhe
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
