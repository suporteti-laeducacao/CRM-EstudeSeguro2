import { supabase } from '@/integrations/supabase/client';

export interface MetaGeral {
  id: string;
  user_id: string;
  valor: number;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MetaVendedor {
  id: string;
  user_id: string;
  vendedor_id: string;
  valor: number;
  periodo: string;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  vendedor?: { nome: string };
}

export const getMetasGerais = async (): Promise<MetaGeral[]> => {
  const { data, error } = await supabase
    .from('metas_gerais')
    .select('*')
    .order('data_inicio', { ascending: false });
  if (error) throw error;
  return (data || []) as MetaGeral[];
};

export const getMetaGeralAtiva = async (dataRef?: Date): Promise<MetaGeral | null> => {
  const ref = dataRef || new Date();
  const refStr = ref.toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('metas_gerais')
    .select('*')
    .lte('data_inicio', refStr)
    .gte('data_fim', refStr)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data && data.length > 0 ? data[0] : null) as MetaGeral | null;
};

export const saveMetaGeral = async (meta: Partial<MetaGeral>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const payload = { ...meta, user_id: user.id };
  const { error } = await supabase.from('metas_gerais').upsert(payload as any);
  if (error) throw error;
};

export const deleteMetaGeral = async (id: string): Promise<void> => {
  const { error } = await supabase.from('metas_gerais').delete().eq('id', id);
  if (error) throw error;
};

export const getMetasVendedores = async (): Promise<MetaVendedor[]> => {
  const { data, error } = await supabase
    .from('metas_vendedores')
    .select('*, vendedor:vendedores(nome)')
    .order('data_inicio', { ascending: false });
  if (error) throw error;
  return (data || []).map((m: any) => ({
    ...m,
    vendedor: Array.isArray(m.vendedor) ? m.vendedor[0] : m.vendedor,
  })) as MetaVendedor[];
};

export const getMetasVendedoresAtivas = async (dataRef?: Date): Promise<MetaVendedor[]> => {
  const ref = dataRef || new Date();
  const refStr = ref.toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('metas_vendedores')
    .select('*, vendedor:vendedores(nome)')
    .lte('data_inicio', refStr)
    .gte('data_fim', refStr);
  if (error) throw error;
  return (data || []).map((m: any) => ({
    ...m,
    vendedor: Array.isArray(m.vendedor) ? m.vendedor[0] : m.vendedor,
  })) as MetaVendedor[];
};

export const saveMetaVendedor = async (meta: Partial<MetaVendedor>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { vendedor, ...rest } = meta as any;
  const payload = { ...rest, user_id: user.id };
  const { error } = await supabase.from('metas_vendedores').upsert(payload as any);
  if (error) throw error;
};

export const deleteMetaVendedor = async (id: string): Promise<void> => {
  const { error } = await supabase.from('metas_vendedores').delete().eq('id', id);
  if (error) throw error;
};
