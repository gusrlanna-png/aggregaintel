"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import {
  enderecoDoContato,
  fetchOutlookContacts,
  foneDoContato,
  type GraphContact,
} from "@/lib/graph/contacts";
import {
  addPessoaIdentidade,
  casarContato,
  criarPessoa,
  getIndicePessoas,
  type IndicePessoas,
  type MatchPessoa,
} from "@/lib/supabase/pessoas";

function emailsDe(c: GraphContact): string[] {
  return (c.emailAddresses ?? []).map((e) => e.address).filter(Boolean);
}
function fonesDe(c: GraphContact): string[] {
  return [c.mobilePhone, ...(c.businessPhones ?? [])].filter(Boolean) as string[];
}

export default function ContatosM365Page() {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [contatos, setContatos] = React.useState<GraphContact[] | null>(null);
  const [indice, setIndice] = React.useState<IndicePessoas | null>(null);
  const [feitos, setFeitos] = React.useState<Record<string, "vinculado" | "criado">>({});
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
        toast.error("Faça login com Microsoft 365 para acessar seus contatos.");
        return;
      }
      const [graph, idx] = await Promise.all([fetchOutlookContacts(token), getIndicePessoas()]);
      setContatos(graph);
      setIndice(idx);
      setFeitos({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  }

  const match = React.useCallback(
    (c: GraphContact): MatchPessoa => {
      if (!indice) return { tipo: "novo" };
      return casarContato({ nome: c.displayName, emails: emailsDe(c), fones: fonesDe(c) }, indice);
    },
    [indice]
  );

  const resumo = React.useMemo(() => {
    if (!contatos) return { existe: 0, duplicata: 0, novo: 0 };
    let existe = 0, duplicata = 0, novo = 0;
    for (const c of contatos) {
      const t = match(c).tipo;
      if (t === "existe") existe++;
      else if (t === "duplicata") duplicata++;
      else novo++;
    }
    return { existe, duplicata, novo };
  }, [contatos, match]);

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["pessoas"] });
    qc.invalidateQueries({ queryKey: ["pessoa-identidades"] });
  }

  /** Vincula a identidade M365 a uma pessoa existente (sem criar duplicata). */
  async function vincular(c: GraphContact, pessoaId: string) {
    try {
      const email = emailsDe(c)[0] ?? null;
      await addPessoaIdentidade(pessoaId, {
        fonte: "m365",
        external_id: c.id,
        handle: c.displayName,
        url: email ? `mailto:${email}` : null,
      });
      setFeitos((p) => ({ ...p, [c.id]: "vinculado" }));
      invalidar();
      toast.success(`Vinculado a ${c.displayName}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/duplicate|unique/i.test(msg)) {
        setFeitos((p) => ({ ...p, [c.id]: "vinculado" }));
        toast.info("Já estava vinculado.");
      } else toast.error(msg || "Erro ao vincular.");
    }
  }

  /** Cria uma nova pessoa a partir do contato + registra a identidade M365. */
  async function criar(c: GraphContact) {
    try {
      const email = emailsDe(c)[0] ?? null;
      const id = await criarPessoa({
        nome: c.displayName,
        email,
        fone: foneDoContato(c),
        ...enderecoDoContato(c),
        notas: "Importado do Microsoft 365",
      });
      try {
        await addPessoaIdentidade(id, {
          fonte: "m365",
          external_id: c.id,
          handle: c.displayName,
          url: email ? `mailto:${email}` : null,
        });
      } catch {/* identidade já existe */}
      setFeitos((p) => ({ ...p, [c.id]: "criado" }));
      invalidar();
      toast.success(`${c.displayName} importado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    }
  }

  /** Importa todos os "novos" e vincula automaticamente os já existentes. */
  async function importarTodos() {
    if (!contatos) return;
    setLoading(true);
    let nv = 0, vc = 0;
    for (const c of contatos) {
      if (feitos[c.id]) continue;
      const m = match(c);
      if (m.tipo === "existe" && m.pessoaId) {
        await vincular(c, m.pessoaId);
        vc++;
      } else if (m.tipo === "novo") {
        await criar(c);
        nv++;
      }
      // duplicatas exigem decisão manual — não toca
    }
    setLoading(false);
    toast.success(`${nv} novo(s) importado(s) · ${vc} vinculado(s) a existentes.`);
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
              Para sincronizar, faça{" "}
              <Link href="/login" className="font-medium underline">login com Microsoft 365</Link>.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Seus contatos do Outlook</CardTitle>
          <div className="flex gap-2">
            {contatos && contatos.length > 0 && (
              <Button size="sm" variant="outline" onClick={importarTodos} disabled={loading}>
                <Download className="h-4 w-4" /> Importar/Vincular todos
              </Button>
            )}
            <Button size="sm" onClick={carregar} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {contatos ? "Atualizar" : "Carregar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!contatos ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Clique em &ldquo;Carregar&rdquo; para buscar e analisar seus contatos do Outlook.
            </p>
          ) : contatos.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
          ) : (
            <>
              <p className="px-4 pb-2 text-xs text-muted-foreground">
                {contatos.length} contatos · <strong className="text-emerald-600">{resumo.existe} já no sistema</strong> ·{" "}
                <strong className="text-amber-600">{resumo.duplicata} possíveis duplicatas</strong> ·{" "}
                <strong>{resumo.novo} novos</strong>
              </p>
              <div className="divide-y">
                {contatos.map((c) => {
                  const feito = feitos[c.id];
                  const m = match(c);
                  const email = emailsDe(c)[0];
                  const fone = foneDoContato(c);
                  return (
                    <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[email, fone].filter(Boolean).join("  ·  ") || "—"}
                        </p>
                        {!feito && m.tipo !== "novo" && (
                          <p className={`truncate text-xs ${m.tipo === "existe" ? "text-emerald-600" : "text-amber-600"}`}>
                            {m.tipo === "existe" ? "Já cadastrado" : "Possível duplicata"}: {m.pessoaNome} ({m.motivo})
                          </p>
                        )}
                      </div>
                      {feito ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {feito === "vinculado" ? "Vinculado" : "Importado"}
                        </span>
                      ) : m.tipo === "existe" && m.pessoaId ? (
                        <div className="flex shrink-0 gap-1">
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                            <Link href={`/pessoas/${m.pessoaId}`} target="_blank">
                              <ExternalLink className="h-3.5 w-3.5" /> Abrir
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => vincular(c, m.pessoaId!)}>
                            <Link2 className="h-3.5 w-3.5" /> Vincular
                          </Button>
                        </div>
                      ) : m.tipo === "duplicata" && m.pessoaId ? (
                        <div className="flex shrink-0 gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => vincular(c, m.pessoaId!)}>
                            É o mesmo
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => criar(c)}>
                            Novo
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => criar(c)}>
                          <UserPlus className="h-3.5 w-3.5" /> Importar
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
