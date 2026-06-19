import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Limpa valores da fonte: "", "NULL" e máscaras vazias viram null. */
function clean(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toUpperCase() === "NULL") return null;
  // Máscaras de telefone vazias do tipo "(   )       -    ".
  if (/^[()\-\s.]*$/.test(s)) return null;
  return s;
}
const digits = (v: unknown): string => clean(v)?.replace(/\D/g, "") ?? "";
function coord(v: unknown): number | null {
  const s = clean(v);
  if (s == null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

/** Classificação da fonte → nosso enum de segmento (preserva a original à parte). */
function mapSegmento(s: string | null): string | null {
  if (!s) return null;
  const x = s.toUpperCase();
  if (x.includes("CONCRET")) return "concreto";
  if (x.includes("ASFALTO")) return "asfalto";
  if (x.includes("MOLD")) return "premoldado";
  if (x.includes("DEPOSITO") || x.includes("DISTRIBUIDOR") || x.includes("VAREJO"))
    return "varejo";
  return "outro"; // CONSUMIDOR FINAL, EDIFICACAO, INFRA ESTRUTURA, MINERACOES…
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

  const base = fonte.url as string;
  const headers = { apikey: fonte.anon_key as string, Authorization: `Bearer ${fonte.anon_key}` };
  const rest = `${base}/rest/v1`;

  // Cache empresa_id por CNPJ (find-or-create como cliente).
  const cache = new Map<string, string | null>();
  async function empresaIdPorCnpj(
    cnpjDig: string,
    razao: string | null
  ): Promise<string | null> {
    if (cnpjDig.length < 11) return null;
    if (cache.has(cnpjDig)) return cache.get(cnpjDig)!;
    const { data: achado } = await supabase.rpc("empresa_id_por_cnpj", { p_cnpj: cnpjDig });
    let id = (achado as string | null) ?? null;
    if (!id) {
      const { data: novo } = await supabase
        .from("empresas")
        .insert({ razao_social: razao || "(sem nome)", cnpj: cnpjDig, eh_cliente: true })
        .select("id")
        .single();
      id = novo?.id ?? null;
    }
    cache.set(cnpjDig, id);
    return id;
  }

  async function paginar(
    tabela: string,
    ordem: string,
    fn: (r: Record<string, unknown>) => Promise<void>
  ): Promise<number> {
    let offset = 0;
    const lote = 1000;
    let total = 0;
    for (;;) {
      const res = await fetch(
        `${rest}/${tabela}?select=*&order=${ordem}.asc&limit=${lote}&offset=${offset}`,
        { headers }
      );
      if (!res.ok) throw new Error(`${tabela} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const linhas = (await res.json()) as Record<string, unknown>[];
      if (!linhas.length) break;
      total += linhas.length;
      for (const r of linhas) await fn(r);
      if (linhas.length < lote) break;
      offset += lote;
    }
    return total;
  }

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
    // ── 1) tb_clientes → empresas (eh_cliente) ──────────────────────────────
    out.clientes_total = await paginar("tb_clientes", "CLICOD", async (r) => {
      try {
        const cnpjDig = digits(r.CLICNPJCPF);
        if (cnpjDig.length < 11) { out.clientes_erros++; return; }
        const razao = clean(r.CLINOME);
        const segOrig = clean(r.SEGMENTO_CLIENTE);
        const grupo = clean(r.CLINOME_GRUPO);

        // Campos com valor (não sobrescreve com null no update).
        const campos: Record<string, unknown> = {};
        const setIf = (k: string, v: unknown) => { if (v != null && v !== "") campos[k] = v; };
        setIf("razao_social", razao);
        setIf("fantasia", clean(r.CLINOMEFANT));
        setIf("fone", clean(r.CLITELEFONE) ?? clean(r.CLICELULAR));
        setIf("email", clean(r.CLIEMAIL));
        setIf("bairro", clean(r.CLIBAIRRO));
        setIf("municipio", clean(r.CLICIDADE));
        setIf("uf", clean(r.CLIESTADO));
        setIf("lat", coord(r.CLILATITUDE));
        setIf("lng", coord(r.CLILONGITUDE));
        setIf("segmento", mapSegmento(segOrig));
        setIf("segmento_origem", segOrig);
        setIf("grupo_economico", grupo);

        // Sempre marca como cliente e guarda a origem (rede de segurança).
        const sempre = {
          eh_cliente: true,
          cliente_externo_cod: clean(r.CLICOD) ?? (r.CLICOD != null ? String(r.CLICOD) : null),
          cliente_fonte_id: fonte.id,
          cliente_fonte_raw: r,
        };

        const { data: achado } = await supabase.rpc("empresa_id_por_cnpj", { p_cnpj: cnpjDig });
        const existenteId = (achado as string | null) ?? null;
        if (existenteId) {
          await supabase.from("empresas").update({ ...campos, ...sempre }).eq("id", existenteId);
          cache.set(cnpjDig, existenteId);
          out.clientes_atualizados++;
        } else {
          const { data: novo, error } = await supabase
            .from("empresas")
            .insert({ razao_social: razao || "(sem nome)", cnpj: cnpjDig, ...campos, ...sempre })
            .select("id")
            .single();
          if (error) { out.clientes_erros++; return; }
          cache.set(cnpjDig, novo?.id ?? null);
          out.clientes_criados++;
        }
      } catch {
        out.clientes_erros++;
      }
    });

    // ── 2) tb_cliente_enderecos → cliente_enderecos (obras/usinas) ──────────
    out.enderecos_total = await paginar("tb_cliente_enderecos", "ECLICOD", async (r) => {
      try {
        const cnpjDig = digits(r.CLICNPJCPF);
        const empresaId = await empresaIdPorCnpj(cnpjDig, clean(r.CLINOME));
        if (!empresaId) { out.enderecos_erros++; return; }
        const externoId = r.ECLICOD != null ? String(r.ECLICOD) : null;
        const nome =
          clean(r.CLINOMEFANT) ??
          [clean(r.ECLIBAIRRO), clean(r.ECLICIDADE)].filter(Boolean).join(" - ") ??
          null;
        const payload = {
          empresa_id: empresaId,
          nome,
          segmento: clean(r.SEGMENTO_END_CLIENTE), // preserva a classificação da fonte
          bairro: clean(r.ECLIBAIRRO),
          municipio: clean(r.ECLICIDADE),
          uf: clean(r.ECLIESTADO),
          lat: coord(r.ECLILATITUDE),
          lng: coord(r.ECLILONGITUDE),
          externo_id: externoId,
          fonte_id: fonte.id,
          fonte_raw: r,
        };

        let existenteId: string | null = null;
        if (externoId) {
          const { data: ex } = await supabase
            .from("cliente_enderecos")
            .select("id")
            .eq("fonte_id", fonte.id)
            .eq("externo_id", externoId)
            .maybeSingle();
          existenteId = ex?.id ?? null;
        }
        if (existenteId) {
          await supabase.from("cliente_enderecos").update(payload).eq("id", existenteId);
          out.enderecos_atualizados++;
        } else {
          const { error } = await supabase.from("cliente_enderecos").insert(payload);
          if (error) { out.enderecos_erros++; return; }
          out.enderecos_criados++;
        }
      } catch {
        out.enderecos_erros++;
      }
    });
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
