import { addDays, addMonths, addYears, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type RecurrenceUnit = 'day' | 'month' | 'year';
export type RecurrenceEndType = 'count' | 'date' | 'never';
export type RecurrenceType = 'none' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

export const MAX_RECURRENCE_ITEMS = 120;

/** Parcelas mantidas em aberto para recorrência sem data de término */
export const NEVER_LOOKAHEAD = 3;

export const UNIDADES_RECORRENCIA: { value: RecurrenceUnit; label: string }[] = [
  { value: 'day', label: 'Dia(s)' },
  { value: 'month', label: 'Mês(es)' },
  { value: 'year', label: 'Ano(s)' },
];

const UNIT_LABEL_PLURAL: Record<RecurrenceUnit, string> = {
  day: 'dias',
  month: 'meses',
  year: 'anos',
};

const UNIT_LABEL_SINGULAR: Record<RecurrenceUnit, string> = {
  day: 'dia',
  month: 'mês',
  year: 'ano',
};

/**
 * Adds `amount` of `unit` to a date.
 * date-fns addMonths/addYears already clamp to the last day of the target month
 * (31/01 + 1 mês => 28/02 ou 29/02).
 */
export const addInterval = (date: Date, amount: number, unit: RecurrenceUnit): Date => {
  switch (unit) {
    case 'day':
      return addDays(date, amount);
    case 'year':
      return addYears(date, amount);
    case 'month':
    default:
      return addMonths(date, amount);
  }
};

export interface RecurrenceConfig {
  start: Date;
  interval: number;
  unit: RecurrenceUnit;
  endType: RecurrenceEndType;
  count?: number;
  endDate?: Date;
}

export interface RecurrenceResult {
  dates: Date[];
  truncated: boolean;
}

export const generateRecurrenceDates = (config: RecurrenceConfig): RecurrenceResult => {
  const { start, interval, unit, endType, count, endDate } = config;
  const dates: Date[] = [];
  let truncated = false;

  if (!start || !interval || interval < 1) return { dates, truncated };

  if (endType === 'never') {
    // Geração gradual: apenas as próximas ocorrências são lançadas agora.
    for (let i = 0; i < NEVER_LOOKAHEAD; i++) {
      dates.push(addInterval(start, interval * i, unit));
    }
  } else if (endType === 'count') {
    const total = Math.max(1, count || 1);
    const limited = Math.min(total, MAX_RECURRENCE_ITEMS);
    if (total > MAX_RECURRENCE_ITEMS) truncated = true;
    for (let i = 0; i < limited; i++) {
      dates.push(addInterval(start, interval * i, unit));
    }
  } else {
    if (!endDate) return { dates, truncated };
    const limit = new Date(endDate);
    limit.setHours(23, 59, 59, 999);
    let i = 0;
    while (true) {
      const next = addInterval(start, interval * i, unit);
      if (next > limit) break;
      if (dates.length >= MAX_RECURRENCE_ITEMS) {
        truncated = true;
        break;
      }
      dates.push(next);
      i++;
    }
  }

  return { dates, truncated };
};

export const buildRecurrenceSummary = (
  config: RecurrenceConfig,
  dates: Date[]
): string => {
  if (dates.length === 0) return '';
  const { interval, unit, endType } = config;
  const unitLabel = interval === 1 ? UNIT_LABEL_SINGULAR[unit] : UNIT_LABEL_PLURAL[unit];
  const primeira = format(dates[0], 'dd/MM/yyyy', { locale: ptBR });
  const ultima = format(dates[dates.length - 1], 'dd/MM/yyyy', { locale: ptBR });
  if (endType === 'never') {
    return `Vence a cada ${interval} ${unitLabel}, sem data de término — a recorrência só para quando você interromper manualmente. Serão lançados apenas os ${dates.length} próximos vencimentos (${primeira} até ${ultima}); os demais são gerados automaticamente conforme forem se aproximando.`;
  }
  return `Vence a cada ${interval} ${unitLabel}, ${dates.length} ${dates.length === 1 ? 'vez' : 'vezes'}, de ${primeira} até ${ultima}.`;
};
