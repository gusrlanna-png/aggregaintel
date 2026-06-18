import { DuplicateNFError, saveNF, updateNF } from "@/lib/supabase/nf";
import { findOrCreateEmissor } from "@/lib/supabase/emissores";
import { findOrCreateCliente } from "@/lib/supabase/clientes";
import { uploadNF } from "@/lib/supabase/storage";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { compressImageForStorage } from "./image-compress";
import { isValidCNPJ } from "./masks";
import type { NFFormValues } from "./ocr-map";

export type SaveNFStatus =
  | "saved"
  | "updated"
  | "duplicate"
  | "invalid"
  | "error";

export interface SaveNFResult {
  status: SaveNFStatus;
  message?: string;
  /** Em caso de duplicidade: id e estado da NF já cadastrada. */
  existingId?: string;
  existingDesconsiderada?: boolean;
}

export function validarNF(form: NFFormValues): string | null {
  if (!form.numero_nf) return "Número da NF é obrigatório.";
  if (!form.data_emissao) return "Data de emissão é obrigatória.";
  if (!form.quantidade_ton || Number(form.quantidade_ton) <= 0)
    return "Quantidade (t) é obrigatória.";
  if (!form.produto_tipo) return "Tipo de produto é obrigatório.";
  return null;
}

/**
 * Salva (ou atualiza) uma NF a partir dos valores do formulário, criando/
 * vinculando o produtor (Mercado) e o cliente (Clientes). Centraliza a lógica
 * usada tanto no formulário individual quanto no "Salvar todas" do lote.
 */
export async function saveNFFromForm(
  form: NFFormValues,
  opts: {
    nfId?: string;
    emissorId?: string | null;
    clienteId?: string | null;
    /** Arquivo original (foto/PDF) da NF — salvo no storage para consulta. */
    arquivoFile?: File | null;
  } = {}
): Promise<SaveNFResult> {
  const err = validarNF(form);
  if (err) return { status: "invalid", message: err };

  // Produtor obrigatório ao CRIAR uma NF: precisa de um emissor vinculado OU
  // razão social + CNPJ válido (para cadastrar o produtor automaticamente).
  if (!opts.nfId && !opts.emissorId) {
    if (!form.emissor_razao?.trim() || !isValidCNPJ(form.emissor_cnpj)) {
      return {
        status: "invalid",
        message:
          "Produtor não cadastrado: selecione um produtor ou informe CNPJ válido + razão social.",
      };
    }
  }

  try {
    let emissor_id = opts.emissorId ?? undefined;
    if (!emissor_id && form.emissor_razao) {
      emissor_id =
        (await findOrCreateEmissor({
          razao_social: form.emissor_razao,
          cnpj: form.emissor_cnpj,
          logradouro: form.emissor_logradouro,
          municipio: form.emissor_municipio,
          uf: form.emissor_uf,
          cep: form.emissor_cep,
          fone: form.emissor_fone,
        })) ?? undefined;
    }
    let cliente_id = opts.clienteId ?? undefined;
    if (!cliente_id && form.cliente_nome) {
      cliente_id =
        (await findOrCreateCliente({
          razao_social: form.cliente_nome,
          doc: form.cliente_doc,
          logradouro: form.cliente_logradouro,
          bairro: form.cliente_bairro,
          municipio: form.cliente_municipio,
          uf: form.cliente_uf,
          cep: form.cliente_cep,
        })) ?? undefined;
    }

    const payload = {
      emissor_id,
      cliente_id,
      numero_nf: Number(form.numero_nf),
      serie: form.serie || null,
      // Chave de acesso só com dígitos (DANFE costuma vir com espaços).
      chave_acesso: (form.chave_acesso || "").replace(/\D/g, "") || null,
      data_emissao: form.data_emissao,
      hora_saida: form.hora_saida || null,
      cfop: form.cfop || null,
      natureza_op: form.natureza_op || null,
      produto_desc: form.produto_desc || null,
      produto_ncm: form.produto_ncm || null,
      produto_codigo: form.produto_codigo || null,
      produto_tipo: form.produto_tipo || null,
      quantidade_ton: Number(form.quantidade_ton),
      valor_unitario: form.valor_unitario ? Number(form.valor_unitario) : null,
      valor_total: form.valor_total ? Number(form.valor_total) : null,
      valor_total_nota: form.valor_total_nota ? Number(form.valor_total_nota) : null,
      icms_valor: form.icms_valor ? Number(form.icms_valor) : 0,
      icms_isento: form.icms_isento,
      icms_fundamento: form.icms_fundamento || null,
      frete_por_conta: form.frete_por_conta || null,
      codigo_antt: form.codigo_antt || null,
      frete_valor: form.frete_valor ? Number(form.frete_valor) : 0,
      distancia_km: form.distancia_km ? Number(form.distancia_km) : null,
      transportador: form.transportador || null,
      transportador_doc: form.transportador_doc || null,
      transportador_ie: form.transportador_ie || null,
      placa_veiculo: form.placa_veiculo || null,
      uf_veiculo: form.uf_veiculo || null,
      peso_bruto: form.peso_bruto ? Number(form.peso_bruto) : null,
      peso_liquido: form.peso_liquido ? Number(form.peso_liquido) : null,
      especie_carga: form.especie_carga || null,
      motorista_nome: form.motorista_nome || null,
      dados_adicionais: form.dados_adicionais || null,
      ocr_confianca: form.ocr_confianca,
      revisado: true,
    };

    if (opts.nfId) {
      await updateNF(opts.nfId, payload);
      await anexarArquivo(opts.nfId, opts.arquivoFile);
      return { status: "updated" };
    }
    const nf = await saveNF(payload);
    await anexarArquivo(nf.id, opts.arquivoFile);
    return { status: "saved" };
  } catch (e) {
    if (e instanceof DuplicateNFError) {
      return {
        status: "duplicate",
        message: `NF ${e.existing.numero_nf} já cadastrada`,
        existingId: e.existing.id,
        existingDesconsiderada: Boolean(e.existing.desconsiderada),
      };
    }
    return {
      status: "error",
      message: e instanceof Error ? e.message : "Erro ao salvar.",
    };
  }
}

/**
 * Comprime e envia o arquivo da NF ao storage, gravando o caminho em
 * `arquivo_url`. Tolerante a falhas: se o upload falhar, a NF já está salva e
 * apenas a imagem deixa de ser anexada (não interrompe o fluxo).
 */
async function anexarArquivo(nfId: string, file?: File | null): Promise<void> {
  if (!file || !isSupabaseConfigured()) return;
  try {
    const comprimido = await compressImageForStorage(file);
    const path = await uploadNF(comprimido, nfId);
    await updateNF(nfId, { arquivo_url: path });
  } catch {
    // imagem é complementar — não falha o salvamento da NF
  }
}
