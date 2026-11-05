import {
  CalendarException,
  DayInfo,
  Holiday,
  WorkScheduleDay,
} from './calendar-types';

/** Data de hoje no fuso America/Sao_Paulo, como 'yyyy-MM-dd'. */
export const todayKeySP = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA => yyyy-MM-dd
};

/** Converte 'yyyy-MM-dd' em Date local (meio-dia, evita shift de fuso). */
export const keyToDate = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

export const dateToKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDaysKey = (key: string, days: number): string => {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return dateToKey(d);
};

/** Algoritmo de Gauss/Meeus/Butcher — domingo de Páscoa. */
export const getEasterDate = (year: number): Date => {
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
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 12, 0, 0);
};

const parseMovableOffset = (rule: string | null): number | null => {
  if (!rule) return null;
  const match = /^easter([+-]\d+)$/.exec(rule.trim());
  if (!match) return null;
  return Number(match[1]);
};

export interface CalendarEngineInput {
  workSchedule: WorkScheduleDay[];
  holidays: Holiday[];
  exceptions: CalendarException[];
  considerFacultative: boolean;
}

export interface CalendarEngine {
  getDayInfo: (key: string) => DayInfo;
  getDayWeight: (key: string) => number;
  getWeightedDays: (start: string, end: string) => number;
  getElapsedWeightedDays: (start: string, end: string, today?: string) => number;
  getRemainingWeightedDays: (start: string, end: string, today?: string) => number;
  getCalendarDays: (start: string, end: string) => number;
  getElapsedCalendarDays: (start: string, end: string, today?: string) => number;
  listDays: (start: string, end: string) => DayInfo[];
  getNextNonWorkingDay: (from: string, horizonDays?: number) => DayInfo | null;
  holidayForKey: (key: string) => Holiday | undefined;
}

const DEFAULT_HOURS: Record<number, number> = { 0: 0, 1: 8, 2: 8, 3: 8, 4: 8, 5: 8, 6: 4 };

export const buildCalendarEngine = ({
  workSchedule,
  holidays,
  exceptions,
  considerFacultative,
}: CalendarEngineInput): CalendarEngine => {
  const hoursByWeekday = new Map<number, number>();
  workSchedule.forEach((w) => hoursByWeekday.set(w.weekday, Number(w.hours)));

  const exceptionByDate = new Map<string, CalendarException>();
  exceptions.forEach((e) => exceptionByDate.set(e.date, e));

  const activeHolidays = holidays.filter((h) => h.is_active);
  const movableCache = new Map<number, Map<string, Holiday>>();

  const holidaysForYear = (year: number): Map<string, Holiday> => {
    const cached = movableCache.get(year);
    if (cached) return cached;
    const map = new Map<string, Holiday>();
    const easter = getEasterDate(year);
    activeHolidays.forEach((h) => {
      if (h.is_movable) {
        const offset = parseMovableOffset(h.movable_rule);
        if (offset === null) return;
        const d = new Date(easter);
        d.setDate(d.getDate() + offset);
        map.set(dateToKey(d), h);
      } else if (h.is_recurring && h.day && h.month) {
        map.set(`${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`, h);
      } else if (h.date) {
        map.set(h.date, h);
      }
    });
    movableCache.set(year, map);
    return map;
  };

  const holidayForKey = (key: string): Holiday | undefined => {
    const year = Number(key.slice(0, 4));
    const holiday = holidaysForYear(year).get(key);
    if (!holiday) return undefined;
    if (holiday.is_facultative && !considerFacultative) return undefined;
    return holiday;
  };

  const getDayInfo = (key: string): DayInfo => {
    const date = keyToDate(key);
    const weekday = date.getDay();
    const baseHours = hoursByWeekday.has(weekday)
      ? (hoursByWeekday.get(weekday) as number)
      : DEFAULT_HOURS[weekday];
    let weight = Math.min(Math.max(baseHours / 8, 0), 1);

    const holiday = holidayForKey(key);
    if (holiday) weight = Number(holiday.day_weight);

    const exception = exceptionByDate.get(key);
    if (exception) weight = Number(exception.day_weight);

    return {
      key,
      weight,
      holiday,
      exception,
      isWeekend: weekday === 0 || weekday === 6,
    };
  };

  const getDayWeight = (key: string) => getDayInfo(key).weight;

  const listDays = (start: string, end: string): DayInfo[] => {
    const out: DayInfo[] = [];
    if (!start || !end || start > end) return out;
    let cursor = start;
    let guard = 0;
    while (cursor <= end && guard < 2000) {
      out.push(getDayInfo(cursor));
      cursor = addDaysKey(cursor, 1);
      guard += 1;
    }
    return out;
  };

  const getWeightedDays = (start: string, end: string) =>
    listDays(start, end).reduce((sum, d) => sum + d.weight, 0);

  /** Dias ponderados ANTERIORES a hoje (hoje NÃO entra). */
  const getElapsedWeightedDays = (start: string, end: string, today = todayKeySP()) => {
    const yesterday = addDaysKey(today, -1);
    const cutoff = yesterday > end ? end : yesterday;
    if (cutoff < start) return 0;
    return getWeightedDays(start, cutoff);
  };


  const getRemainingWeightedDays = (start: string, end: string, today = todayKeySP()) => {
    const from = today < start ? start : today;
    if (from > end) return 0;
    return getWeightedDays(from, end);
  };

  const getCalendarDays = (start: string, end: string) => listDays(start, end).length;

  const getElapsedCalendarDays = (start: string, end: string, today = todayKeySP()) => {
    const cutoff = today > end ? end : today;
    if (cutoff < start) return 0;
    return listDays(start, cutoff).length;
  };

  const getNextNonWorkingDay = (from: string, horizonDays = 120): DayInfo | null => {
    let cursor = addDaysKey(from, 1);
    for (let i = 0; i < horizonDays; i += 1) {
      const info = getDayInfo(cursor);
      if (info.weight === 0) return info;
      cursor = addDaysKey(cursor, 1);
    }
    return null;
  };

  return {
    getDayInfo,
    getDayWeight,
    getWeightedDays,
    getElapsedWeightedDays,
    getRemainingWeightedDays,
    getCalendarDays,
    getElapsedCalendarDays,
    listDays,
    getNextNonWorkingDay,
    holidayForKey,
  };
};

// ───────────────────────────── INDICADORES ─────────────────────────────

export type GoalStatus = 'adiantado' | 'no_ritmo' | 'atencao' | 'atrasado' | 'sem_meta' | 'inicio';

export interface GoalIndicators {
  metaTotal: number;
  realizado: number;
  /** realizado com data ANTERIOR a hoje */
  realizadoAteOntem: number;
  /** realizado do dia corrente */
  realizadoHoje: number;
  diasPonderadosTotais: number;
  diasPonderadosDecorridos: number;
  diasPonderadosRestantes: number;
  pesoHoje: number;
  /** meta_diaria_ideal = meta_total / dias_totais */
  metaDiariaIdeal: number;
  /** meta_de_hoje_ideal = meta_diaria_ideal * peso_hoje */
  metaDoDiaIdeal: number;
  /** ritmo_necessario = (meta_total - realizado_total) / dias_restantes */
  ritmoNecessario: number;
  /** meta_de_hoje_ajustada = ritmo_necessario * peso_hoje */
  metaDoDia: number;
  /** percentual do dia corrente já realizado */
  percentualDoDia: number;
  /** @deprecated alias de ritmoNecessario */
  metaDiariaAjustada: number;
  /** esperado_ate_ontem = meta_diaria_ideal * dias_decorridos */
  metaAcumuladaEsperada: number;
  /** esperado_fim_do_dia = meta_diaria_ideal * (dias_decorridos + peso_hoje) */
  esperadoFimDoDia: number;
  saldo: number;
  ritmoAtual: number;
  projecaoFechamento: number;
  /** faixa de projeção (amostra pequena) */
  projecaoMin: number;
  projecaoMax: number;
  /** dias_decorridos < 5 */
  amostraInsuficiente: boolean;
  /** realizado_ate_ontem = 0 → sem base de cálculo */
  semBaseProjecao: boolean;
  percentualAtingido: number;
  percentualTempo: number;
  desvio: number;
  status: GoalStatus;
  periodoEncerrado: boolean;
  semDiasDecorridos: boolean;
  hojeEhDiaUtil: boolean;
}

export interface ComputeIndicatorsInput {
  metaTotal: number;
  /** realizado TOTAL do período (inclui hoje) */
  realizado: number;
  /** parcela do realizado que ocorreu HOJE */
  realizadoHoje?: number;
  diasPonderadosTotais: number;
  diasPonderadosDecorridos: number;
  diasPonderadosRestantes: number;
  pesoHoje: number;
  diasCalendarioTotais?: number;
  diasCalendarioDecorridos?: number;
  /** melhor dia útil decorrido (valor realizado) — limite superior da faixa */
  melhorDiaRealizado?: number;
  /** pior dia útil decorrido (valor realizado) — limite inferior da faixa */
  piorDiaRealizado?: number;
}

export const AMOSTRA_MINIMA_DIAS = 5;

export const computeIndicators = (i: ComputeIndicatorsInput): GoalIndicators => {
  const periodoEncerrado = i.diasPonderadosRestantes <= 0;
  const semDiasDecorridos = i.diasPonderadosDecorridos <= 0;

  const realizadoTotal = i.realizado;
  const realizadoHoje = Math.max(i.realizadoHoje || 0, 0);
  const realizadoAteOntem = Math.max(realizadoTotal - realizadoHoje, 0);

  const metaDiariaIdeal = i.diasPonderadosTotais > 0 ? i.metaTotal / i.diasPonderadosTotais : 0;
  const metaDoDiaIdeal = metaDiariaIdeal * i.pesoHoje;

  const faltante = Math.max(i.metaTotal - realizadoTotal, 0);
  const ritmoNecessario = periodoEncerrado ? 0 : faltante / i.diasPonderadosRestantes;
  // Meta de hoje é FIXADA no início do dia: usa o realizado até ontem,
  // portanto não varia conforme as vendas do dia corrente entram.
  const faltanteInicioDoDia = Math.max(i.metaTotal - realizadoAteOntem, 0);
  const ritmoInicioDoDia = periodoEncerrado ? 0 : faltanteInicioDoDia / i.diasPonderadosRestantes;
  const metaDoDia = ritmoInicioDoDia * i.pesoHoje;
  const percentualDoDia = metaDoDia > 0 ? realizadoHoje / metaDoDia : 0;

  const metaAcumuladaEsperada = metaDiariaIdeal * i.diasPonderadosDecorridos;
  const esperadoFimDoDia = metaDiariaIdeal * (i.diasPonderadosDecorridos + i.pesoHoje);
  // Bases iguais: realizado até ontem × esperado até ontem
  const saldo = realizadoAteOntem - metaAcumuladaEsperada;

  // Projeção considera o dia corrente como encerrado com o resultado atual,
  // portanto varia conforme entram vendas ao longo do dia.
  const diasBaseProjecao = i.diasPonderadosDecorridos + i.pesoHoje;
  const diasFuturos = Math.max(i.diasPonderadosRestantes - i.pesoHoje, 0);
  const ritmoAtual = diasBaseProjecao > 0 ? realizadoTotal / diasBaseProjecao : 0;
  const projecaoFechamento = diasBaseProjecao > 0 ? realizadoTotal + ritmoAtual * diasFuturos : 0;

  const amostraInsuficiente = diasBaseProjecao < AMOSTRA_MINIMA_DIAS;
  const semBaseProjecao = realizadoTotal <= 0;

  const pior = i.piorDiaRealizado ?? ritmoAtual;
  const melhor = i.melhorDiaRealizado ?? ritmoAtual;
  const projecaoMin = realizadoTotal + Math.max(pior, 0) * diasFuturos;
  const projecaoMax = realizadoTotal + Math.max(melhor, 0) * diasFuturos;


  const desvio = metaAcumuladaEsperada > 0 ? saldo / metaAcumuladaEsperada : 0;

  let status: GoalStatus = 'sem_meta';
  if (i.metaTotal > 0) {
    if (i.diasPonderadosDecorridos < 1) status = 'inicio';
    else if (desvio >= 0.1) status = 'adiantado';
    else if (desvio >= -0.1) status = 'no_ritmo';
    else if (desvio >= -0.25) status = 'atencao';
    else status = 'atrasado';
  }

  return {
    metaTotal: i.metaTotal,
    realizado: realizadoTotal,
    realizadoAteOntem,
    realizadoHoje,
    diasPonderadosTotais: i.diasPonderadosTotais,
    diasPonderadosDecorridos: i.diasPonderadosDecorridos,
    diasPonderadosRestantes: i.diasPonderadosRestantes,
    pesoHoje: i.pesoHoje,
    metaDiariaIdeal,
    metaDoDiaIdeal,
    ritmoNecessario,
    metaDoDia,
    percentualDoDia,
    metaDiariaAjustada: ritmoNecessario,
    metaAcumuladaEsperada,
    esperadoFimDoDia,
    saldo,
    ritmoAtual,
    projecaoFechamento,
    projecaoMin,
    projecaoMax,
    amostraInsuficiente,
    semBaseProjecao,
    percentualAtingido: i.metaTotal > 0 ? realizadoTotal / i.metaTotal : 0,
    percentualTempo: i.diasPonderadosTotais > 0 ? i.diasPonderadosDecorridos / i.diasPonderadosTotais : 0,
    desvio,
    status,
    periodoEncerrado,
    semDiasDecorridos,
    hojeEhDiaUtil: i.pesoHoje > 0,
  };
};


export const STATUS_LABELS: Record<GoalStatus, string> = {
  adiantado: 'Adiantado',
  no_ritmo: 'No ritmo',
  atencao: 'Atenção',
  atrasado: 'Atrasado',
  sem_meta: 'Sem meta',
  inicio: 'Início do período',
};


export const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number.isFinite(v) ? v : 0
  );

export const formatWeighted = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
