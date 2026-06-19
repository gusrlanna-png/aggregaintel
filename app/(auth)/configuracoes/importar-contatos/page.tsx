"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { parseContatosCsv, type ContatoCsv } from "@/lib/import/contatos-csv";
import { importarContatosCsv } from "@/lib/supabase/pessoas";

export default function ImportarContatosPage() {
  const qc = useQueryClient();
  const [rows, setRows] = React.useState<ContatoCsv[]>([]);
  const [arquivo, setArquivo] = React.useState<string>("");
  const [importando, setImportando] = React.useState(false);
  const [resultado, setResultado] = React.useState<{ criados: number; pulados: number; erros: number } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setResultado(null);
    try {
      const texto = await f.text();
      const parsed = parseContatosCsv(texto);
      setRows(parsed);
      setArquivo(f.name);
      if (parsed.length === 0) toast.error("Nenhum contato reconhecido no CSV.");
    } catch {
      toast.error("Não consegui ler o arquivo.");
    }
  }

  async function importar() {
    if (rows.length === 0) return;
    setImportando(true);
    try {
      const res = await importarContatosCsv(rows);
      setResultado(res);
      qc.invalidateQueries({ queryKey: ["pessoas"] });
      toast.success(`${res.criados} contato(s) importado(s).`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setImportando(false);
    }
  }

  const comFone = rows.filter((r) => r.fones.length).length;
  const comEmail = rows.filter((r) => r.emails.length).length;

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Importar contatos (CSV)</h1>
          <p className="text-sm text-muted-foreground">
            Google Contacts, contatos do celular ou CSV com nome/telefone/e-mail.
            Contatos já cadastrados (mesmo nome) são ignorados.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/50">
            <Upload className="h-5 w-5" />
            {arquivo || "Selecionar arquivo .csv"}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>

          {rows.length > 0 && (
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p>
                <strong>{rows.length}</strong> contato(s) reconhecido(s) — {comFone} com telefone, {comEmail} com e-mail.
              </p>
              <div className="mt-2 max-h-48 divide-y overflow-y-auto rounded-md border bg-background">
                {rows.slice(0, 50).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium">{r.nome}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {[r.fones[0], r.emails[0]].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))}
              </div>
              {rows.length > 50 && (
                <p className="mt-1 text-xs text-muted-foreground">… e mais {rows.length - 50}.</p>
              )}
            </div>
          )}

          {resultado && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              ✅ {resultado.criados} criado(s) · {resultado.pulados} já existiam (ignorados)
              {resultado.erros ? ` · ${resultado.erros} erro(s)` : ""}.
            </div>
          )}

          <Button onClick={importar} disabled={importando || rows.length === 0} className="w-full">
            {importando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Importar {rows.length || ""} contato(s)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
