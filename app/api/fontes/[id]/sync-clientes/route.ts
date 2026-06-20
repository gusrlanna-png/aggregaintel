import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Limpa valores da fonte: "", "NULL" e máscaras vazias viram null. */
function clean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NULL") return null;
  if (/^[()\-\s.]*$/.test(s)) return null; // máscara vazia "(   )   -   "
  return s;
}
const digits = (v: unknown): string => clean(v)?.replace(/\D/g, "") ?? "";
function coord(v: unknown): number | null {
  const s = clean(v);
  if (s == null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n !== 0 ? n : null;
}
/** Classificação da fonte → nosso enum (preserva a original em segmento_origem). */
function mapSegmento(s: string | null): string | null {
  if (!s) return null;
  const x = s.toUpperCase();
  if (x.includes("CONCRET")) return "concreto";
  if (x.includes("ASFALTO")) return "asfalto";
  if (x.includes("MOLD")) return "premoldado";
  if (x.includes("DEPOSITO") || x.includes("DISTRIBUIDOR") || x.includes("VAREJO"))
    return "varejo";
  return "outro";
}
const prefere = <T,>(novo: T | null, atual: T | null | undefined): T | null =>
  novo != null ? novo : atual ?? null;

type Supa = ReturnType<typeof createClient>;

/** Lê TODAS as linhas de uma tabela do PostgREST externo (paginado). */
async function lerFonte(
  rest: string,
  headers: Record<string, string>,
  tabela: string,
  ordem: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let off = 0;
  const lote = 1000;
  for (;;) {
    const res = await fetch(
      `${rest}/${tabela}?select=*&order=${ordem}.asc&limit=${lote}&offset=${off}`,
      { headers }
    );
    if (!res.ok) throw new Error(`${tabela} ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const linhas = (await res.json()) as Record<string, unknown>[];
    if (!linhas.length) break;
    out.push(...linhas);
    if (linhas.length < lote) break;
    off += lote;
  }
  return out;
}

/** Faz upsert em lotes de `tam`. */
async function upsertEmLotes(
  supabase: Supa,
  tabela: string,
  linhas: Record<string, unknown>[],
  onConflict: string,
  tam = 500
): Promise<number> {
  let erros = 0;
  for (let i = 0; i < linhas.length; i += tam) {
    const fatia = linhas.slice(i, i + tam);
    const { error } = await supabase.from(tabela).upsert(fatia, { onConflict });
    if (error) erros += fatia.length;
  }
  return erros;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: fonte } = await supabase
    .from("fontes_dados")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!fonte) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  const rest = `${fonte.url}/rest/v1`;
  const headers = { apikey: fonte.anon_key as string, Authorization: `Bearer ${fonte.anon_key}` };

  const out = {
    clientes_total: 0,
    clientes_criados: 0,
    clientes_atualizados: 0,
    clientes_erros: 0,
    enderecos_total: 0,
    enderecos_criados: 0,
    enderecos_atualizados: 0,
    enderecos_erros: 0,
  };

  try {
    // ── Pré-carrega empresas existentes (chave = dígitos do CNPJ) ────────────
    interface EmpRow {
      id: string;
      cnpj: string | null;
      cpf: string | null;
      razao_social: string | null;
      fantasia: string | null;
      fone: string | null;
      email: string | null;
      bairro: string | null;
      municipio: string | null;
      uf: string | null;
      lat: number | null;
      lng: number | null;
      segmento: string | null;
      segmento_origem: string | null;
      grupo_economico: string | null;
    }
    const porCnpj = new Map<string, EmpRow>();
    {
      let from = 0;
      const passo = 1000;
      for (;;) {
        const { data, error } = await supabase
          .from("empresas")
          .select(
            "id, cnpj, cpf, razao_social, fantasia, fone, email, bairro, municipio, uf, lat, lng, segmento, segmento_origem, grupo_economico"
          )
          .range(from, from + passo - 1);
        if (error) throw error;
        const rows = (data as EmpRow[]) ?? [];
        for (const r of rows) {
          // Indexa por CNPJ e por CPF (PF tem cnpj nulo e cpf preenchido).
          const dCnpj = (r.cnpj ?? "").replace(/\D/g, "");
          const dCpf = (r.cpf ?? "").replace(/\D/g, "");
          if (dCnpj.length >= 11) porCnpj.set(dCnpj, r);
          if (dCpf.length === 11) porCnpj.set(dCpf, r);
        }
        if (rows.length < passo) break;
        from += passo;
      }
    }

    // ── 1) tb_clientes → empresas ────────────────────────────────────────────
    const clientes = await lerFonte(rest, headers, "tb_clientes", "CLICOD");
    out.clientes_total = clientes.length;

    // Dedup por chave (a fonte pode repetir CNPJ): upsert não pode afetar a
    // mesma linha 2× no mesmo lote. Insere por cnpj, atualiza por id.
    const insMap = new Map<string, Record<string, unknown>>();
    const updMap = new Map<string, Record<string, unknown>>();
    for (const r of clientes) {
      const d = digits(r.CLICNPJCPF);
      if (d.length < 11) { out.clientes_erros++; continue; }
      const ex = porCnpj.get(d);
      const segOrig = clean(r.SEGMENTO_CLIENTE);
      const merge = {
        razao_social: prefere(clean(r.CLINOME), ex?.razao_social) ?? "(sem nome)",
        fantasia: prefere(clean(r.CLINOMEFANT), ex?.fantasia),
        fone: prefere(clean(r.CLITELEFONE) ?? clean(r.CLICELULAR), ex?.fone),
        email: prefere(clean(r.CLIEMAIL), ex?.email),
        bairro: prefere(clean(r.CLIBAIRRO), ex?.bairro),
        municipio: prefere(clean(r.CLICIDADE), ex?.municipio),
        uf: prefere(clean(r.CLIESTADO), ex?.uf),
        lat: prefere(coord(r.CLILATITUDE), ex?.lat),
        lng: prefere(coord(r.CLILONGITUDE), ex?.lng),
        segmento: prefere(mapSegmento(segOrig), ex?.segmento),
        segmento_origem: prefere(segOrig, ex?.segmento_origem),
        grupo_economico: prefere(clean(r.CLINOME_GRUPO), ex?.grupo_economico),
        grupo_cnpj: clean(r.CLICNPJCPF_GRUPO),
        cliente_secundario_cnpj: clean(r.CLICNPJCPF_SECUNDARIO),
        cliente_secundario_nome: clean(r.CLINOME_SECUNDARIO),
        eh_cliente: true,
        cliente_externo_cod: r.CLICOD != null ? String(r.CLICOD) : null,
        cliente_fonte_id: fonte.id,
        cliente_fonte_raw: r,
      };
      if (ex) updMap.set(ex.id, { id: ex.id, ...merge });
      // PF (11 dígitos) entra no campo cpf; PJ (14) no cnpj — mantém o padrão.
      else insMap.set(d, { ...(d.length === 11 ? { cpf: d } : { cnpj: d }), ...merge });
    }
    const updates = [...updMap.values()];
    const inserts = [...insMap.values()];
    out.clientes_atualizados = updMap.size;
    out.clientes_criados = insMap.size;

    out.clientes_erros += await upsertEmLotes(supabase, "empresas", updates, "id");
    // Insere novos e recupera os ids p/ vincular endereços.
    for (let i = 0; i < inserts.length; i += 500) {
      const fatia = inserts.slice(i, i + 500);
      const { data, error } = await supabase
        .from("empresas")
        .insert(fatia)
        .select("id, cnpj, cpf");
      if (error) {
        out.clientes_erros += fatia.length;
        out.clientes_criados -= fatia.length;
        continue;
      }
      for (const e of (data as { id: string; cnpj: string | null; cpf: string | null }[]) ?? []) {
        const dCnpj = (e.cnpj ?? "").replace(/\D/g, "");
        const dCpf = (e.cpf ?? "").replace(/\D/g, "");
        if (dCnpj) porCnpj.set(dCnpj, { id: e.id } as EmpRow);
        if (dCpf) porCnpj.set(dCpf, { id: e.id } as EmpRow);
      }
    }

    // ── 2) tb_cliente_enderecos → cliente_enderecos ──────────────────────────
    const ends = await lerFonte(rest, headers, "tb_cliente_enderecos", "ECLICOD");
    out.enderecos_total = ends.length;

    // Existentes desta fonte (chave = externo_id) p/ separar criar × atualizar.
    const endExistentes = new Map<string, string>();
    {
      let from = 0;
      const passo = 1000;
      for (;;) {
        const { data, error } = await supabase
          .from("cliente_enderecos")
          .select("id, externo_id")
          .eq("fonte_id", fonte.id)
          .range(from, from + passo - 1);
        if (error) break;
        const rows = (data as { id: string; externo_id: string | null }[]) ?? [];
        for (const r of rows) if (r.externo_id) endExistentes.set(r.externo_id, r.id);
        if (rows.length < passo) break;
        from += passo;
      }
    }

    const endUpdMap = new Map<string, Record<string, unknown>>(); // id -> payload
    const endInsMap = new Map<string, Record<string, unknown>>(); // externo_id -> payload
    const endInsSemId: Record<string, unknown>[] = []; // sem externo_id
    for (const r of ends) {
      const d = digits(r.CLICNPJCPF);
      const emp = porCnpj.get(d);
      if (!emp) { out.enderecos_erros++; continue; }
      const externoId = r.ECLICOD != null ? String(r.ECLICOD) : null;
      const nome =
        clean(r.CLINOMEFANT) ||
        [clean(r.ECLIBAIRRO), clean(r.ECLICIDADE)].filter(Boolean).join(" - ") ||
        null;
      const payload: Record<string, unknown> = {
        empresa_id: emp.id,
        nome,
        segmento: clean(r.SEGMENTO_END_CLIENTE),
        bairro: clean(r.ECLIBAIRRO),
        municipio: clean(r.ECLICIDADE),
        uf: clean(r.ECLIESTADO),
        lat: coord(r.ECLILATITUDE),
        lng: coord(r.ECLILONGITUDE),
        externo_id: externoId,
        fonte_id: fonte.id,
        fonte_raw: r,
      };
      const jaId = externoId ? endExistentes.get(externoId) : undefined;
      if (jaId) endUpdMap.set(jaId, { id: jaId, ...payload });
      else if (externoId) endInsMap.set(externoId, payload);
      else endInsSemId.push(payload);
    }
    const endUpd = [...endUpdMap.values()];
    const endIns = [...endInsMap.values(), ...endInsSemId];
    out.enderecos_atualizados = endUpdMap.size;
    out.enderecos_criados = endIns.length;
    out.enderecos_erros += await upsertEmLotes(supabase, "cliente_enderecos", endUpd, "id");
    for (let i = 0; i < endIns.length; i += 500) {
      const fatia = endIns.slice(i, i + 500);
      const { error } = await supabase.from("cliente_enderecos").insert(fatia);
      if (error) { out.enderecos_erros += fatia.length; out.enderecos_criados -= fatia.length; }
    }

    // Religa NFs às obras agora que os endereços estão atualizados.
    await supabase.rpc("vincular_nf_obras");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha na sincronização.", parcial: out },
      { status: 502 }
    );
  }

  await supabase
    .from("fontes_dados")
    .update({ ultima_sync_clientes: new Date().toISOString(), ultimo_resultado_clientes: out })
    .eq("id", fonte.id);

  return NextResponse.json(out);
}
