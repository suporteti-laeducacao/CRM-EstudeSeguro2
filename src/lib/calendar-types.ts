export type HolidayScope = 'nacional' | 'estadual' | 'municipal' | 'empresa';
export type ExceptionType = 'folga' | 'trabalho_extra' | 'meio_expediente';

export interface WorkScheduleDay {
  id: string;
  weekday: number; // 0 = domingo
  hours: number;
}

export interface Holiday {
  id: string;
  name: string;
  day: number | null;
  month: number | null;
  date: string | null;
  is_recurring: boolean;
  is_movable: boolean;
  movable_rule: string | null;
  scope: HolidayScope;
  day_weight: number;
  is_facultative: boolean;
  is_active: boolean;
  legal_basis: string | null;
  created_by?: string | null;
  created_at?: string;
}

export interface CalendarException {
  id: string;
  date: string;
  description: string;
  day_weight: number;
  type: ExceptionType;
  created_by?: string | null;
  created_at?: string;
}

export interface CalendarSettings {
  id: string;
  consider_facultative: boolean;
}

export interface DayInfo {
  /** yyyy-MM-dd */
  key: string;
  weight: number;
  /** feriado que atingiu o dia (se houver) */
  holiday?: Holiday;
  exception?: CalendarException;
  isWeekend: boolean;
}

export const SCOPE_LABELS: Record<HolidayScope, string> = {
  nacional: 'Nacional',
  estadual: 'Estadual',
  municipal: 'Municipal',
  empresa: 'Empresa',
};

export const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  folga: 'Folga',
  trabalho_extra: 'Trabalho extra',
  meio_expediente: 'Meio expediente',
};

export const CALENDAR_LEGAL_NOTICE =
  'Calendário base: Decreto Municipal nº 544/2023 — Itabaiana/SE. Revise anualmente quando a Prefeitura publicar o novo decreto.';
