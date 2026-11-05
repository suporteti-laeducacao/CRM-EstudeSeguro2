import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getCalendarExceptions,
  getCalendarSettings,
  getHolidays,
  getWorkSchedule,
} from '@/lib/calendar-storage';
import {
  buildCalendarEngine,
  CalendarEngine,
  computeIndicators,
  GoalIndicators,
  todayKeySP,
} from '@/lib/business-days';

export const CALENDAR_QUERY_KEY = ['calendar-data'];

export interface PeriodStats {
  start: string;
  end: string;
  today: string;
  diasPonderadosTotais: number;
  diasPonderadosDecorridos: number;
  diasPonderadosRestantes: number;
  diasCalendarioTotais: number;
  diasCalendarioDecorridos: number;
  pesoHoje: number;
  hojeEhDiaUtil: boolean;
  feriadoHoje?: string;
  proximoDiaNaoUtil?: { key: string; nome: string };
  periodoEncerrado: boolean;
}

export const useBusinessDays = () => {
  const { data, isLoading } = useQuery({
    queryKey: CALENDAR_QUERY_KEY,
    queryFn: async () => {
      const [workSchedule, holidays, exceptions, settings] = await Promise.all([
        getWorkSchedule(),
        getHolidays(),
        getCalendarExceptions(),
        getCalendarSettings(),
      ]);
      return { workSchedule, holidays, exceptions, settings };
    },
    staleTime: 5 * 60 * 1000,
  });

  const engine: CalendarEngine = useMemo(
    () =>
      buildCalendarEngine({
        workSchedule: data?.workSchedule || [],
        holidays: data?.holidays || [],
        exceptions: data?.exceptions || [],
        considerFacultative: data?.settings?.consider_facultative ?? false,
      }),
    [data]
  );

  const getPeriodStats = useMemo(
    () =>
      (start: string, end: string): PeriodStats => {
        const today = todayKeySP();
        const info = engine.getDayInfo(today);
        const next = engine.getNextNonWorkingDay(today);
        const remaining = engine.getRemainingWeightedDays(start, end, today);
        return {
          start,
          end,
          today,
          diasPonderadosTotais: engine.getWeightedDays(start, end),
          diasPonderadosDecorridos: engine.getElapsedWeightedDays(start, end, today),
          diasPonderadosRestantes: remaining,
          diasCalendarioTotais: engine.getCalendarDays(start, end),
          diasCalendarioDecorridos: engine.getElapsedCalendarDays(start, end, today),
          pesoHoje: today >= start && today <= end ? info.weight : 0,
          hojeEhDiaUtil: info.weight > 0,
          feriadoHoje: info.holiday?.name || info.exception?.description,
          proximoDiaNaoUtil: next
            ? { key: next.key, nome: next.holiday?.name || next.exception?.description || 'Fim de semana' }
            : undefined,
          periodoEncerrado: remaining <= 0,
        };
      },
    [engine]
  );

  const getIndicators = useMemo(
    () =>
      (
        metaTotal: number,
        realizado: number,
        stats: PeriodStats,
        extra?: { realizadoHoje?: number; melhorDiaRealizado?: number; piorDiaRealizado?: number }
      ): GoalIndicators =>
        computeIndicators({
          metaTotal,
          realizado,
          realizadoHoje: extra?.realizadoHoje,
          melhorDiaRealizado: extra?.melhorDiaRealizado,
          piorDiaRealizado: extra?.piorDiaRealizado,
          diasPonderadosTotais: stats.diasPonderadosTotais,
          diasPonderadosDecorridos: stats.diasPonderadosDecorridos,
          diasPonderadosRestantes: stats.diasPonderadosRestantes,
          pesoHoje: stats.pesoHoje,
          diasCalendarioTotais: stats.diasCalendarioTotais,
          diasCalendarioDecorridos: stats.diasCalendarioDecorridos,
        }),
    []
  );


  return {
    isLoading,
    engine,
    holidays: data?.holidays || [],
    exceptions: data?.exceptions || [],
    workSchedule: data?.workSchedule || [],
    settings: data?.settings ?? null,
    considerFacultative: data?.settings?.consider_facultative ?? false,
    getPeriodStats,
    getIndicators,
  };
};
