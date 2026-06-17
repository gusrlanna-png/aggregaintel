/**
 * Motor de projeção de volume por numeração de NF
 * Input: array de NFs capturadas de um emissor + série
 * Output: estimativa de volume produzido no período
 *
 * Conforme Seção 4 — Módulo 2 do documento de planejamento.
 */
import { diasUteisMes } from "./dias-uteis";
import { normalizar } from "./sazonalidade";

export function calcProjecao(params: {
  nfs: { numero: number; data: Date; quantidade_ton: number }[];
  peso_medio_override?: number; // se usuário quiser forçar um peso médio
}) {
  const { nfs, peso_medio_override } = params;
  if (nfs.length < 2) return null; // mínimo 2 pontos para gap

  const sorted = [...nfs].sort((a, b) => a.numero - b.numero);
  const nf_min = sorted[0].numero;
  const nf_max = sorted[sorted.length - 1].numero;
  const delta_nf = nf_max - nf_min;

  const data_min = sorted[0].data;
  const data_max = sorted[sorted.length - 1].data;

  // Fator de cobertura = amostras capturadas / gap total
  const fator_cobertura = nfs.length / delta_nf;

  // Peso médio: usa override ou calcula a partir das NFs com peso declarado
  const peso_medio =
    peso_medio_override ??
    nfs.reduce((s, n) => s + n.quantidade_ton, 0) / nfs.length;

  const volume_est_med = delta_nf * peso_medio;
  const margem = 1 - Math.min(fator_cobertura * 2, 0.9); // 10% a 90%

  return {
    nf_min,
    nf_max,
    delta_nf,
    fator_cobertura: +fator_cobertura.toFixed(4),
    peso_medio_ton: +peso_medio.toFixed(4),
    volume_est_min: +(volume_est_med * (1 - margem)).toFixed(2),
    volume_est_med: +volume_est_med.toFixed(2),
    volume_est_max: +(volume_est_med * (1 + margem)).toFixed(2),
    ic_pct: +(margem * 100).toFixed(2),
    periodo_inicio: data_min,
    periodo_fim: data_max,
  };
}

export type ProjecaoResult = NonNullable<ReturnType<typeof calcProjecao>>;

export interface MesProjecao {
  mes: number; // 1..12
  sazonalidade: number; // fração (0..1)
  diasUteis: number;
  volume: number; // toneladas no mês
  diaria: number; // toneladas por dia útil
}

export interface ProjecaoSazonal {
  volumePeriodo: number; // volume observado no período (delta × peso)
  fracaoCoberta: number; // fração do ano coberta pelo período observado
  volumeAnual: number; // volume anual implícito
  ano: number;
  meses: MesProjecao[];
  diariaMedia: number; // t/dia útil (média do ano)
}

/**
 * Projeta o volume distribuindo pelo perfil de sazonalidade mensal e calculando
 * a produção diária com base nos dias úteis ponderados de cada mês.
 *
 * Modelo:
 *  - volumeAnual = volumePeriodo / (soma das frações de sazonalidade cobertas
 *    pelo período observado);
 *  - volume do mês = volumeAnual × sazonalidade[mês];
 *  - diária do mês = volume do mês / dias úteis do mês.
 */
export function projetarSazonal(params: {
  volumePeriodo: number;
  periodoInicio: Date;
  periodoFim: Date;
  sazonalidade: number[]; // 12 valores (serão normalizados)
  ano: number; // ano-alvo para o detalhamento mensal
}): ProjecaoSazonal {
  const saz = normalizar(params.sazonalidade);
  const inicio = params.periodoInicio;
  const fim = params.periodoFim;

  // Fração do ano coberta pelo período (sazonalidade se repete a cada ano).
  let fracaoCoberta = 0;
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const fimMarco = new Date(fim.getFullYear(), fim.getMonth(), 1);
  while (cursor <= fimMarco) {
    const ano = cursor.getFullYear();
    const mes0 = cursor.getMonth();
    const diasNoMes = new Date(ano, mes0 + 1, 0).getDate();
    const ini = Math.max(
      1,
      ano === inicio.getFullYear() && mes0 === inicio.getMonth()
        ? inicio.getDate()
        : 1
    );
    const fimD =
      ano === fim.getFullYear() && mes0 === fim.getMonth()
        ? fim.getDate()
        : diasNoMes;
    const fracMes = Math.max(0, (fimD - ini + 1) / diasNoMes);
    fracaoCoberta += saz[mes0] * fracMes;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  if (fracaoCoberta <= 0) fracaoCoberta = 1;

  const volumeAnual = params.volumePeriodo / fracaoCoberta;

  const meses: MesProjecao[] = saz.map((s, i) => {
    const du = diasUteisMes(params.ano, i);
    const volume = volumeAnual * s;
    return {
      mes: i + 1,
      sazonalidade: s,
      diasUteis: du,
      volume: +volume.toFixed(2),
      diaria: du > 0 ? +(volume / du).toFixed(2) : 0,
    };
  });

  const totalDU = meses.reduce((acc, m) => acc + m.diasUteis, 0);
  const diariaMedia = totalDU > 0 ? +(volumeAnual / totalDU).toFixed(2) : 0;

  return {
    volumePeriodo: params.volumePeriodo,
    fracaoCoberta: +fracaoCoberta.toFixed(4),
    volumeAnual: +volumeAnual.toFixed(2),
    ano: params.ano,
    meses,
    diariaMedia,
  };
}
