import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addInterval, RecurrenceUnit } from '@/lib/recurrence';

/** Quantidade de parcelas futuras mantidas em aberto para recorrências personalizadas */
export const CUSTOM_LOOKAHEAD = 3;

/**
 * Recorrências personalizadas são armazenadas como `personalizada:<intervalo>:<unidade>`
 * (ex.: `personalizada:15:day`). As padrões continuam sendo mensal/trimestral/etc.
 */
export const buildCustomRecorrenciaKey = (interval: number, unit: RecurrenceUnit) =>
  `personalizada:${interval}:${unit}`;

export const parseRecorrencia = (
  recorrencia: string
): { custom: boolean; interval: number; unit: RecurrenceUnit } => {
  if (recorrencia?.startsWith('personalizada:')) {
    const [, i, u] = recorrencia.split(':');
    return { custom: true, interval: Math.max(1, parseInt(i) || 1), unit: (u as RecurrenceUnit) || 'month' };
  }
  const MESES: Record<string, number> = { mensal: 1, trimestral: 3, semestral: 6, anual: 12 };
  return { custom: false, interval: MESES[recorrencia] || 1, unit: 'month' };
};

export interface Recorrencia {
  id: string;
  user_id: string;
  credor_id: string;
  descricao: string;
  categoria: string;
  valor: number;
  forma_pagamento?: string;
  observacoes?: string;
  recorrencia: string; // mensal, trimestral, semestral, anual
  dia_vencimento: number;
  proxima_geracao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const getRecorrencias = async (): Promise<Recorrencia[]> => {
  const { data, error } = await (supabase as any)
    .from('recorrencias')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    credor_id: row.credor_id,
    descricao: row.descricao,
    categoria: row.categoria,
    valor: Number(row.valor),
    forma_pagamento: row.forma_pagamento || undefined,
    observacoes: row.observacoes || undefined,
    recorrencia: row.recorrencia,
    dia_vencimento: row.dia_vencimento,
    proxima_geracao: row.proxima_geracao,
    ativo: row.ativo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

export const saveRecorrencia = async (rec: Omit<Recorrencia, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Recorrencia> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await (supabase as any)
    .from('recorrencias')
    .insert({
      user_id: user.id,
      credor_id: rec.credor_id,
      descricao: rec.descricao,
      categoria: rec.categoria,
      valor: rec.valor,
      forma_pagamento: rec.forma_pagamento,
      observacoes: rec.observacoes,
      recorrencia: rec.recorrencia,
      dia_vencimento: rec.dia_vencimento,
      proxima_geracao: rec.proxima_geracao,
      ativo: rec.ativo,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Recorrencia;
};

export const updateRecorrencia = async (id: string, updates: Partial<Recorrencia>): Promise<void> => {
  const { error } = await (supabase as any)
    .from('recorrencias')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
};

export const deleteRecorrencia = async (id: string): Promise<void> => {
  const { error } = await (supabase as any)
    .from('recorrencias')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

/** Conta quantas parcelas futuras (não pagas) já existem para uma recorrência. */
const countPendingFuture = async (rec: Recorrencia, userId: string): Promise<number> => {
  const hoje = format(new Date(), 'yyyy-MM-dd');
  const { count } = await supabase
    .from('contas_pagar')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('credor_id', rec.credor_id)
    .neq('status', 'pago')
    .gte('data_vencimento', hoje)
    .ilike('descricao', `${rec.descricao} - %`);
  return count || 0;
};

/**
 * Gera as contas de UMA recorrência.
 * - Recorrências padrão (mensal/trimestral/...): gera tudo que vence nos próximos 60 dias.
 * - Recorrências personalizadas: gera gradativamente, mantendo apenas as próximas
 *   parcelas em aberto (CUSTOM_LOOKAHEAD), sem poluir o banco.
 */
export const gerarContasParaRecorrencia = async (recId: string): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: recData, error: recError } = await (supabase as any)
    .from('recorrencias')
    .select('*')
    .eq('id', recId)
    .single();

  if (recError || !recData) {
    console.error('Error fetching recorrencia for generation:', recError);
    return 0;
  }

  const rec: Recorrencia = { ...recData, valor: Number(recData.valor) };
  if (!rec.ativo) return 0;

  return await gerarParaRecorrencia(rec, user.id);
};

const gerarParaRecorrencia = async (rec: Recorrencia, userId: string): Promise<number> => {
  const { custom, interval, unit } = parseRecorrencia(rec.recorrencia);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 60);
  limit.setHours(23, 59, 59, 999);

  let cursor = new Date(rec.proxima_geracao + 'T00:00:00');
  let geradas = 0;

  // Para personalizadas, só completamos até o número de parcelas futuras desejado
  let emAberto = custom ? await countPendingFuture(rec, userId) : 0;

  const dateLabel = (d: Date) =>
    custom && unit === 'day'
      ? format(d, 'dd/MM/yy', { locale: ptBR })
      : format(d, 'MMM/yy', { locale: ptBR });

  while (custom ? emAberto + geradas < CUSTOM_LOOKAHEAD : cursor <= limit) {
    const dataVencimento = format(cursor, 'yyyy-MM-dd');
    const descricaoGerada = `${rec.descricao} - ${dateLabel(cursor)}`;

    const { data: existing } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('credor_id', rec.credor_id)
      .eq('data_vencimento', dataVencimento)
      .eq('user_id', userId)
      .eq('descricao', descricaoGerada)
      .limit(1);

    if (existing && existing.length > 0) {
      cursor = addInterval(cursor, interval, unit);
      continue;
    }

    const { error } = await supabase
      .from('contas_pagar')
      .insert({
        user_id: userId,
        credor_id: rec.credor_id,
        descricao: descricaoGerada,
        categoria: rec.categoria,
        valor: rec.valor,
        data_vencimento: dataVencimento,
        status: 'pendente',
        forma_pagamento: rec.forma_pagamento,
        observacoes: rec.observacoes ? `Recorrência automática. ${rec.observacoes}` : 'Recorrência automática.',
      });

    if (error) {
      console.error('[gerarParaRecorrencia] Erro ao inserir conta:', error);
      break;
    }

    geradas++;
    cursor = addInterval(cursor, interval, unit);
  }

  const originalProxima = new Date(rec.proxima_geracao + 'T00:00:00');
  if (cursor > originalProxima) {
    await updateRecorrencia(rec.id, { proxima_geracao: format(cursor, 'yyyy-MM-dd') });
  }

  return geradas;
};

/**
 * Verifica todas as recorrências ativas e gera as contas necessárias.
 */
let _generating = false;
export const gerarContasRecorrentes = async (): Promise<number> => {
  if (_generating) return 0;
  _generating = true;
  try {
    return await _doGerarContasRecorrentes();
  } finally {
    _generating = false;
  }
};

const _doGerarContasRecorrentes = async (): Promise<number> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const recorrencias = await getRecorrencias();
  const ativas = recorrencias.filter(r => r.ativo);
  let geradas = 0;

  for (const rec of ativas) {
    geradas += await gerarParaRecorrencia(rec, user.id);
  }

  return geradas;
};
