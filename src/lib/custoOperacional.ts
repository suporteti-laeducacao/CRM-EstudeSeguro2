/**
 * Regime de competência — resolução centralizada do "mês de referência efetivo"
 * de um lançamento de contas a pagar.
 *
 * Regra única usada por qualquer parte do sistema que precise de competência.
 * Nunca duplicar esta lógica em componentes.
 */

export type OrigemCompetencia =
  | 'informado'
  | 'derivado_vencimento'
  | 'derivado_pagamento'
  | 'derivado_criacao';

export interface CompetenciaResolvida {
  competencia: string; // 'YYYY-MM'
  origem: OrigemCompetencia;
}

export interface ContaCompetencia {
  mes_referencia?: string | null;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  created_at?: string | null;
}

const MESES_PT: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
};

const PLACEHOLDERS = ['selecione o mês trabalhado', 'selecione', '-', '—'];

/** Converte uma data (string) para 'YYYY-MM' usando horário LOCAL (America/Sao_Paulo no cliente). */
export const dateToCompetencia = (value?: string | null): string | null => {
  if (!value) return null;
  const plain = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (plain) return `${plain[1]}-${plain[2]}`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Normaliza o campo mes_referencia (gravado em formatos variados) para 'YYYY-MM'.
 * Retorna null quando vazio/placeholder/não parseável.
 */
export const normalizeMesReferencia = (raw?: string | null): string | null => {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  if (PLACEHOLDERS.includes(value.toLowerCase())) return null;

  // 'YYYY-MM' ou 'YYYY-MM-DD' / ISO / timestamp
  if (/^\d{4}-\d{2}(-\d{2})?/.test(value)) {
    const m = /^(\d{4})-(\d{2})/.exec(value)!;
    const mes = Number(m[2]);
    if (mes >= 1 && mes <= 12) return `${m[1]}-${m[2]}`;
    return null;
  }

  // 'jul/26', 'Jul/2026', 'jul-26', 'julho/2026'
  const abbrev = /^([a-zç]{3,10})\s*[\/\-\s]\s*(\d{2,4})$/i.exec(value);
  if (abbrev) {
    const mes = MESES_PT[abbrev[1].slice(0, 3).toLowerCase()];
    if (mes) {
      const anoRaw = Number(abbrev[2]);
      const ano = abbrev[2].length <= 2 ? 2000 + anoRaw : anoRaw;
      if (!isNaN(ano)) return `${ano}-${mes}`;
    }
    return null;
  }

  // '07/2026' ou '7/26'
  const numeric = /^(\d{1,2})\s*[\/\-]\s*(\d{2,4})$/.exec(value);
  if (numeric) {
    const mes = Number(numeric[1]);
    if (mes >= 1 && mes <= 12) {
      const anoRaw = Number(numeric[2]);
      const ano = numeric[2].length <= 2 ? 2000 + anoRaw : anoRaw;
      return `${ano}-${String(mes).padStart(2, '0')}`;
    }
    return null;
  }

  // Última tentativa: data parseável
  return dateToCompetencia(value);
};

export const resolverCompetencia = (conta: ContaCompetencia): CompetenciaResolvida => {
  const informado = normalizeMesReferencia(conta.mes_referencia);
  if (informado) return { competencia: informado, origem: 'informado' };

  const venc = dateToCompetencia(conta.data_vencimento);
  if (venc) return { competencia: venc, origem: 'derivado_vencimento' };

  const pag = dateToCompetencia(conta.data_pagamento);
  if (pag) return { competencia: pag, origem: 'derivado_pagamento' };

  const criado = dateToCompetencia(conta.created_at);
  if (criado) return { competencia: criado, origem: 'derivado_criacao' };

  // Fallback absoluto: mês atual (local)
  const now = new Date();
  return {
    competencia: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    origem: 'derivado_criacao',
  };
};

export const ORIGEM_LABEL: Record<OrigemCompetencia, string> = {
  informado: 'Mês de referência informado no lançamento',
  derivado_vencimento: 'Mês de referência não informado — derivado da data de vencimento',
  derivado_pagamento: 'Mês de referência não informado — derivado da data de pagamento',
  derivado_criacao: 'Mês de referência não informado — derivado da data de criação',
};

const MES_LABEL = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** '2026-07' -> 'jul/26' */
export const formatCompetencia = (competencia: string): string => {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!m) return competencia;
  return `${MES_LABEL[Number(m[2]) - 1]}/${m[1].slice(2)}`;
};

/** Valor considerado do lançamento (mesma régua usada no relatório). */
export const valorConta = (c: { valor_total?: number | null; valor_pago?: number | null; valor: number }) =>
  Number(c.valor_total ?? c.valor_pago ?? c.valor ?? 0);
