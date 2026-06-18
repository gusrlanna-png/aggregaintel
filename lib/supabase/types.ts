/**
 * Tipos das entidades do banco (Supabase / PostgreSQL).
 * Espelham as migrations 001–005. Quando houver um projeto Supabase ativo,
 * substitua/complemente com: supabase gen types typescript --linked > lib/supabase/database.types.ts
 */

export interface Emissor {
  id: string;
  razao_social: string;
  cnpj: string | null;
  inscricao_est: string | null;
  logradouro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  lat: number | null;
  lng: number | null;
  fone: string | null;
  tipo: string | null; // concorrente | fornecedor | ambos
  produtos: Record<string, boolean> | null;
  capacidade_ton_mes: number | null;
  status_legal: string | null; // ativo | rec_judicial | falido | inativo
  grupo_economico: string | null;
  eh_mbv: boolean | null; // marca "nossa empresa" (MBV)
  notas: string | null;
  // Cadastro estendido (Receita Federal/BrasilAPI)
  data_fundacao?: string | null;
  situacao_cadastral?: string | null;
  atividade_principal?: string | null;
  capital_social?: number | null;
  natureza_juridica?: string | null;
  matriz_filial?: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ClienteContato {
  nome: string;
  cargo?: string | null;
  fone?: string | null;
  email?: string | null;
}

export interface Cliente {
  id: string;
  razao_social: string;
  fantasia?: string | null;
  cnpj: string | null;
  cpf: string | null;
  segmento: string; // concreto | asfalto | premoldado | varejo | outro
  logradouro: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  lat: number | null;
  lng: number | null;
  fone: string | null;
  transportadora?: string | null;
  contato_nome: string | null; // legado (1 contato)
  contatos: ClienteContato[] | null; // contatos da empresa (à parte)
  grupo_economico: string | null; // vinculado por raiz de CNPJ ou manual
  status: string | null;
  notas: string | null;
  // Carteira / categorização
  porte?: string | null; // P | M | G
  regiao_id?: string | null;
  dono_vendedor_id?: string | null; // override individual de vendedor
  status_validacao?: string | null; // validado | pendente
  cliente_principal_id?: string | null; // obra/secundário vinculado a um principal
  criado_em: string;
  atualizado_em: string;
}

export interface NotaFiscal {
  id: string;
  emissor_id: string | null;
  cliente_id: string | null;
  numero_nf: number;
  serie: string | null;
  chave_acesso: string | null;
  data_emissao: string;
  hora_saida: string | null;
  protocolo_sefaz: string | null;
  cfop: string | null;
  natureza_op: string | null;
  produto_desc: string | null;
  produto_ncm: string | null;
  produto_codigo: string | null;
  produto_tipo: string | null;
  quantidade_ton: number;
  valor_unitario: number | null;
  valor_total: number | null;
  valor_total_nota: number | null;
  desconto: number | null;
  icms_base: number | null;
  icms_valor: number | null;
  icms_aliquota: number | null;
  icms_isento: boolean | null;
  icms_fundamento: string | null;
  ipi_valor: number | null;
  pis_valor: number | null;
  cofins_valor: number | null;
  frete_por_conta: string | null;
  codigo_antt: string | null;
  frete_valor: number | null;
  distancia_km: number | null;
  transportador: string | null;
  transportador_doc: string | null;
  transportador_ie: string | null;
  placa_veiculo: string | null;
  uf_veiculo: string | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  especie_carga: string | null;
  motorista_nome: string | null;
  arquivo_url: string | null;
  ocr_raw: unknown | null;
  ocr_confianca: number | null;
  revisado: boolean | null;
  revisado_por: string | null;
  revisado_em: string | null;
  desconsiderada: boolean | null;
  dados_adicionais: string | null;
  motorista_cpf: string | null;
  pedido_ref: string | null;
  criado_em: string;
  // joins opcionais
  emissor?: Pick<Emissor, "id" | "razao_social" | "municipio"> | null;
  cliente?: Pick<Cliente, "id" | "razao_social" | "segmento"> | null;
}

export interface NFSerie {
  id: string;
  emissor_id: string;
  serie: string | null;
  nf_min: number | null;
  nf_max: number | null;
  count_obs: number;
  ultima_data: string | null;
}

export interface NFProjecao {
  id: string;
  emissor_id: string | null;
  serie: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  nf_inicio: number | null;
  nf_fim: number | null;
  delta_nf: number | null;
  fator_cobertura: number | null;
  peso_medio_ton: number | null;
  peso_medio_fonte: string | null;
  volume_est_min: number | null;
  volume_est_med: number | null;
  volume_est_max: number | null;
  ic_pct: number | null;
  produto_tipo: string | null;
  notas: string | null;
  criado_em: string;
}

export interface TracoConsumo {
  id: string;
  cliente_id: string;
  segmento: string;
  subtipo: string | null;
  periodo_tipo: string; // macro | ano | mes
  periodo_ref: string | null;
  producao_volume: number | null;
  producao_unit: string | null; // m3 | t | unid | cargas
  traco_kg: Record<string, number>;
  caminhao_tipo: string | null;
  caminhao_peso_t: number | null;
  notas: string | null;
  criado_por: string | null;
  criado_em: string;
}

export interface FornecedorMix {
  id: string;
  traco_id: string;
  emissor_id: string | null;
  nome_fornecedor: string | null;
  produto_tipo: string;
  share_pct: number;
  periodo_tipo: string | null;
  periodo_ref: string | null;
}

export interface CfemAnm {
  id: string;
  emissor_id: string | null;
  cnpj_titular: string | null;
  razao_titular: string | null;
  municipio: string | null;
  uf: string | null;
  substancia: string | null;
  ncm: string | null;
  cfem_acumulado: number | null;
  n_recolhimentos: number | null;
  cfem_ultimo: number | null;
  mes_ano_ref: string | null;
  data_captura: string | null;
  fonte: string | null;
}

export interface InteligenciaMercado {
  id: string;
  tipo_fonte: string; // whatsapp | manual | nf | anm | outro
  conteudo_raw: string | null;
  emissor_id: string | null;
  cliente_id: string | null;
  classificacao: string | null; // preco | volume | concorrente | cliente | alerta | outro
  confianca: string | null; // alta | media | baixa
  data_info: string | null;
  texto_extraido: string | null;
  valor_num: number | null;
  unidade: string | null;
  tags: string[] | null;
  importante: boolean | null; // marcação de destaque
  is_sintese: boolean | null; // síntese gerada por IA
  cliente_nome: string | null; // nome do cliente/empresa quando não vinculado a um id
  criado_em: string;
}

export interface Produto {
  id: string;
  nome: string; // nome canônico do produto
  tipo: string; // produto_tipo (b0|b1|b2|bg|ai|aq|pp|outro)
  aliases: string[]; // nomes equivalentes (mesclados), ex.: variações nas NFs
  origem: string | null; // nf | manual
  criado_em: string;
}

export interface MarketShareSnapshot {
  id: string;
  mes_ref: string;
  produto_tipo: string;
  regiao: string | null;
  mbv_volume_ton: number | null;
  mercado_total_ton: number | null;
  mbv_share_pct: number | null;
  metodologia: string | null;
  criado_em: string;
}
