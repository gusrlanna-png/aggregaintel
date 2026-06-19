import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const one = (xml: string, tag: string): string | null => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m ? m[1].trim() : null;
};
const all = (xml: string, tag: string): string[] =>
  [...xml.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "g"))].map((m) => m[1].trim());
const num = (v: string | null | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function classificaProduto(desc: string): string {
  const d = (desc || "").toLowerCase();
  if (d.includes("graduada") || d.includes("bgs")) return "bg";
  if (d.includes("pedrisco") || d.includes("brita 0")) return "b0";
  if (d.includes("brita 2")) return "b2";
  if (d.includes("pó de pedra") || d.includes("po de pedra")) return "pp";
  if (d.includes("areia")) return "aq";
  if (d.includes("brita") || d.includes("pedra")) return "b1";
  return "outro";
}

/** Mapeia uma linha da fonte (tb_notas_fiscais_nfes) para os campos da NF. */
function mapearNF(r: Record<string, unknown>) {
  const xml = String(r.XML_NF ?? "");
  const desc = one(xml, "xProd") ?? "";
  const qtd = all(xml, "qCom").reduce((s, q) => s + (num(q) ?? 0), 0) || num(String(r.PESO_LIQUIDO ?? ""));
  const vProd = all(xml, "vProd");
  // O último <vProd> dentro de ICMSTot é o total; senão soma itens.
  const totalProd =
    num(vProd[vProd.length - 1]) ?? all(xml, "vProd").reduce((s, v) => s + (num(v) ?? 0), 0);
  return {
    numero_nf: r.NUMERO_DOC_ORIG != null ? String(r.NUMERO_DOC_ORIG) : null,
    serie: one(xml, "serie"),
    chave_acesso: r.DECHAVE ? String(r.DECHAVE) : null,
    data_emissao: r.DATA_EMISSAO_ORIG ? String(r.DATA_EMISSAO_ORIG).slice(0, 10) : null,
    cfop: one(xml, "CFOP"),
    natureza_op: one(xml, "natOp"),
    produto_desc: desc || null,
    produto_ncm: one(xml, "NCM"),
    produto_codigo: one(xml, "cProd"),
    produto_tipo: classificaProduto(desc),
    quantidade_ton: qtd,
    valor_unitario: num(one(xml, "vUnCom")),
    valor_total: totalProd,
    valor_total_nota: num(one(xml, "vNF")),
    frete_por_conta: r.TIPO_FRETE_ORIG ? String(r.TIPO_FRETE_ORIG) : null,
    frete_pagar: num(String(r.VR_FRETE_PAGAR ?? "")),
    frete_valor: num(String(r.FRETE_CLIENTE ?? "")),
    transportador_nome: r.TRANNOME ? String(r.TRANNOME) : null,
    transportador: r.TRANNOME ? String(r.TRANNOME) : null,
    transportador_doc: r.TRANCNPJ ? String(r.TRANCNPJ) : null,
    motorista_nome: r.MOTNOME ? String(r.MOTNOME) : null,
    placa_veiculo: r.PLACA_VEICULO_ORIG ? String(r.PLACA_VEICULO_ORIG) : null,
    peso_bruto: num(String(r.PESO_BRUTO ?? "")),
    peso_liquido: num(String(r.PESO_LIQUIDO ?? "")),
    peso_tara: num(String(r.PESO_TARA ?? "")),
    tipo_veiculo: r.TIPO_VEICULO ? String(r.TIPO_VEICULO) : null,
    hora_entrada: r.HORA_ENTRADA ? String(r.HORA_ENTRADA) : null,
    hora_saida: r.HORA_SAIDA ? String(r.HORA_SAIDA) : null,
    ciot: r.CIOTNUMERO ? String(r.CIOTNUMERO) : null,
    ciot_status: r.STATUS_CIOT ? String(r.STATUS_CIOT) : null,
    num_pedido: r.NFPED != null ? String(r.NFPED) : null,
    status_origem: r.STATUS_DOC_ORIGEM ? String(r.STATUS_DOC_ORIGEM) : null,
    cidade_origem: r.CIDADE_ORIG ? String(r.CIDADE_ORIG) : null,
    end_entrega: r.END_ENTREGA ? String(r.END_ENTREGA) : null,
    externo_id: r.ID_NF != null ? String(r.ID_NF) : null,
    xml_nf: xml || null,
    especie_carga: one(xml, "esp"),
  };
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: fonte } = await supabase.from("fontes_dados").select("*").eq("id", params.id).maybeSingle();
  if (!fonte) return NextResponse.json({ error: "Fonte não encontrada." }, { status: 404 });

  // Cache de empresas por CNPJ (find-or-create) para não repetir consultas.
  const cacheEmpresa = new Map<string, string | null>();
  async function empresaId(cnpj: string, razao: string, papel: "eh_produtor" | "eh_cliente"): Promise<string | null> {
    const dig = (cnpj || "").replace(/\D/g, "");
    if (dig.length < 11) return null;
    const ck = `${dig}:${papel}`;
    if (cacheEmpresa.has(ck)) return cacheEmpresa.get(ck)!;
    const { data: achado } = await supabase.rpc("empresa_id_por_cnpj", { p_cnpj: dig });
    let id = (achado as string | null) ?? null;
    if (id) {
      await supabase.from("empresas").update({ [papel]: true }).eq("id", id);
    } else {
      const { data: novo } = await supabase
        .from("empresas")
        .insert({ razao_social: razao || "(sem nome)", cnpj, [papel]: true })
        .select("id")
        .single();
      id = novo?.id ?? null;
    }
    cacheEmpresa.set(ck, id);
    return id;
  }

  // Busca todas as linhas da fonte externa (paginado).
  const base = `${fonte.url}/rest/v1/${fonte.tabela}`;
  const headers = { apikey: fonte.anon_key as string, Authorization: `Bearer ${fonte.anon_key}` };
  let offset = 0;
  const lote = 500;
  let criadas = 0, atualizadas = 0, erros = 0, total = 0;

  try {
    for (;;) {
      const res = await fetch(`${base}?select=*&order=id.asc&limit=${lote}&offset=${offset}`, { headers });
      if (!res.ok) throw new Error(`Fonte ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const linhas = (await res.json()) as Record<string, unknown>[];
      if (!linhas.length) break;
      total += linhas.length;

      for (const r of linhas) {
        try {
          const m = mapearNF(r);
          const emissor_id = await empresaId(String(r.CNPJ_DOC_ORIG ?? ""), String(r.RAZAO_SOCIAL_DOC_ORIG ?? ""), "eh_produtor");
          const cliente_id = await empresaId(String(r.CNPJ_CPF_CLIENTE_ORIG ?? ""), String(r.RAZAO_SOCIAL_CLIENTE_ORIG ?? ""), "eh_cliente");
          if (!emissor_id) { erros++; continue; }
          const payload = { ...m, emissor_id, cliente_id, fonte_id: fonte.id };

          // Dedup por chave de acesso.
          let existenteId: string | null = null;
          if (m.chave_acesso) {
            const { data: ex } = await supabase.from("notas_fiscais").select("id").eq("chave_acesso", m.chave_acesso).maybeSingle();
            existenteId = ex?.id ?? null;
          }
          if (existenteId) {
            await supabase.from("notas_fiscais").update(payload).eq("id", existenteId);
            atualizadas++;
          } else {
            const { error } = await supabase.from("notas_fiscais").insert(payload);
            if (error) { erros++; } else { criadas++; }
          }
        } catch {
          erros++;
        }
      }
      if (linhas.length < lote) break;
      offset += lote;
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha na sincronização." }, { status: 502 });
  }

  const resultado = { total, criadas, atualizadas, erros, em: new Date().toISOString() };
  await supabase.from("fontes_dados").update({ ultima_sync: resultado.em, ultimo_resultado: resultado }).eq("id", fonte.id);
  return NextResponse.json(resultado);
}
