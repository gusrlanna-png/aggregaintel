"use client";

import * as React from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  enderecoDoContato,
  fetchOutlookContacts,
  foneDoContato,
  type GraphContact,
} from "@/lib/graph/contacts";
import {
  addPessoaIdentidade,
  adicionarDadosContato,
  casarContato,
  criarPessoa,
  getIndicePessoas,
  getPessoaById,
  type IndicePessoas,
  type MatchPessoa,
  type Pessoa,
} from "@/lib/supabase/pessoas";

type Aba = "novos" | "sistema" | "duplicatas";

const emailsDe = (c: GraphContact) => (c.emailAddresses ?? []).map((e) => e.address).filter(Boolean);
const fonesDe = (c: GraphContact) =>
  [c.mobilePhone, ...(c.businessPhones ?? [])].filter(Boolean) as string[];
const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function ContatosM365Page() {
  const qc = useQueryClient();
  const [loading, setLoading] = React.useState(false);
  const [contatos, setContatos] = React.useState<GraphContact[] | null>(null);
  const [indice, setIndice] = React.useState<IndicePessoas | null>(null);
  const [feitos, setFeitos] = React.useState<Record<string, "vinculado" | "criado">>({});
  const [conectado, setConectado] = React.useState<boolean | null>(null);
  const [contaOrigem, setContaOrigem] = React.useState<string | null>(null);
  const [aba, setAba] = React.useState<Aba>("duplicatas");
  const [busca, setBusca] = React.useState("");
  const [expandido, setExpandido] = React.useState<string | null>(null);
  const [detalhe, setDetalhe] = React.useState<Record<string, Pessoa | null>>({});

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
      setContaOrigem(sess.session?.user?.email ?? null);
      setFeitos({});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  }

  const matchDe = React.useMemo(() => {
    const m = new Map<string, MatchPessoa>();
    if (contatos && indice) {
      for (const c of contatos)
        m.set(c.id, casarContato({ nome: c.displayName, emails: emailsDe(c), fones: fonesDe(c) }, indice));
    }
    return m;
  }, [contatos, indice]);

  const buckets = React.useMemo(() => {
    const b = { novos: [] as GraphContact[], sistema: [] as GraphContact[], duplicatas: [] as GraphContact[] };
    for (const c of contatos ?? []) {
      const t = matchDe.get(c.id)?.tipo ?? "novo";
      if (feitos[c.id]) b.sistema.push(c);
      else if (t === "existe") b.sistema.push(c);
      else if (t === "duplicata") b.duplicatas.push(c);
      else b.novos.push(c);
    }
    return b;
  }, [contatos, matchDe, feitos]);

  const filtrar = (lista: GraphContact[]) => {
    const toks = norm(busca).split(/\s+/).filter(Boolean);
    if (!toks.length) return lista;
    return lista.filter((c) => {
      const hay = norm([c.displayName, ...emailsDe(c), ...fonesDe(c)].join(" "));
      return toks.every((t) => hay.includes(t));
    });
  };

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["pessoas"] });
    qc.invalidateQueries({ queryKey: ["pessoa-identidades"] });
  }

  async function vincular(c: GraphContact, pessoaId: string) {
    try {
      const email = emailsDe(c)[0] ?? null;
      await addPessoaIdentidade(pessoaId, {
        fonte: "m365",
        external_id: c.id,
        handle: c.displayName,
        url: email ? `mailto:${email}` : null,
        conta_origem: contaOrigem,
      });
      // Traz os dados do contato (e-mails/telefones) para o cadastro existente.
      const r = await adicionarDadosContato(pessoaId, { emails: emailsDe(c), fones: fonesDe(c) });
      setFeitos((p) => ({ ...p, [c.id]: "vinculado" }));
      invalidar();
      const add = r.emails + r.fones;
      toast.success(`Vinculado a ${c.displayName}${add ? ` · ${add} dado(s) adicionado(s)` : ""}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/duplicate|unique/i.test(msg)) {
        try { await adicionarDadosContato(pessoaId, { emails: emailsDe(c), fones: fonesDe(c) }); } catch {}
        setFeitos((p) => ({ ...p, [c.id]: "vinculado" }));
        toast.info("Já vinculado — dados conferidos.");
      } else toast.error(msg || "Erro ao vincular.");
    }
  }

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
          conta_origem: contaOrigem,
        });
      } catch {/* identidade já existe */}
      // Adiciona TODOS os e-mails/telefones do contato (não só o principal).
      try { await adicionarDadosContato(id, { emails: emailsDe(c), fones: fonesDe(c) }); } catch {}
      setFeitos((p) => ({ ...p, [c.id]: "criado" }));
      invalidar();
      toast.success(`${c.displayName} importado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    }
  }

  /** Importa/vincula em massa SÓ a aba atual (não força as outras). */
  async function aplicarAba() {
    const lista = filtrar(buckets[aba]);
    setLoading(true);
    let n = 0;
    for (const c of lista) {
      if (feitos[c.id]) continue;
      const m = matchDe.get(c.id);
      if (aba === "novos") { await criar(c); n++; }
      else if (aba === "sistema" && m?.pessoaId) { await vincular(c, m.pessoaId); n++; }
      // duplicatas: nunca em massa — exige decisão individual
    }
    setLoading(false);
    if (aba !== "duplicatas") toast.success(`${n} contato(s) processado(s).`);
  }

  async function expandir(c: GraphContact, pessoaId?: string) {
    const novo = expandido === c.id ? null : c.id;
    setExpandido(novo);
    if (novo && pessoaId && detalhe[pessoaId] === undefined) {
      const p = await getPessoaById(pessoaId);
      setDetalhe((d) => ({ ...d, [pessoaId]: p }));
    }
  }

  const ABAS: { k: Aba; label: string; cls: string }[] = [
    { k: "duplicatas", label: `Possíveis duplicatas (${buckets.duplicatas.length})`, cls: "text-amber-600" },
    { k: "novos", label: `Disponíveis p/ migrar (${buckets.novos.length})`, cls: "" },
    { k: "sistema", label: `Já no sistema (${buckets.sistema.length})`, cls: "text-emerald-600" },
  ];

  const lista = contatos ? filtrar(buckets[aba]) : [];

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/configuracoes"><ArrowLeft className="h-4 w-4" /> Configurações</Link>
      </Button>
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-bold tracking-tight">Contatos Microsoft 365</h1>
      </div>

      {conectado === false && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="p-4 text-sm">
            Para sincronizar, faça{" "}
            <Link href="/login" className="font-medium underline">login com Microsoft 365</Link>.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Conciliação de contatos do Outlook</CardTitle>
          <Button size="sm" onClick={carregar} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {contatos ? "Atualizar" : "Carregar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {!contatos ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Clique em &ldquo;Carregar&rdquo; para analisar seus contatos (existentes, duplicatas e novos).
            </p>
          ) : (
            <>
              {/* Abas */}
              <div className="flex flex-wrap gap-1 rounded-md border p-1">
                {ABAS.map((a) => (
                  <button
                    key={a.k}
                    onClick={() => { setAba(a.k); setExpandido(null); }}
                    className={cn(
                      "flex-1 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      aba === a.k ? "bg-primary text-primary-foreground" : `hover:bg-muted ${a.cls}`
                    )}
                  >
                    {a.label}
                  </button>
                ))}
              </div>

              {/* Busca multi-texto */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, e-mail ou telefone…"
                    className="pl-8"
                  />
                </div>
                {aba !== "duplicatas" && lista.length > 0 && (
                  <Button size="sm" variant="outline" onClick={aplicarAba} disabled={loading}>
                    {aba === "novos" ? <Download className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    {aba === "novos" ? "Migrar filtrados" : "Vincular filtrados"}
                  </Button>
                )}
              </div>

              {/* Lista da aba */}
              <div className="divide-y rounded-md border">
                {lista.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">Nenhum contato nesta aba/busca.</p>
                ) : (
                  lista.slice(0, 300).map((c) => {
                    const feito = feitos[c.id];
                    const m = matchDe.get(c.id);
                    const email = emailsDe(c)[0];
                    const fone = foneDoContato(c);
                    const aberto = expandido === c.id;
                    const pdet = m?.pessoaId ? detalhe[m.pessoaId] : undefined;
                    return (
                      <div key={c.id} className="text-sm">
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          {aba === "duplicatas" && (
                            <button onClick={() => expandir(c, m?.pessoaId)} className="shrink-0 text-muted-foreground">
                              {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{c.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[email, fone].filter(Boolean).join("  ·  ") || "—"}
                            </p>
                            {!feito && m && m.tipo !== "novo" && (
                              <p className={cn("truncate text-xs", m.tipo === "existe" ? "text-emerald-600" : "text-amber-600")}>
                                {m.tipo === "existe" ? "Já cadastrado" : "Possível duplicata"}: {m.pessoaNome} ({m.motivo})
                              </p>
                            )}
                          </div>
                          {feito ? (
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> {feito === "vinculado" ? "Vinculado" : "Importado"}
                            </span>
                          ) : aba === "sistema" && m?.pessoaId ? (
                            <div className="flex shrink-0 gap-1">
                              <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                                <Link href={`/pessoas/${m.pessoaId}`} target="_blank"><ExternalLink className="h-3.5 w-3.5" /></Link>
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => vincular(c, m.pessoaId!)}>
                                <Link2 className="h-3.5 w-3.5" /> Vincular
                              </Button>
                            </div>
                          ) : aba === "novos" ? (
                            <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => criar(c)}>
                              <UserPlus className="h-3.5 w-3.5" /> Migrar
                            </Button>
                          ) : null}
                        </div>

                        {/* Painel de duplicata lado a lado */}
                        {aba === "duplicatas" && aberto && (
                          <div className="space-y-2 border-t bg-muted/30 p-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md border bg-background p-2">
                                <p className="mb-1 font-semibold text-muted-foreground">Contato do Outlook (365)</p>
                                <p><strong>{c.displayName}</strong></p>
                                <p>{emailsDe(c).join(", ") || "—"}</p>
                                <p>{fonesDe(c).join(", ") || "—"}</p>
                              </div>
                              <div className="rounded-md border bg-background p-2">
                                <p className="mb-1 font-semibold text-muted-foreground">Cadastro existente</p>
                                {pdet === undefined ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : pdet === null ? (
                                  <p>{m?.pessoaNome}</p>
                                ) : (
                                  <>
                                    <p><strong>{pdet.nome}</strong></p>
                                    <p>{pdet.email || "—"}</p>
                                    <p>{pdet.fone || "—"}</p>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => m?.pessoaId && vincular(c, m.pessoaId)}>
                                <Link2 className="h-3.5 w-3.5" /> É a mesma pessoa (vincular)
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => criar(c)}>
                                <UserPlus className="h-3.5 w-3.5" /> São diferentes (criar novo)
                              </Button>
                              {m?.pessoaId && (
                                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                                  <Link href={`/pessoas/${m.pessoaId}`} target="_blank">
                                    <ExternalLink className="h-3.5 w-3.5" /> Abrir/editar cadastro
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {lista.length > 300 && (
                <p className="text-center text-xs text-muted-foreground">
                  Exibindo 300 de {lista.length}. Refine pela busca.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
