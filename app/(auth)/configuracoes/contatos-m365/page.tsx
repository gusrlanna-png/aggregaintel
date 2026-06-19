"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  enderecoDoContato,
  fetchOutlookContacts,
  foneDoContato,
  type GraphContact,
} from "@/lib/graph/contacts";
import { addPessoaIdentidade, criarPessoa, getPessoas } from "@/lib/supabase/pessoas";

export default function ContatosM365Page() {
  const [loading, setLoading] = React.useState(false);
  const [contatos, setContatos] = React.useState<GraphContact[] | null>(null);
  const [importados, setImportados] = React.useState<Set<string>>(new Set());
  const [pessoasEmails, setPessoasEmails] = React.useState<Set<string>>(
    new Set()
  );
  const [conectado, setConectado] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data }) => {
        const token = data.session?.provider_token;
        setConectado(!!token && data.session?.user?.app_metadata?.provider === "azure");
      });
  }, []);

  async function carregar() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.provider_token;
      if (!token) {
        toast.error(
          "Faça login com Microsoft 365 para acessar seus contatos."
        );
        return;
      }

      const [graphContatos, pessoasLocais] = await Promise.all([
        fetchOutlookContacts(token),
        getPessoas(),
      ]);

      const emailsLocais = new Set(
        pessoasLocais
          .map((p) => p.email?.toLowerCase())
          .filter(Boolean) as string[]
      );

      setContatos(graphContatos);
      setPessoasEmails(emailsLocais);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  }

  async function importarContato(c: GraphContact) {
    const email = c.emailAddresses?.[0]?.address ?? null;
    const addr = enderecoDoContato(c);
    try {
      const pessoaId = await criarPessoa({
        nome: c.displayName,
        email,
        fone: foneDoContato(c),
        ...addr,
        notas: "Importado do Microsoft 365",
      });
      // Vincula a identidade M365 (cadastro unificado por origem).
      try {
        await addPessoaIdentidade(pessoaId, {
          fonte: "m365",
          external_id: c.id,
          handle: c.displayName,
          url: email ? `mailto:${email}` : null,
        });
      } catch {
        /* identidade já vinculada — ignora */
      }
      setImportados((prev) => new Set([...prev, c.id]));
      if (email) setPessoasEmails((prev) => new Set([...prev, email.toLowerCase()]));
      toast.success(`${c.displayName} importado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    }
  }

  async function importarTodos() {
    if (!contatos) return;
    const pendentes = contatos.filter((c) => !jaExiste(c) && !importados.has(c.id));
    if (!pendentes.length) {
      toast.info("Todos os contatos já foram importados.");
      return;
    }
    setLoading(true);
    let ok = 0;
    for (const c of pendentes) {
      try {
        await importarContato(c);
        ok++;
      } catch {}
    }
    setLoading(false);
    toast.success(`${ok} contatos importados.`);
  }

  function jaExiste(c: GraphContact) {
    const email = c.emailAddresses?.[0]?.address?.toLowerCase();
    return email ? pessoasEmails.has(email) : false;
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes">
          <ArrowLeft className="h-4 w-4" /> Configurações
        </Link>
      </Button>

      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Contatos Microsoft 365</h1>
      </div>

      {conectado === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Não conectado via Microsoft</p>
            <p className="text-muted-foreground">
              Para sincronizar seus contatos do Outlook, faça{" "}
              <Link href="/login" className="font-medium underline">
                login com Microsoft 365
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Seus contatos do Outlook</CardTitle>
          <div className="flex gap-2">
            {contatos && contatos.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={importarTodos}
                disabled={loading}
              >
                <Download className="h-4 w-4" />
                Importar todos
              </Button>
            )}
            <Button size="sm" onClick={carregar} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {contatos ? "Atualizar" : "Carregar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!contatos ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Clique em &ldquo;Carregar&rdquo; para buscar seus contatos do Outlook.
            </p>
          ) : contatos.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum contato encontrado no Outlook.
            </p>
          ) : (
            <>
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                {contatos.length} contatos encontrados ·{" "}
                {contatos.filter((c) => jaExiste(c) || importados.has(c.id)).length}{" "}
                já no sistema
              </p>
              <div className="divide-y">
                {contatos.map((c) => {
                  const existe = jaExiste(c) || importados.has(c.id);
                  const email = c.emailAddresses?.[0]?.address;
                  const fone = foneDoContato(c);
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.displayName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[email, fone].filter(Boolean).join("  ·  ") || "—"}
                        </p>
                      </div>
                      {existe ? (
                        <Badge variant="secondary" className="shrink-0 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          No sistema
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => importarContato(c)}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Importar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
