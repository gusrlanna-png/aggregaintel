import type { OCRResult } from "@/lib/claude/client";
import type { ProdutoTipo } from "./agregados";

export interface NFFormValues {
  // Emissor
  emissor_razao: string;
  emissor_cnpj: string;
  emissor_logradouro: string;
  emissor_municipio: string;
  emissor_uf: string;
  emissor_cep: string;
  emissor_fone: string;
  // Destinatário / cliente
  cliente_nome: string;
  cliente_doc: string;
  cliente_logradouro: string;
  cliente_bairro: string;
  cliente_municipio: string;
  cliente_uf: string;
  cliente_cep: string;
  // NF
  numero_nf: string;
  serie: string;
  chave_acesso: string;
  data_emissao: string;
  hora_saida: string;
  cfop: string;
  natureza_op: string;
  // Produto
  produto_desc: string;
  produto_ncm: string;
  produto_codigo: string;
  produto_tipo: ProdutoTipo | "";
  quantidade_ton: string;
  valor_unitario: string;
  valor_total: string;
  // Impostos
  icms_valor: string;
  icms_isento: boolean;
  icms_fundamento: string;
  // Transporte
  frete_por_conta: string;
  frete_valor: string;
  distancia_km: string;
  transportador: string;
  placa_veiculo: string;
  uf_veiculo: string;
  peso_bruto: string;
  peso_liquido: string;
  especie_carga: string;
  // Extra
  dados_adicionais: string;
  ocr_confianca: number;
}

const s = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v);

/** Mantém só dígitos e remove zeros à esquerda (ex.: "000.025.223" -> "25223"). */
const soDigitos = (v: unknown): string =>
  s(v).replace(/\D/g, "").replace(/^0+/, "");

/** Heurística para classificar o tipo de produto a partir da descrição/NCM. */
export function classificaProduto(desc?: string | null): ProdutoTipo | "" {
  if (!desc) return "";
  const d = desc.toLowerCase();
  if (d.includes("graduada") || d.includes("bgs")) return "bg";
  if (d.includes("brita 0") || d.includes("pedrisco")) return "b0";
  if (d.includes("brita 1") || d === "brita") return "b1";
  if (d.includes("brita 2")) return "b2";
  if (d.includes("pó de pedra") || d.includes("po de pedra")) return "pp";
  if (d.includes("areia indust") || d.includes("areia de brita")) return "ai";
  if (d.includes("areia")) return "aq";
  if (d.includes("brita")) return "b1";
  return "outro";
}

export function ocrToForm(ocr: OCRResult): NFFormValues {
  return {
    emissor_razao: s(ocr.emissor?.razao_social),
    emissor_cnpj: s(ocr.emissor?.cnpj),
    emissor_logradouro: s(ocr.emissor?.logradouro),
    emissor_municipio: s(ocr.emissor?.municipio),
    emissor_uf: s(ocr.emissor?.uf),
    emissor_cep: s(ocr.emissor?.cep),
    emissor_fone: s(ocr.emissor?.fone),
    cliente_nome: s(ocr.destinatario?.nome),
    cliente_doc: s(ocr.destinatario?.cnpj_cpf),
    cliente_logradouro: s(ocr.destinatario?.logradouro),
    cliente_bairro: s(ocr.destinatario?.bairro),
    cliente_municipio: s(ocr.destinatario?.municipio),
    cliente_uf: s(ocr.destinatario?.uf),
    cliente_cep: s(ocr.destinatario?.cep),
    numero_nf: soDigitos(ocr.nf?.numero),
    serie: s(ocr.nf?.serie),
    chave_acesso: s(ocr.nf?.chave_acesso),
    data_emissao: normalizeDate(s(ocr.nf?.data_emissao)),
    hora_saida: s(ocr.nf?.hora_saida),
    cfop: s(ocr.nf?.cfop),
    natureza_op: s(ocr.nf?.natureza_operacao),
    produto_desc: s(ocr.produto?.descricao),
    produto_ncm: s(ocr.produto?.ncm),
    produto_codigo: s(ocr.produto?.codigo),
    produto_tipo: classificaProduto(s(ocr.produto?.descricao)),
    quantidade_ton: s(ocr.produto?.quantidade_ton),
    valor_unitario: s(ocr.produto?.valor_unitario),
    valor_total: s(ocr.produto?.valor_total),
    icms_valor: s(ocr.impostos?.icms_valor),
    icms_isento: Boolean(ocr.impostos?.icms_isento),
    icms_fundamento: s(ocr.impostos?.icms_fundamento),
    frete_por_conta: s(ocr.transporte?.frete_por_conta),
    frete_valor: s(ocr.transporte?.frete_valor),
    distancia_km: "",
    transportador: s(ocr.transporte?.transportador_nome),
    placa_veiculo: s(ocr.transporte?.placa_veiculo),
    uf_veiculo: s(ocr.transporte?.uf_veiculo),
    peso_bruto: s(ocr.transporte?.peso_bruto_ton),
    peso_liquido: s(ocr.transporte?.peso_liquido_ton),
    especie_carga: s(ocr.transporte?.especie_carga),
    dados_adicionais: s(ocr.dados_adicionais),
    ocr_confianca:
      typeof ocr.confianca_ocr === "number" ? ocr.confianca_ocr : 0,
  };
}

export function emptyForm(): NFFormValues {
  return ocrToForm({
    emissor: {},
    destinatario: {},
    nf: {},
    produto: {},
    impostos: {},
    transporte: {},
    dados_adicionais: null,
    motorista_cpf: null,
    pedido_ref: null,
    confianca_ocr: 0,
  });
}

/** Converte uma NotaFiscal salva em valores de formulário (modo edição). */
export function nfToForm(nf: import("@/lib/supabase/types").NotaFiscal): NFFormValues {
  const ns = (v: unknown): string =>
    v === null || v === undefined ? "" : String(v);
  return {
    emissor_razao: ns(nf.emissor?.razao_social),
    emissor_cnpj: "",
    emissor_logradouro: "",
    emissor_municipio: ns(nf.emissor?.municipio),
    emissor_uf: "",
    emissor_cep: "",
    emissor_fone: "",
    cliente_nome: ns(nf.cliente?.razao_social),
    cliente_doc: "",
    cliente_logradouro: "",
    cliente_bairro: "",
    cliente_municipio: "",
    cliente_uf: "",
    cliente_cep: "",
    numero_nf: ns(nf.numero_nf),
    serie: ns(nf.serie),
    chave_acesso: ns(nf.chave_acesso),
    data_emissao: ns(nf.data_emissao).slice(0, 10),
    hora_saida: ns(nf.hora_saida),
    cfop: ns(nf.cfop),
    natureza_op: ns(nf.natureza_op),
    produto_desc: ns(nf.produto_desc),
    produto_ncm: ns(nf.produto_ncm),
    produto_codigo: ns(nf.produto_codigo),
    produto_tipo: (nf.produto_tipo as NFFormValues["produto_tipo"]) ?? "",
    quantidade_ton: ns(nf.quantidade_ton),
    valor_unitario: ns(nf.valor_unitario),
    valor_total: ns(nf.valor_total),
    icms_valor: ns(nf.icms_valor),
    icms_isento: Boolean(nf.icms_isento),
    icms_fundamento: ns(nf.icms_fundamento),
    frete_por_conta: ns(nf.frete_por_conta),
    frete_valor: ns(nf.frete_valor),
    distancia_km: ns(nf.distancia_km),
    transportador: ns(nf.transportador),
    placa_veiculo: ns(nf.placa_veiculo),
    uf_veiculo: ns(nf.uf_veiculo),
    peso_bruto: ns(nf.peso_bruto),
    peso_liquido: ns(nf.peso_liquido),
    especie_carga: ns(nf.especie_carga),
    dados_adicionais: ns(nf.dados_adicionais),
    ocr_confianca: nf.ocr_confianca ?? 0,
  };
}

/**
 * Converte uma data em vários formatos para aaaa-mm-dd (input date).
 * Aceita separadores / . - e ano com 2 ou 4 dígitos, e ignora hora ao final.
 * Ex.: 04/07/2019 · 03.07.2019 · 03-07-2019 · 2019-07-04 · 04/07/19
 */
function normalizeDate(v: string): string {
  if (!v) return "";
  const t = v.trim();

  // ISO no início: aaaa-mm-dd (ou com . /)
  const iso = t.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  }

  // dd mm aaaa com qualquer separador (/ . -)
  const br = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (br) {
    const yyyy = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${yyyy}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }

  return "";
}
