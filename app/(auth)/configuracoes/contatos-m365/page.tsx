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
  buscarPessoas,
  criarPessoa,
  getIndicePessoas,
  rankearCandidatos,
  type CandidatoMatch,
  type IndicePessoas,
  type Pessoa,
} from "@/lib/supabase/pessoas";
import { classeMatch } from "@/lib/utils/matching";

type Aba = "novos" | "sistema" | "duplicatas";

const emailsDe = (c: GraphContact) => (c.emailAddresses ?? []).map((e) => e.address).filter(Boolean);
const fonesDe = (c: GraphContact) =>
  [c.mobilePhone, ...(c.businessPhones ?? [])].filter(Boolean) as string[];
const rawDe = (c: GraphContact): Record<string, unknown> => ({
  nome: c.displayName,
  emails: emailsDe(c),
  telefones: fonesDe(c),
  empresa: c.companyName ?? null,
  cargo: c.jobTitle ?? null,
  endereco: enderecoDoContato(c),
  capturado_em: new Date().toISOString(),
});
const norm = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const CLASSE_BADGE: Record<string, string> = {
  alto: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  medio: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  baixo: "bg-muted text-muted-foreground",
  nenhum: "bg-muted text-muted-foreground",
};

/** Destaca, em negrito, os termos do nome que coincidem com o cadastro. */
function NomeDestacado({ nome, comuns }: { nome: string; comuns: string[] }) {
  if (!comuns.length) return <>{nome}</>;
  const set = new Set(comuns);
  return (
    <>
      {nome.split(/(\s+)/).map((parte, i) => {
        const t = norm(parte.replace(/[.,/-]/g, ""));
        return set.has(t) ? (
          <strong key={i} className="text-foreground">{parte}</strong>
        ) : (
          <span key={i}>{parte}</span>
        );
      })}
    </>
  );
}

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
  const [ordenarScore, setOrdenarScore] = React.useState(true);
  const [expandido, setExpandido] = React.useState<string | null>(null);

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

  // Candidatos rankeados (índice de confiabilidade) por contato.
  const rankDe = React.useMemo(() => {
    const m = new Map<string, CandidatoMatch[]>();
    if (contatos && indice) {
      for (const c of contatos) {
        m.set(
          c.id,
          rankearCandidatos(
            {
              nome: c.displayName,
              emails: emailsDe(c),
              fones: fonesDe(c),
              empresa: c.companyName ?? null,
              externalId: c.id,
              fonte: "m365",
            },
            indice,
            5
          )
        );
      }
    }
    return m;
  }, [contatos, indice]);

  const topDe = React.useCallback(
    (id: string) => rankDe.get(id)?.[0] ?? null,
    [rankDe]
  );

  const buckets = React.useMemo(() => {
    const b = { novos: [] as GraphContact[], sistema: [] as GraphContact[], duplicatas: [] as GraphContact[] };
    for (const c of contatos ?? []) {
      if (feitos[c.id]) { b.sistema.push(c); continue; }
      const top = topDe(c.id);
      const score = top?.score ?? 0;
      if (top?.jaVinculado || score >= 80) b.sistema.push(c);
      else if (score >= 45) b.duplicatas.push(c);
      else b.novos.push(c);
    }
    return b;
  }, [contatos, topDe, feitos]);

  const filtrar = (lista: GraphContact[]) => {
    const toks = norm(busca).split(/\s+/).filter(Boolean);
    let arr = lista;
    if (toks.length) {
      arr = lista.filter((c) => {
        const hay = norm(
          [c.displayName, c.companyName, ...emailsDe(c), ...fonesDe(c)].filter(Boolean).join(" ")
        );
        return toks.every((t) => hay.includes(t));
      });
    }
    if (ordenarScore) {
      arr = [...arr].sort((a, b) => (topDe(b.id)?.score ?? 0) - (topDe(a.id)?.score ?? 0));
    }
    return arr;
  };

  function invalidar() {
    qc.invalidateQueries({ queryKey: ["pessoas"] });
    qc.invalidateQueries({ queryKey: ["pessoa-identidades"] });
  }

  async function vincular(c: GraphContact, pessoaId: string, nome?: string) {
    try {
      const email = emailsDe(c)[0] ?? null;
      await addPessoaIdentidade(pessoaId, {
        fonte: "m365",
        external_id: c.id,
        handle: c.displayName,
        url: email ? `mailto:${email}` : null,
        conta_origem: contaOrigem,
        raw: rawDe(c),
      });
      const r = await adicionarDadosContato(pessoaId, { emails: emailsDe(c), fones: fonesDe(c) });
      setFeitos((p) => ({ ...p, [c.id]: "vinculado" }));
      invalidar();
      const add = r.emails + r.fones;
      toast.success(`Vinculado a ${nome ?? c.displayName}${add ? ` · ${add} dado(s) adicionado(s)` : ""}.`);
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
        notas: c.companyName ? `Microsoft 365 · ${c.companyName}` : "Importado do Microsoft 365",
      });
      try {
        await addPessoaIdentidade(id, {
          fonte: "m365",
          external_id: c.id,
          handle: c.displayName,
          url: email ? `mailto:${email}` : null,
          conta_origem: contaOrigem,
          raw: rawDe(c),
        });
      } catch {/* identidade já existe */}
      try { await adicionarDadosContato(id, { emails: emailsDe(c), fones: fonesDe(c) }); } catch {}
      setFeitos((p) => ({ ...p, [c.id]: "criado" }));
      invalidar();
      toast.success(`${c.displayName} importado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar.");
    }
  }

  async function aplicarAba() {
    const lista = filtrar(buckets[aba]);
    setLoading(true);
    let n = 0;
    for (const c of lista) {
      if (feitos[c.id]) continue;
      if (aba === "novos") { await criar(c); n++; }
      else if (aba === "sistema") {
        const top = topDe(c.id);
        if (top?.id) { await vincular(c, top.id, top.nome); n++; }
      }
    }
    setLoading(false);
    if (aba !== "duplicatas") toast.success(`${n} contato(s) processado(s).`);
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight">Contatos Microsoft 365</h1>
        </div>
        <Link
          href="/configuracoes/historico-contatos-m365"
          className="shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Histórico por usuário
        </Link>
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

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px] flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Buscar por nome, empresa, e-mail ou telefone…"
                    className="pl-8"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={ordenarScore}
                    onChange={(e) => setOrdenarScore(e.target.checked)}
                  />
                  Ordenar por % de coincidência
                </label>
                {aba !== "duplicatas" && lista.length > 0 && (
                  <Button size="sm" variant="outline" onClick={aplicarAba} disabled={loading}>
                    {aba === "novos" ? <Download className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    {aba === "novos" ? "Migrar filtrados" : "Vincular filtrados"}
                  </Button>
                )}
              </div>

              <div className="divide-y rounded-md border">
                {lista.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">Nenhum contato nesta aba/busca.</p>
                ) : (
                  lista.slice(0, 300).map((c) => (
                    <LinhaContato
                      key={c.id}
                      c={c}
                      aba={aba}
                      candidatos={rankDe.get(c.id) ?? []}
                      feito={feitos[c.id]}
                      aberto={expandido === c.id}
                      onToggle={() => setExpandido(expandido === c.id ? null : c.id)}
                      onVincular={vincular}
                      onCriar={criar}
                    />
                  ))
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

function PorcentBadge({ score }: { score: number }) {
  if (score <= 0) return null;
  return (
    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", CLASSE_BADGE[classeMatch(score)])}>
      {score}%
    </span>
  );
}

function LinhaContato({
  c, aba, candidatos, feito, aberto, onToggle, onVincular, onCriar,
}: {
  c: GraphContact;
  aba: Aba;
  candidatos: CandidatoMatch[];
  feito?: "vinculado" | "criado";
  aberto: boolean;
  onToggle: () => void;
  onVincular: (c: GraphContact, pessoaId: string, nome?: string) => void;
  onCriar: (c: GraphContact) => void;
}) {
  const top = candidatos[0];
  const email = (c.emailAddresses ?? [])[0]?.address;
  const fone = foneDoContato(c);

  return (
    <div className="text-sm">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={onToggle} className="shrink-0 text-muted-foreground">
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-medium">
            <span className="truncate">
              <NomeDestacado nome={c.displayName} comuns={top?.tokensComuns ?? []} />
            </span>
            {top && <PorcentBadge score={top.score} />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[c.companyName, email, fone].filter(Boolean).join("  ·  ") || "—"}
          </p>
          {top && !feito && (
            <p className="truncate text-xs text-muted-foreground">
              {top.jaVinculado ? "Já vinculado a " : "Mais provável: "}
              <span className="font-medium">{top.nome}</span>
              {top.sinais.length > 0 && ` · ${top.sinais.map((s) => s.label).join(", ")}`}
            </p>
          )}
        </div>
        {feito ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> {feito === "vinculado" ? "Vinculado" : "Importado"}
          </span>
        ) : aba === "novos" ? (
          <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => onCriar(c)}>
            <UserPlus className="h-3.5 w-3.5" /> Migrar
          </Button>
        ) : top?.id ? (
          <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => onVincular(c, top.id, top.nome)}>
            <Link2 className="h-3.5 w-3.5" /> Vincular
          </Button>
        ) : null}
      </div>

      {aberto && (
        <PainelConciliacao
          c={c}
          candidatos={candidatos}
          onVincular={onVincular}
          onCriar={onCriar}
        />
      )}
    </div>
  );
}

function PainelConciliacao({
  c, candidatos, onVincular, onCriar,
}: {
  c: GraphContact;
  candidatos: CandidatoMatch[];
  onVincular: (c: GraphContact, pessoaId: string, nome?: string) => void;
  onCriar: (c: GraphContact) => void;
}) {
  const [buscaOutro, setBuscaOutro] = React.useState("");
  const [resultados, setResultados] = React.useState<Pessoa[]>([]);
  const [buscando, setBuscando] = React.useState(false);

  async function procurar(termo: string) {
    setBuscaOutro(termo);
    if (termo.trim().length < 2) { setResultados([]); return; }
    setBuscando(true);
    try {
      setResultados(await buscarPessoas(termo, 8));
    } finally {
      setBuscando(false);
    }
  }

  const emails = (c.emailAddresses ?? []).map((e) => e.address).filter(Boolean);
  const fones = [c.mobilePhone, ...(c.businessPhones ?? [])].filter(Boolean) as string[];

  return (
    <div className="space-y-3 border-t bg-muted/30 p-3 text-xs">
      {/* Contato do Outlook */}
      <div className="rounded-md border bg-background p-2">
        <p className="mb-1 font-semibold text-muted-foreground">Contato do Outlook (365)</p>
        <p><strong>{c.displayName}</strong>{c.companyName ? ` · ${c.companyName}` : ""}</p>
        <p>{emails.join(", ") || "—"}</p>
        <p>{fones.join(", ") || "—"}</p>
      </div>

      {/* Candidatos rankeados */}
      <div>
        <p className="mb-1 font-semibold text-muted-foreground">
          Cadastros parecidos {candidatos.length ? `(${candidatos.length})` : ""}
        </p>
        {candidatos.length === 0 ? (
          <p className="text-muted-foreground">Nenhum candidato automático. Use a busca abaixo para vincular a um cadastro existente.</p>
        ) : (
          <div className="space-y-1.5">
            {candidatos.map((cand) => (
              <div key={cand.id} className="flex items-center gap-2 rounded-md border bg-background p-2">
                <PorcentBadge score={cand.score} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{cand.nome}</p>
                  <p className="truncate text-muted-foreground">
                    {cand.sinais.map((s) => s.label).join(" · ") || "—"}
                  </p>
                </div>
                <Link href={`/pessoas/${cand.id}`} target="_blank" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
                <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => onVincular(c, cand.id, cand.nome)}>
                  <Link2 className="h-3.5 w-3.5" /> Vincular
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Vincular a OUTRO cadastro (não sugerido) */}
      <div>
        <p className="mb-1 font-semibold text-muted-foreground">Vincular a outro cadastro</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={buscaOutro}
            onChange={(e) => procurar(e.target.value)}
            placeholder="Buscar pessoa por nome ou e-mail…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        {buscando ? (
          <div className="py-2 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : resultados.length > 0 ? (
          <div className="mt-1 divide-y rounded-md border bg-background">
            {resultados.map((p) => (
              <div key={p.id} className="flex items-center gap-2 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="truncate text-muted-foreground">{[p.email, p.fone].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" onClick={() => onVincular(c, p.id, p.nome)}>
                  <Link2 className="h-3.5 w-3.5" /> Vincular
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Criar novo */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onCriar(c)}>
          <UserPlus className="h-3.5 w-3.5" /> São diferentes (criar novo)
        </Button>
      </div>
    </div>
  );
}
