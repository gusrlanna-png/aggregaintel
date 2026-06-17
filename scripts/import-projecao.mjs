// Importa o CSV de projeção (BI) para a tabela projecao_base.
// Faz login como o usuário admin (env IMP_EMAIL/IMP_PWD) e insere em lotes.
// Uso: CSV_PATH="..." IMP_EMAIL="..." IMP_PWD="..." node scripts/import-projecao.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) || [])[1]?.trim();
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const anon = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const email = process.env.IMP_EMAIL;
const password = process.env.IMP_PWD;
const csvPath = process.env.CSV_PATH;

if (!url || !anon) throw new Error("Supabase URL/ANON ausentes no .env.local");
if (!email || !password) throw new Error("IMP_EMAIL/IMP_PWD ausentes");
if (!csvPath) throw new Error("CSV_PATH ausente");

const sb = createClient(url, anon, { auth: { persistSession: false } });

const num = (v) => {
  const t = (v ?? "").toString().trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const txt = (v) => {
  const t = (v ?? "").toString().trim();
  return t ? t : null;
};

async function main() {
  const { error: authErr } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (authErr) throw new Error("login falhou: " + authErr.message);

  const raw = readFileSync(csvPath, "utf8");
  const linhas = raw.split(/\r?\n/);
  const rows = [];
  for (let i = 1; i < linhas.length; i++) {
    const l = linhas[i];
    if (!l) continue;
    const c = l.split(";");
    if (c.length < 18) continue;
    const cnpj = (c[0] || "").trim();
    if (!cnpj || cnpj.startsWith("---")) continue; // linha de tracinhos
    rows.push({
      cnpj,
      nome: txt(c[1]),
      fantasia: txt(c[2]),
      cnpj_sec: txt(c[3]),
      nome_sec: txt(c[4]),
      fantasia_sec: txt(c[5]),
      segmento: txt(c[6]),
      mes: num(c[7]),
      produto: txt(c[8]),
      grupo: txt(c[9]),
      peso_mes: num(c[10]),
      valor_mes: num(c[11]),
      peso_proj: num(c[12]),
      valor_proj: num(c[13]),
      preco_proj: num(c[14]),
      classe: txt(c[15]),
      cidade: txt(c[16]),
      cidade_sec: txt(c[17]),
      cnpj_digitos: cnpj.replace(/\D/g, ""),
    });
  }
  console.log("Linhas a importar:", rows.length);

  // Limpa antes (re-importação idempotente)
  const { error: delErr } = await sb
    .from("projecao_base")
    .delete()
    .neq("id", 0);
  if (delErr) throw new Error("limpeza falhou: " + delErr.message);

  const B = 500;
  let ok = 0;
  for (let i = 0; i < rows.length; i += B) {
    const batch = rows.slice(i, i + B);
    const { error } = await sb.from("projecao_base").insert(batch);
    if (error) throw new Error(`lote ${i}: ${error.message}`);
    ok += batch.length;
    if (i % 5000 === 0) console.log("  inseridas:", ok);
  }
  console.log("TOTAL inserido:", ok);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
