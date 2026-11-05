import { supabase } from '@/integrations/supabase/client';
import { Cliente, Negocio, Atividade } from './crm-types';

// Clientes
export const getClientes = async (): Promise<Cliente[]> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Error fetching clientes:', error);
    throw error;
  }

  return data || [];
};

export const getCliente = async (id: string): Promise<Cliente | null> => {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching cliente:', error);
    throw error;
  }

  return data;
};

export const saveCliente = async (cliente: Partial<Cliente>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const clienteData = {
    id: cliente.id,
    user_id: user.id,
    nome: cliente.nome!,
    email: cliente.email,
    telefone: cliente.telefone,
    empresa: cliente.empresa,
    nivel_ensino: cliente.nivel_ensino,
    curso: cliente.curso,
    vendedor_id: cliente.vendedor_id,
    notas: cliente.notas,
    promessa_certificacao: cliente.promessa_certificacao,
    previsao_certificacao: cliente.previsao_certificacao,
  };

  const { error } = await supabase
    .from('clientes')
    .upsert(clienteData);

  if (error) throw error;
};

export const deleteCliente = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('clientes')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Negócios
export const getNegocios = async (vendedorId?: string): Promise<Negocio[]> => {
  let query = supabase
    .from('negocios')
    .select('*, cliente:clientes(*), vendedor:vendedores(nome)')
    .order('created_at', { ascending: false });

  if (vendedorId) {
    query = query.eq('vendedor_id', vendedorId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching negocios:', error);
    throw error;
  }

  return data?.map(n => ({
    ...n,
    status: n.status as Negocio['status'],
    cliente: Array.isArray(n.cliente) ? n.cliente[0] : n.cliente,
    vendedor: Array.isArray(n.vendedor) ? n.vendedor[0] : n.vendedor,
    follow_ups: Array.isArray(n.follow_ups) ? (n.follow_ups as string[]) : [],
  })) || [];
};

export const getNegocio = async (id: string): Promise<Negocio | null> => {
  const { data, error } = await supabase
    .from('negocios')
    .select('*, cliente:clientes(*), vendedor:vendedores(nome)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching negocio:', error);
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    status: data.status as Negocio['status'],
    cliente: Array.isArray(data.cliente) ? data.cliente[0] : data.cliente,
    vendedor: Array.isArray(data.vendedor) ? data.vendedor[0] : data.vendedor,
    follow_ups: Array.isArray(data.follow_ups) ? (data.follow_ups as string[]) : [],
  };
};

export const saveNegocio = async (negocio: Partial<Negocio>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const negocioData = {
    id: negocio.id,
    user_id: user.id,
    curso: negocio.curso!,
    descricao: negocio.descricao,
    valor: negocio.valor,
    status: negocio.status!,
    cliente_id: negocio.cliente_id,
    cliente_nome: negocio.cliente_nome,
    vendedor_id: negocio.vendedor_id,
    telefone: negocio.telefone,
    data: negocio.data,
    follow_up_1: negocio.follow_up_1,
    follow_up_2: negocio.follow_up_2,
    follow_ups: (negocio.follow_ups || []) as any,
  };

  const { error } = await supabase
    .from('negocios')
    .upsert(negocioData);

  if (error) throw error;
};

export const deleteNegocio = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('negocios')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Atividades
export const getAtividades = async (negocio_id?: string): Promise<Atividade[]> => {
  let query = supabase
    .from('atividades')
    .select('*')
    .order('data', { ascending: false });

  if (negocio_id) {
    query = query.eq('negocio_id', negocio_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching atividades:', error);
    throw error;
  }

  return data?.map(a => ({
    ...a,
    tipo: a.tipo as Atividade['tipo']
  })) || [];
};

export const saveAtividade = async (atividade: Partial<Atividade>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const atividadeData = {
    id: atividade.id,
    user_id: user.id,
    tipo: atividade.tipo!,
    descricao: atividade.descricao,
    data: atividade.data,
    negocio_id: atividade.negocio_id,
  };

  const { error } = await supabase
    .from('atividades')
    .upsert(atividadeData);

  if (error) throw error;
};

export const deleteAtividade = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('atividades')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
