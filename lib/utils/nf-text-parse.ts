import { emptyForm, classificaProduto, type NFFormValues } from "./ocr-map";

/**
 * Extrai, de forma heurística, os campos de uma NF a partir do texto bruto do
 * OCR/PDF. Cobre rótulos padrão da DANFE. Para extração completa e confiável
 * (sobretudo em PDFs escaneados), use a IA (GEMINI_API_KEY) — esta função é o
 * fallback gratuito sem chave.
 */
export function parseNFText(raw: string): NFFormValues {
  const form = emptyForm();
  const text = raw.replace(/ /g, " ");
  const flat = text.replace(/\s+/g, " ");
  const semEspaco = text.replace(/\s+/g, "");

  const pick = (re: RegExp): string => {
    const m = flat.match(re);
    return m ? m[1].trim() : "";
  };

  // ── NF ────────────────────────────────────────────────────────────────
  const chave = semEspaco.match(/\d{44}/);
  if (chave) form.chave_acesso = chave[0];

  form.numero_nf =
    pick(/N[ºo°.\s]*\s*0*([\d][\d.]{2,})/i).replace(/\./g, "") ||
    pick(/n[uú]mero[:\s]*0*([\d][\d.]{2,})/i).replace(/\./g, "");

  // Série (ex.: "SÉRIE 001")
  form.serie = pick(/s[ée]rie\s*[:.\-]?\s*0*([\dA-Z]{1,3})/i);

  // Data de emissão (aceita separadores / . -)
  {
    const d =
      flat.match(
        /(?:emiss[ãa]o|data\s+de\s+emiss[ãa]o)[^\d]{0,12}(\d{2})[/.\-](\d{2})[/.\-](\d{4})/i
      ) || flat.match(/(\d{2})[/.\-](\d{2})[/.\-](\d{4})/);
    if (d) form.data_emissao = `${d[3]}-${d[2]}-${d[1]}`;
  }

  // Hora de saída
  form.hora_saida = pick(
    /hora\s+(?:da\s+)?sa[ií]da[:\s]*?(\d{1,2}:\d{2}(?::\d{2})?)/i
  );

  // CFOP (4 dígitos)
  form.cfop = pick(/cfop[:\s]*?(\d{3,4})/i);

  // Natureza da operação
  form.natureza_op = pick(
    /natureza\s+da?\s*opera[çc][ãa]o[:\s]*?([A-Za-zÀ-ú][A-Za-zÀ-ú .,\/-]{3,60})/i
  );

  // ── Emissor / Destinatário ──────────────────────────────────────────────
  // Empresas com sufixo societário (1ª = emissor; 2ª = destinatário, se houver)
  const empresas = flat.match(
    /[A-ZÀ-Ú][A-Za-zÀ-ú0-9 .&'\-]{4,60}?\s(?:LTDA|S\/A|S\.A\.?|EIRELI|ME|EPP|MEI)\b/g
  );
  if (empresas && empresas[0]) form.emissor_razao = empresas[0].trim();
  if (empresas && empresas[1]) form.cliente_nome = empresas[1].trim();

  // Nome/Razão social do destinatário (rótulo explícito tem prioridade)
  const dest = pick(
    /nome\s*\/?\s*raz[ãa]o\s+social[:\s]*?([A-Za-zÀ-ú][A-Za-zÀ-ú0-9 .&'\-]{3,60})/i
  );
  if (dest) form.cliente_nome = dest;

  // CNPJs (1º = emissor; 2º = destinatário)
  const cnpjs = flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g);
  if (cnpjs && cnpjs[0]) form.emissor_cnpj = cnpjs[0];
  if (cnpjs && cnpjs[1]) form.cliente_doc = cnpjs[1];
  // CPF do destinatário, se houver
  const cpf = flat.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
  if (cpf && !form.cliente_doc) form.cliente_doc = cpf[0];

  // Município / UF
  const muni = flat.match(
    /munic[ií]pio[:\s]*?([A-Za-zÀ-ú][A-Za-zÀ-ú .'\-]{2,40}?)\s+(?:UF|[A-Z]{2}\b)/i
  );
  if (muni) form.emissor_municipio = muni[1].trim();
  const uf = flat.match(/\bUF[:\s]*?([A-Z]{2})\b/);
  if (uf) form.emissor_uf = uf[1];

  // ── Produto ─────────────────────────────────────────────────────────────
  const prod = flat.match(
    /(brita\s*\d?|brita\s*graduada|areia[^\n]{0,18}|p[óo]\s*de\s*pedra|pedrisco|bica\s*corrida|rachã?o)/i
  );
  if (prod) {
    form.produto_desc = prod[1].trim();
    form.produto_tipo = classificaProduto(prod[1]);
  }
  form.produto_ncm = pick(/ncm[:\s]*?(\d{4}\.?\d{2}\.?\d{2})/i);

  // Quantidade (t) e valores
  const qtd = pick(/(?:qtde?|quantidade)[:\s]*?([\d.]+,\d{1,4})/i);
  if (qtd) form.quantidade_ton = qtd.replace(/\./g, "").replace(",", ".");

  const vUnit = pick(/(?:valor\s+unit|vl?\.?\s*unit[áa]rio)[:\s]*?([\d.]+,\d{2,4})/i);
  if (vUnit) form.valor_unitario = vUnit.replace(/\./g, "").replace(",", ".");

  const vTotal =
    pick(/valor\s+total\s+da\s+nota[:\s]*?([\d.]+,\d{2})/i) ||
    pick(/v(?:alor)?\.?\s*total[:\s]*?([\d.]+,\d{2})/i);
  if (vTotal) form.valor_total = vTotal.replace(/\./g, "").replace(",", ".");

  // ── Transporte ──────────────────────────────────────────────────────────
  const placa = flat.match(/\b([A-Z]{3}[-\s]?\d[A-Z0-9]\d{2})\b/);
  if (placa) form.placa_veiculo = placa[1].replace(/[-\s]/g, "");
  form.frete_valor =
    pick(/valor\s+do\s+frete[:\s]*?([\d.]+,\d{2})/i).replace(/\./g, "").replace(",", ".") ||
    form.frete_valor;
  const fretePor = flat.match(/frete\s+por\s+conta[:\s]*?(\d|emitente|destinat[áa]rio)/i);
  if (fretePor) form.frete_por_conta = fretePor[1];

  form.ocr_confianca = 0.3; // OCR/heurística: confiança baixa, exige revisão
  return form;
}
