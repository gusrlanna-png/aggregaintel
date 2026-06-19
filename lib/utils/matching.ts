// Motor de pontuação de similaridade (índice de confiabilidade), reutilizável
// para pessoas e empresas. Cruza vários sinais (e-mail, domínio, telefone,
// nome, empresa) e devolve um score 0–100 + os sinais que coincidiram.

const STOP = new Set([
  "de", "da", "do", "dos", "das", "e", "junior", "jr", "neto", "filho",
  "ltda", "me", "epp", "sa", "s/a", "eireli", "cia", "comercio", "servicos",
  "industria", "e", "&",
]);

const DOMINIOS_GENERICOS = new Set([
  "gmail.com", "gmail.com.br", "googlemail.com", "hotmail.com", "hotmail.com.br",
  "outlook.com", "outlook.com.br", "live.com", "live.com.br", "msn.com",
  "yahoo.com", "yahoo.com.br", "ymail.com", "icloud.com", "me.com",
  "bol.com.br", "uol.com.br", "terra.com.br", "ig.com.br", "globo.com",
]);

export const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

export function tokensNome(nome: string | null | undefined): string[] {
  return norm(nome)
    .replace(/[.,/-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export const dominioEmail = (email: string | null | undefined): string | null => {
  const d = norm(email).split("@")[1];
  return d || null;
};
export const dominioCorporativo = (email: string | null | undefined): string | null => {
  const d = dominioEmail(email);
  return d && !DOMINIOS_GENERICOS.has(d) ? d : null;
};

export const foneKey = (v: string | null | undefined): string => {
  const d = (v ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
};

export interface AlvoMatch {
  nome?: string | null;
  emails?: string[];
  fones?: string[];
  empresa?: string | null; // razão/empresa associada (opcional)
}

export interface SinalMatch {
  tipo: "email" | "dominio" | "telefone" | "nome" | "empresa";
  label: string;
  peso: number;
}

export interface ResultadoMatch {
  score: number; // 0–100
  sinais: SinalMatch[];
  tokensComuns: string[]; // tokens de nome convergentes (para destacar)
}

const inter = <T,>(a: Set<T>, b: Set<T>) => [...a].filter((x) => b.has(x));

/** Pontua a similaridade entre dois alvos (contato × cadastro). */
export function pontuar(a: AlvoMatch, b: AlvoMatch): ResultadoMatch {
  const sinais: SinalMatch[] = [];

  // E-mail exato
  const ae = new Set((a.emails ?? []).map((e) => norm(e)).filter(Boolean));
  const be = new Set((b.emails ?? []).map((e) => norm(e)).filter(Boolean));
  if (inter(ae, be).length) sinais.push({ tipo: "email", label: "E-mail igual", peso: 96 });

  // Domínio corporativo igual
  const ad = new Set([...ae].map(dominioCorporativo).filter(Boolean) as string[]);
  const bd = new Set([...be].map(dominioCorporativo).filter(Boolean) as string[]);
  const domComum = inter(ad, bd);
  if (domComum.length) sinais.push({ tipo: "dominio", label: `Mesmo domínio (${domComum[0]})`, peso: 32 });

  // Telefone (últimos 8 dígitos)
  const af = new Set((a.fones ?? []).map(foneKey).filter(Boolean));
  const bf = new Set((b.fones ?? []).map(foneKey).filter(Boolean));
  if (inter(af, bf).length) sinais.push({ tipo: "telefone", label: "Telefone igual", peso: 85 });

  // Nome (interseção de tokens)
  const at = tokensNome(a.nome);
  const bt = tokensNome(b.nome);
  const tokensComuns = inter(new Set(at), new Set(bt));
  if (at.length && bt.length) {
    const ratio = tokensComuns.length / Math.max(at.length, bt.length);
    if (ratio === 1) sinais.push({ tipo: "nome", label: "Nome igual", peso: 80 });
    else if (tokensComuns.length >= 2) sinais.push({ tipo: "nome", label: `Nome muito parecido (${tokensComuns.length} termos)`, peso: 40 + Math.round(ratio * 25) });
    else if (tokensComuns.length === 1) sinais.push({ tipo: "nome", label: "Nome parcial (1 termo)", peso: 22 });
  }

  // Empresa (tokens em comum entre empresa do contato e nome/empresa do cadastro)
  const aemp = tokensNome(a.empresa);
  const bemp = tokensNome([b.empresa, b.nome].filter(Boolean).join(" "));
  if (aemp.length && inter(new Set(aemp), new Set(bemp)).length) {
    sinais.push({ tipo: "empresa", label: "Empresa em comum", peso: 18 });
  }

  // Combina: maior peso + frações decrescentes dos demais (recompensa múltiplos sinais).
  const pesos = sinais.map((s) => s.peso).sort((x, y) => y - x);
  let score = 0;
  pesos.forEach((p, i) => { score += i === 0 ? p : p * 0.4; });
  score = Math.min(100, Math.round(score));

  return { score, sinais: sinais.sort((x, y) => y.peso - x.peso), tokensComuns };
}

/** Classe de coincidência a partir do score. */
export function classeMatch(score: number): "alto" | "medio" | "baixo" | "nenhum" {
  if (score >= 80) return "alto";
  if (score >= 45) return "medio";
  if (score > 0) return "baixo";
  return "nenhum";
}
