"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  salvarProcessosJuridicos,
  salvarProcessosAmbientais,
  salvarLinks,
} from "@/lib/supabase/cadastro-empresa";

interface Source {
  url: string;
  title: string;
}
interface LinkItem {
  label: string;
  url: string;
}
interface DadosExtraidos {
  processos_juridicos?: Record<string, unknown>[];
  processos_ambientais?: Record<string, unknown>[];
  links?: { tipo: string; url: string; label?: string | null }[];
}
interface AnaliseResult {
  summary?: string;
  sources?: Source[];
  fallback?: boolean;
  links?: LinkItem[];
  message?: string;
  dados?: DadosExtraidos | null;
}

export function AnaliseMercado({
  nome,
  cnpj,
  municipio,
  emissorId,
}: {
  nome: string;
  cnpj?: string | null;
  municipio?: string | null;
  emissorId?: string;
}) {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<AnaliseResult | null>(null);

  async function persistir(dados: DadosExtraidos) {
    if (!emissorId) return;
    const pj = (dados.processos_juridicos ?? []) as Record<string, unknown>[];
    const pa = (dados.processos_ambientais ?? []) as Record<string, unknown>[];
    const lk = (dados.links ?? []).filter((l) => l && l.url);
    try {
      await salvarProcessosJuridicos(emissorId, pj);
      await salvarProcessosAmbientais(emissorId, pa);
      await salvarLinks(emissorId, lk);
      qc.invalidateQueries({ queryKey: ["proc-jur", emissorId] });
      qc.invalidateQueries({ queryKey: ["proc-amb", emissorId] });
      qc.invalidateQueries({ queryKey: ["links-emp", emissorId] });
      toast.success(
        `Cadastrado: ${pj.length} processo(s) jurídico(s), ${pa.length} ambiental(is), ${lk.length} link(s). Veja a aba Jurídico/Amb.`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gravar os dados extraídos.");
    }
  }

  async function analisar() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/market-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, cnpj, municipio }),
      });
      const json = (await res.json()) as AnaliseResult;
      setResult(json);
      if (json.dados) await persistir(json.dados);
    } catch {
      setResult({
        fallback: true,
        message: "Não foi possível executar a análise.",
        links: [],
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Busca informações recentes sobre <strong>{nome}</strong> —
              publicações, redes sociais, licenciamento ambiental, processos
              (ANM/CFEM), expansões e situação jurídica.
            </p>
          </div>
          <Button onClick={analisar} disabled={loading} className="w-full">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {loading ? "Analisando…" : "Analisar mercado"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          {result.message && (
            <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
              {result.message}
            </p>
          )}

          {result.summary && (
            <Card>
              <CardContent className="p-4">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {result.summary}
                </p>
              </CardContent>
            </Card>
          )}

          {result.sources && result.sources.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-medium">Fontes</p>
                <ul className="space-y-1.5">
                  {result.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-start gap-1.5 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="line-clamp-1">{s.title}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {result.fallback && result.links && result.links.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="mb-2 text-sm font-medium">Atalhos de busca</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {result.links.map((l) => (
                    <a
                      key={l.url}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between rounded-md border p-2 text-sm transition-colors hover:bg-accent"
                    >
                      <span>{l.label}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
