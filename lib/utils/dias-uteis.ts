/**
 * Dias úteis ponderados (pesos configuráveis em Config → Peso de dias/mês):
 *  - dia de semana (seg–sex) = 1,0 (padrão)
 *  - sábado = 0,5 (padrão)
 *  - domingo e feriado = 0,0 (padrão)
 * Feriados nacionais (fixos + móveis baseados na Páscoa) + feriados extras
 * cadastrados pelo usuário.
 */
import { localGet, localUpsert } from "@/lib/local/store";

export interface CalendarioConfig {
  id: string; // sempre "global"
  pesoSemana: number;
  pesoSabado: number;
  pesoDomingo: number;
  pesoFeriado: number;
  feriadosExtra: string[]; // datas "YYYY-MM-DD"
}

export const CALENDARIO_PADRAO: CalendarioConfig = {
  id: "global",
  pesoSemana: 1,
  pesoSabado: 0.5,
  pesoDomingo: 0,
  pesoFeriado: 0,
  feriadosExtra: [],
};

export function getCalendarioConfig(): CalendarioConfig {
  const row = localGet<CalendarioConfig>("calendario_config", "global");
  return row ? { ...CALENDARIO_PADRAO, ...row, id: "global" } : CALENDARIO_PADRAO;
}

export function setCalendarioConfig(
  patch: Partial<CalendarioConfig>
): CalendarioConfig {
  const novo = { ...getCalendarioConfig(), ...patch, id: "global" };
  localUpsert<CalendarioConfig>("calendario_config", novo);
  return novo;
}

/** Domingo de Páscoa (algoritmo de Meeus/Butcher). Retorna [mes0, dia]. */
function pascoa(year: number): [number, number] {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=março, 4=abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return [mes - 1, dia]; // mês 0-based
}

function key(m0: number, d: number) {
  return `${m0}-${d}`;
}

/** Conjunto de feriados nacionais (datas) do ano, como "mes0-dia". */
export function feriadosNacionais(
  year: number,
  cfg?: CalendarioConfig
): Set<string> {
  const set = new Set<string>();
  // Fixos
  set.add(key(0, 1)); // Confraternização
  set.add(key(3, 21)); // Tiradentes
  set.add(key(4, 1)); // Dia do Trabalho
  set.add(key(8, 7)); // Independência
  set.add(key(9, 12)); // Nossa Senhora Aparecida
  set.add(key(10, 2)); // Finados
  set.add(key(10, 15)); // Proclamação da República
  set.add(key(10, 20)); // Consciência Negra (nacional desde 2024)
  set.add(key(11, 25)); // Natal

  // Móveis a partir da Páscoa
  const [pm, pd] = pascoa(year);
  const easter = new Date(year, pm, pd);
  const addRel = (offsetDias: number) => {
    const dt = new Date(easter);
    dt.setDate(dt.getDate() + offsetDias);
    set.add(key(dt.getMonth(), dt.getDate()));
  };
  addRel(-48); // Carnaval (segunda)
  addRel(-47); // Carnaval (terça)
  addRel(-2); // Sexta-feira Santa
  addRel(60); // Corpus Christi

  // Feriados extras cadastrados pelo usuário (apenas os do ano consultado).
  const c = cfg ?? getCalendarioConfig();
  for (const iso of c.feriadosExtra) {
    const [y, m, d] = iso.split("-").map(Number);
    if (y === year && m >= 1 && m <= 12 && d >= 1 && d <= 31)
      set.add(key(m - 1, d));
  }

  return set;
}

export interface FeriadoInfo {
  iso: string; // "YYYY-MM-DD"
  nome: string;
  tipo: "nacional" | "extra";
}

/** Lista nomeada dos feriados considerados no ano (nacionais + extras). */
export function listarFeriados(
  year: number,
  cfg?: CalendarioConfig
): FeriadoInfo[] {
  const c = cfg ?? getCalendarioConfig();
  const iso = (m0: number, d: number) =>
    `${year}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const lista: FeriadoInfo[] = [];
  const add = (m0: number, d: number, nome: string) =>
    lista.push({ iso: iso(m0, d), nome, tipo: "nacional" });

  // Fixos
  add(0, 1, "Confraternização Universal");
  add(3, 21, "Tiradentes");
  add(4, 1, "Dia do Trabalho");
  add(8, 7, "Independência");
  add(9, 12, "Nossa Senhora Aparecida");
  add(10, 2, "Finados");
  add(10, 15, "Proclamação da República");
  add(10, 20, "Consciência Negra");
  add(11, 25, "Natal");

  // Móveis (a partir da Páscoa)
  const [pm, pd] = pascoa(year);
  const easter = new Date(year, pm, pd);
  const rel = (offset: number, nome: string) => {
    const dt = new Date(easter);
    dt.setDate(dt.getDate() + offset);
    add(dt.getMonth(), dt.getDate(), nome);
  };
  rel(-48, "Carnaval (segunda)");
  rel(-47, "Carnaval (terça)");
  rel(-2, "Sexta-feira Santa");
  rel(60, "Corpus Christi");

  // Extras do usuário (apenas do ano)
  for (const f of c.feriadosExtra) {
    const [y] = f.split("-").map(Number);
    if (y === year) lista.push({ iso: f, nome: "Feriado extra", tipo: "extra" });
  }

  return lista.sort((a, b) => a.iso.localeCompare(b.iso));
}

/** Valor do dia conforme pesos configurados (feriado = 0). */
export function valorDoDia(
  date: Date,
  feriados: Set<string>,
  cfg?: CalendarioConfig
): number {
  const c = cfg ?? getCalendarioConfig();
  if (feriados.has(key(date.getMonth(), date.getDate()))) return c.pesoFeriado;
  const dow = date.getDay(); // 0=domingo, 6=sábado
  if (dow === 0) return c.pesoDomingo;
  if (dow === 6) return c.pesoSabado;
  return c.pesoSemana;
}

/** Dias úteis ponderados de um mês (mes0 = 0..11). */
export function diasUteisMes(year: number, mes0: number): number {
  const cfg = getCalendarioConfig();
  const feriados = feriadosNacionais(year, cfg);
  const ultimo = new Date(year, mes0 + 1, 0).getDate();
  let total = 0;
  for (let d = 1; d <= ultimo; d++) {
    total += valorDoDia(new Date(year, mes0, d), feriados, cfg);
  }
  return +total.toFixed(2);
}

/** Dias úteis ponderados de cada mês do ano (array de 12). */
export function diasUteisAno(year: number): number[] {
  return Array.from({ length: 12 }, (_, m) => diasUteisMes(year, m));
}

/** Total de dias úteis ponderados no ano. */
export function totalDiasUteisAno(year: number): number {
  return +diasUteisAno(year)
    .reduce((s, v) => s + v, 0)
    .toFixed(2);
}
