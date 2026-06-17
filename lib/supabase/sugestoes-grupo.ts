import { createClient } from "./client";
import { isSupabaseConfigured } from "./config";
import { buscarTudo } from "./paginate";

export interface SugestaoGrupo {
  chave: string;
  membros: { id: string; razao_social: string; grupo_economico: string | null }[];
  socios: string[];
  nomeSugerido: string;
}

const STOP = new Set([
  "LTDA", "S/A", "SA", "S.A", "EIRELI", "ME", "EPP", "MINERACAO", "MINERAÇÃO",
  "BENEFICIAMENTO", "DE", "DA", "DO", "DOS", "DAS", "E", "EM", "RECUPERACAO",
  "RECUPERAÇÃO", "JUDICIAL", "PEDREIRA", "MINERIOS", "MINÉRIOS", "COMERCIO",
  "COMÉRCIO", "INDUSTRIA", "INDÚSTRIA", "EXTRACAO", "EXTRAÇÃO", "LTDA.",
]);

function tituloCaso(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/**
 * Sugere grupos econômicos agrupando produtores que compartilham sócios.
 * Usa união (connected components) por pessoa; ignora pessoas em muitas empresas
 * para evitar falsos positivos por homônimos.
 */
export async function getSugestoesGrupo(): Promise<SugestaoGrupo[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();

  const socios = await buscarTudo<{
    emissor_id: string;
    pessoa_id: string | null;
    nome: string;
  }>((from, to) =>
    supabase.from("socios").select("emissor_id, pessoa_id, nome").range(from, to)
  );
  const emissores = await buscarTudo<{
    id: string;
    razao_social: string;
    grupo_economico: string | null;
  }>((from, to) =>
    supabase.from("emissores").select("id, razao_social, grupo_economico").range(from, to)
  );
  const emap = new Map(emissores.map((e) => [e.id, e]));

  // pessoa -> empresas (e nome da pessoa)
  const porPessoa = new Map<string, Set<string>>();
  const nomePessoa = new Map<string, string>();
  for (const s of socios) {
    if (!s.pessoa_id || !s.emissor_id) continue;
    if (!porPessoa.has(s.pessoa_id)) porPessoa.set(s.pessoa_id, new Set());
    porPessoa.get(s.pessoa_id)!.add(s.emissor_id);
    if (s.nome) nomePessoa.set(s.pessoa_id, s.nome);
  }

  // União por pessoa (limita a pessoas em 2..10 empresas)
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  const ensure = (x: string) => {
    if (!parent.has(x)) parent.set(x, x);
  };
  const union = (a: string, b: string) => {
    ensure(a);
    ensure(b);
    parent.set(find(a), find(b));
  };
  for (const [, emps] of porPessoa) {
    const arr = [...emps];
    if (arr.length < 2 || arr.length > 10) continue;
    for (let i = 1; i < arr.length; i++) union(arr[0], arr[i]);
  }

  // Agrupa por componente
  const comps = new Map<string, string[]>();
  for (const id of parent.keys()) {
    const r = find(id);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r)!.push(id);
  }

  const sugestoes: SugestaoGrupo[] = [];
  for (const [root, ids] of comps) {
    if (ids.length < 2) continue;
    const membros = ids
      .map((id) => emap.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e);
    if (membros.length < 2) continue;

    // Já estão todos no mesmo grupo? então não sugere.
    const grupos = new Set(membros.map((m) => m.grupo_economico).filter(Boolean));
    if (grupos.size === 1 && membros.every((m) => m.grupo_economico)) continue;

    // Sócios que conectam (em >=2 membros do componente)
    const setIds = new Set(ids);
    const contagem = new Map<string, number>();
    for (const [pid, emps] of porPessoa) {
      const dentro = [...emps].filter((e) => setIds.has(e)).length;
      if (dentro >= 2) contagem.set(pid, dentro);
    }
    const sociosOrdenados = [...contagem.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pid]) => nomePessoa.get(pid) ?? "")
      .filter(Boolean);

    // Nome sugerido: grupo existente (se houver) ou sobrenome do sócio principal.
    let nomeSugerido = [...grupos][0] ?? "";
    if (!nomeSugerido && sociosOrdenados[0]) {
      const partes = sociosOrdenados[0].trim().split(/\s+/).filter((w) => !STOP.has(w.toUpperCase()));
      const sobrenome = partes[partes.length - 1] ?? partes[0] ?? "";
      nomeSugerido = `Grupo ${tituloCaso(sobrenome)}`;
    }
    if (!nomeSugerido) {
      const tokens = membros[0].razao_social.split(/\s+/).filter((w) => !STOP.has(w.toUpperCase()));
      nomeSugerido = `Grupo ${tituloCaso(tokens[0] ?? membros[0].razao_social)}`;
    }

    sugestoes.push({
      chave: root,
      membros: membros.sort((a, b) => a.razao_social.localeCompare(b.razao_social)),
      socios: sociosOrdenados.slice(0, 4),
      nomeSugerido,
    });
  }

  return sugestoes.sort((a, b) => b.membros.length - a.membros.length);
}
