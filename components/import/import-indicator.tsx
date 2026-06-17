"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileStack, Loader2 } from "lucide-react";

import { useImport } from "./import-provider";

/**
 * Indicador flutuante global: mostra a importação de NFs em andamento (ou a
 * fila aguardando revisão) em qualquer tela. A ação continua em segundo plano.
 */
export function ImportIndicator() {
  const pathname = usePathname();
  const { loading, salvandoTodas, progress, espera, items } = useImport();

  // Na própria tela de captura a UI completa já é exibida.
  if (pathname?.startsWith("/nf/nova")) return null;

  const emAndamento = loading || salvandoTodas;
  const pendentes = !emAndamento && items && items.length > 0;
  if (!emAndamento && !pendentes) return null;

  const pct = progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  return (
    <Link
      href="/nf/nova"
      className="fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-[600px] items-center gap-3 rounded-lg border bg-background/95 px-4 py-3 shadow-lg backdrop-blur pb-safe"
    >
      {emAndamento ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
      ) : (
        <FileStack className="h-5 w-5 shrink-0 text-primary" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {salvandoTodas
            ? `Salvando NFs… ${progress.done}/${progress.total}`
            : loading
              ? `Lendo notas fiscais… ${progress.done}/${progress.total}`
              : `${items?.length} NF(s) aguardando revisão`}
        </p>
        {emAndamento && (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {espera && (
          <p className="mt-0.5 text-xs text-amber-600">{espera}</p>
        )}
      </div>
      <span className="shrink-0 text-xs font-medium text-primary">
        {emAndamento ? "ver" : "revisar"}
      </span>
    </Link>
  );
}
