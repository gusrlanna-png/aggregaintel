"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  FileText,
  LayoutGrid,
  Mail,
  Network,
  Search,
  User,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchBusca } from "@/components/ui/busca-tabela";
import { getProdutoresMercado } from "@/lib/supabase/emissores";
import { getClientes } from "@/lib/supabase/clientes";
import { getPessoas } from "@/lib/supabase/pessoas";
import { searchNFs } from "@/lib/supabase/nf";
import { buscarEmailIndice } from "@/lib/supabase/email-indice";
import { mascararCnpj } from "@/lib/utils/cnpj";
import { cn } from "@/lib/utils";

const normTxt = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

interface Resultado {
  href: string;
  titulo: string;
  detalhe?: string;
}

/** Páginas do sistema (navegação) — atuais e futuras: basta adicionar aqui. */
const PAGINAS: { href: string; titulo: string; termos: string }[] = [
  { href: "/dashboard", titulo: "Início (Dashboard)", termos: "inicio home painel" },
  { href: "/nf", titulo: "Notas Fiscais", termos: "nf nota fiscal danfe importar" },
  { href: "/concorrentes", titulo: "Mercado · Produtores", termos: "mercado produtores concorrentes" },
  { href: "/clientes", titulo: "Clientes", termos: "clientes" },
  { href: "/pessoas", titulo: "Pessoas (sócios)", termos: "pessoas socios" },
  { href: "/grupos", titulo: "Grupos econômicos", termos: "grupos economico holding" },
  { href: "/vendas", titulo: "Planejamento de vendas", termos: "vendas planejamento metas" },
  { href: "/mercados", titulo: "Mercados", termos: "mercados regioes" },
  { href: "/mapa", titulo: "Mapa de decisão", termos: "mapa decisao raio" },
  { href: "/inteligencia", titulo: "Inteligência", termos: "inteligencia feed intel" },
  { href: "/cfem", titulo: "CFEM / ANM", termos: "cfem anm royalties" },
  { href: "/produtos", titulo: "Produtos (catálogo)", termos: "produtos catalogo brita areia" },
  { href: "/configuracoes", titulo: "Configurações", termos: "config integracao ajustes" },
];

function Grupo({
  titulo,
  icon: Icon,
  itens,
  onPick,
}: {
  titulo: string;
  icon: React.ElementType;
  itens: Resultado[];
  onPick: (href: string) => void;
}) {
  if (itens.length === 0) return null;
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      {itens.map((r, i) => (
        <button
          key={`${r.href}-${i}`}
          type="button"
          onClick={() => onPick(r.href)}
          className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-accent"
        >
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{r.titulo}</span>
            {r.detalhe && (
              <span className="block truncate text-xs text-muted-foreground">
                {r.detalhe}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Busca macro do sistema: páginas + produtores + clientes + pessoas + NFs.
 * `variant="header"` = ícone no cabeçalho; `variant="hero"` = campo grande.
 */
export function GlobalSearch({
  variant = "header",
}: {
  variant?: "header" | "hero";
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");

  const { data: produtores = [] } = useQuery({
    queryKey: ["produtores-mercado"],
    queryFn: getProdutoresMercado,
    enabled: open,
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-busca-global"],
    queryFn: () => getClientes(),
    enabled: open,
  });
  const { data: pessoas = [] } = useQuery({
    queryKey: ["pessoas"],
    queryFn: getPessoas,
    enabled: open,
  });
  const { data: nfs = [] } = useQuery({
    queryKey: ["nf-busca-global", q],
    queryFn: () => searchNFs(q),
    enabled: open && q.trim().length >= 2,
  });
  const { data: emails = [] } = useQuery({
    queryKey: ["email-busca-global", q],
    queryFn: () => buscarEmailIndice({ termo: q, limite: 6 }),
    enabled: open && q.trim().length >= 2,
  });

  const termo = q.trim();
  const temBusca = termo.length >= 1;

  const paginas: Resultado[] = PAGINAS.filter((p) =>
    matchBusca(termo, p.titulo, p.termos)
  ).map((p) => ({ href: p.href, titulo: p.titulo }));

  const prodRes: Resultado[] = temBusca
    ? produtores
        .filter((p) =>
          matchBusca(termo, p.razao_social, p.cnpj, p.municipio, p.grupo_economico)
        )
        .slice(0, 6)
        .map((p) => ({
          href: `/concorrentes/${p.id}`,
          titulo: p.razao_social,
          detalhe: [p.cnpj ? mascararCnpj(p.cnpj) : null, p.municipio]
            .filter(Boolean)
            .join(" · "),
        }))
    : [];

  const cliRes: Resultado[] = temBusca
    ? clientes
        .filter((c) =>
          matchBusca(termo, c.razao_social, c.fantasia, c.cnpj, c.municipio, c.grupo_economico)
        )
        .slice(0, 6)
        .map((c) => ({
          href: `/clientes/${c.id}`,
          titulo: c.razao_social,
          detalhe: [c.cnpj ? mascararCnpj(c.cnpj) : null, c.municipio]
            .filter(Boolean)
            .join(" · "),
        }))
    : [];

  const pesRes: Resultado[] = temBusca
    ? pessoas
        .filter((p) => matchBusca(termo, p.nome, p.cpf, p.municipio))
        .slice(0, 6)
        .map((p) => ({
          href: `/pessoas/${p.id}`,
          titulo: p.nome,
          detalhe: p.municipio ?? undefined,
        }))
    : [];

  const nfRes: Resultado[] = nfs.slice(0, 6).map((n) => ({
    href: `/nf/${n.id}`,
    titulo: `NF ${n.numero_nf}${n.serie ? `/${n.serie}` : ""}`,
    detalhe: [n.emissor?.razao_social, n.cliente?.razao_social, n.data_emissao]
      .filter(Boolean)
      .join(" · "),
  }));

  // Grupos econômicos (derivados de clientes + produtores) → página do grupo.
  const grupoRes: Resultado[] = temBusca
    ? (() => {
        const m = new Map<string, Resultado>();
        const add = (g: string | null | undefined) => {
          if (g && matchBusca(termo, g)) {
            const k = normTxt(g);
            if (!m.has(k)) m.set(k, { href: `/grupos/${encodeURIComponent(g)}`, titulo: g, detalhe: "Grupo econômico" });
          }
        };
        for (const c of clientes) add(c.grupo_economico);
        for (const p of produtores) add(p.grupo_economico);
        return [...m.values()].slice(0, 6);
      })()
    : [];

  const emailRes: Resultado[] = emails.slice(0, 6).map((e) => ({
    href: e.pessoa_id ? `/pessoas/${e.pessoa_id}` : "/configuracoes/emails",
    titulo: e.assunto || "(sem assunto)",
    detalhe: [e.de_email, e.contato_email].filter(Boolean).join(" · "),
  }));

  const total =
    paginas.length + prodRes.length + cliRes.length + pesRes.length +
    grupoRes.length + nfRes.length + emailRes.length;

  function pick(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  return (
    <>
      {variant === "header" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buscar no sistema"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground sm:h-9 sm:w-auto sm:gap-2 sm:px-3"
        >
          <Search className="h-5 w-5" />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            Buscar…
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg border bg-card px-4 py-3 text-left text-muted-foreground shadow-sm hover:border-primary/50"
          )}
        >
          <Search className="h-5 w-5" />
          <span className="text-sm">
            Buscar no sistema — produtor, cliente, pessoa, NF ou página…
          </span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[10%] max-w-lg translate-y-0 gap-0 p-0">
          <DialogHeader className="border-b p-3">
            <DialogTitle className="sr-only">Busca no sistema</DialogTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar produtor, cliente, pessoa, nº de NF, página…"
                className="pl-9"
              />
            </div>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto p-1">
            {total === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                {temBusca
                  ? "Nenhum resultado encontrado."
                  : "Digite para buscar em todo o sistema."}
              </p>
            ) : (
              <>
                <Grupo titulo="Páginas" icon={LayoutGrid} itens={paginas} onPick={pick} />
                <Grupo titulo="Produtores" icon={Building2} itens={prodRes} onPick={pick} />
                <Grupo titulo="Clientes" icon={Users} itens={cliRes} onPick={pick} />
                <Grupo titulo="Grupos econômicos" icon={Network} itens={grupoRes} onPick={pick} />
                <Grupo titulo="Pessoas" icon={User} itens={pesRes} onPick={pick} />
                <Grupo titulo="Notas Fiscais" icon={FileText} itens={nfRes} onPick={pick} />
                <Grupo titulo="E-mails (M365)" icon={Mail} itens={emailRes} onPick={pick} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
