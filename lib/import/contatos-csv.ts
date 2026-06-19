"use client";

/**
 * Parser de CSV de contatos (Google Contacts, WhatsApp/celular exportado, ou
 * genérico nome/telefone/email). Roda no browser. Detecta as colunas por
 * cabeçalho e agrega telefones/e-mails numerados (ex.: "Phone 1 - Value").
 */
export interface ContatoCsv {
  nome: string;
  fones: string[];
  emails: string[];
  empresa: string | null;
  cargo: string | null;
}

/** Divide uma linha CSV respeitando aspas. */
function parseLinha(linha: string): string[] {
  const out: string[] = [];
  let cur = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') {
        cur += '"';
        i++;
      } else aspas = !aspas;
    } else if (ch === "," && !aspas) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Quebra o conteúdo em linhas lógicas (respeita quebras dentro de aspas). */
function quebrarLinhas(txt: string): string[] {
  const linhas: string[] = [];
  let cur = "";
  let aspas = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (ch === '"') aspas = !aspas;
    if ((ch === "\n" || ch === "\r") && !aspas) {
      if (ch === "\r" && txt[i + 1] === "\n") i++;
      if (cur.trim()) linhas.push(cur);
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) linhas.push(cur);
  return linhas;
}

const acha = (cols: string[], ...termos: string[]): number =>
  cols.findIndex((c) => termos.some((t) => c.toLowerCase().includes(t)));

export function parseContatosCsv(texto: string): ContatoCsv[] {
  const linhas = quebrarLinhas(texto);
  if (linhas.length < 2) return [];
  const header = parseLinha(linhas[0]).map((h) => h.toLowerCase());

  // Colunas de telefone/email podem ser numeradas (Google: "Phone 1 - Value").
  const idxFones = header
    .map((h, i) => (/(phone|telefone|fone|celular|whats|mobile).*value|^(telefone|fone|celular|whatsapp|phone)$/.test(h) ? i : -1))
    .filter((i) => i >= 0);
  const idxEmails = header
    .map((h, i) => (/(e-?mail).*value|^e-?mail$/.test(h) ? i : -1))
    .filter((i) => i >= 0);

  const idxNome = acha(header, "name", "nome", "first name");
  const idxSobrenome = acha(header, "last name", "sobrenome", "family name");
  const idxEmpresa = acha(header, "organization name", "organization", "empresa", "company");
  const idxCargo = acha(header, "organization title", "title", "cargo", "job");

  const limparFone = (v: string) => v.replace(/[^\d+]/g, "");
  const out: ContatoCsv[] = [];

  for (let r = 1; r < linhas.length; r++) {
    const cols = parseLinha(linhas[r]);
    if (cols.every((c) => !c)) continue;

    let nome = idxNome >= 0 ? cols[idxNome] ?? "" : "";
    if (idxSobrenome >= 0 && cols[idxSobrenome]) nome = `${nome} ${cols[idxSobrenome]}`.trim();
    // Google às vezes separa telefones/emails dentro de uma célula por " ::: "
    const fones = (
      idxFones.length
        ? idxFones.flatMap((i) => (cols[i] ?? "").split(/[:;]{2,}|\s:::\s/))
        : []
    )
      .map(limparFone)
      .filter((v) => v.length >= 8);
    const emails = (
      idxEmails.length
        ? idxEmails.flatMap((i) => (cols[i] ?? "").split(/[:;]{2,}|\s:::\s/))
        : []
    )
      .map((v) => v.trim().toLowerCase())
      .filter((v) => /.+@.+\..+/.test(v));

    nome = nome.trim();
    if (!nome && emails[0]) nome = emails[0];
    if (!nome && fones[0]) nome = fones[0];
    if (!nome) continue;

    out.push({
      nome,
      fones: [...new Set(fones)],
      emails: [...new Set(emails)],
      empresa: idxEmpresa >= 0 ? cols[idxEmpresa]?.trim() || null : null,
      cargo: idxCargo >= 0 ? cols[idxCargo]?.trim() || null : null,
    });
  }
  return out;
}
