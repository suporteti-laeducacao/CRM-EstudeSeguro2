import { supabase } from '@/integrations/supabase/client';
import {
  CalendarException,
  CalendarSettings,
  Holiday,
  WorkScheduleDay,
} from './calendar-types';

export const getWorkSchedule = async (): Promise<WorkScheduleDay[]> => {
  const { data, error } = await supabase
    .from('work_schedule')
    .select('id, weekday, hours')
    .order('weekday');
  if (error) throw error;
  return (data || []).map((d) => ({ ...d, hours: Number(d.hours) })) as WorkScheduleDay[];
};

export const updateWorkScheduleDay = async (weekday: number, hours: number): Promise<void> => {
  const { error } = await supabase.from('work_schedule').update({ hours }).eq('weekday', weekday);
  if (error) throw error;
};

export const getHolidays = async (): Promise<Holiday[]> => {
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .order('month', { ascending: true, nullsFirst: false })
    .order('day', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data || []).map((h: any) => ({ ...h, day_weight: Number(h.day_weight) })) as Holiday[];
};

export const saveHoliday = async (holiday: Partial<Holiday>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload: any = { ...holiday };
  if (!payload.id) payload.created_by = user?.id ?? null;
  const { error } = payload.id
    ? await supabase.from('holidays').update(payload).eq('id', payload.id)
    : await supabase.from('holidays').insert(payload);
  if (error) throw error;
};

export const deleteHoliday = async (id: string): Promise<void> => {
  const { error } = await supabase.from('holidays').delete().eq('id', id);
  if (error) throw error;
};

export const getCalendarExceptions = async (): Promise<CalendarException[]> => {
  const { data, error } = await supabase
    .from('calendar_exceptions')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((e: any) => ({ ...e, day_weight: Number(e.day_weight) })) as CalendarException[];
};

export const saveCalendarException = async (exc: Partial<CalendarException>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  const payload: any = { ...exc };
  if (!payload.id) payload.created_by = user?.id ?? null;
  const { error } = payload.id
    ? await supabase.from('calendar_exceptions').update(payload).eq('id', payload.id)
    : await supabase.from('calendar_exceptions').insert(payload);
  if (error) throw error;
};

export const deleteCalendarException = async (id: string): Promise<void> => {
  const { error } = await supabase.from('calendar_exceptions').delete().eq('id', id);
  if (error) throw error;
};

export const getCalendarSettings = async (): Promise<CalendarSettings | null> => {
  const { data, error } = await supabase
    .from('calendar_settings')
    .select('id, consider_facultative')
    .limit(1);
  if (error) throw error;
  return (data && data[0]) ? (data[0] as CalendarSettings) : null;
};

export const updateCalendarSettings = async (
  id: string,
  consider_facultative: boolean
): Promise<void> => {
  const { error } = await supabase
    .from('calendar_settings')
    .update({ consider_facultative })
    .eq('id', id);
  if (error) throw error;
};
