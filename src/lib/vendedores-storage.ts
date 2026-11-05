import { supabase } from '@/integrations/supabase/client';

export interface Vendedor {
  id: string;
  user_id?: string;
  nome: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
  sunchat_user_id?: string;
  foto_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const getVendedores = async (apenasAtivos = true): Promise<Vendedor[]> => {
  // Contact details (email/phone) are only returned to privileged roles or the
  // seller themselves; everyone else gets the safe basic list.
  const { data, error } = await supabase.rpc('get_vendedores_basic', {
    _apenas_ativos: apenasAtivos,
  });

  if (error || !data) {
    console.error('Error fetching vendedores:', error);
    return [];
  }

  return data.map((v: Record<string, any>) => ({
    id: v.id,
    user_id: v.user_id,
    nome: v.nome,
    email: v.email || undefined,
    telefone: v.telefone || undefined,
    ativo: v.ativo,
    sunchat_user_id: v.sunchat_user_id || undefined,
    foto_url: v.foto_url || undefined,
    created_at: v.created_at,
    updated_at: v.updated_at,
  }));
};

export const getMyVendedorId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('vendedores')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching my vendedor id:', error);
    return null;
  }

  return data?.id ?? null;
};

export const getVendedor = async (id: string): Promise<Vendedor | null> => {
  const { data, error } = await supabase
    .from('vendedores')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('Error fetching vendedor:', error);
    return null;
  }

  return {
    id: data.id,
    nome: data.nome,
    email: data.email || undefined,
    telefone: data.telefone || undefined,
    ativo: data.ativo,
    sunchat_user_id: data.sunchat_user_id || undefined,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
};

export const saveVendedor = async (vendedor: Partial<Vendedor>): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const vendedorData = {
    id: vendedor.id,
    user_id: user.id,
    nome: vendedor.nome,
    email: vendedor.email,
    telefone: vendedor.telefone,
    ativo: vendedor.ativo ?? true,
    sunchat_user_id: vendedor.sunchat_user_id || null,
  };

  const { data, error } = await supabase
    .from('vendedores')
    .upsert(vendedorData)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

export const deleteVendedor = async (id: string): Promise<void> => {
  // Soft delete: apenas marca como inativo
  const { error } = await supabase
    .from('vendedores')
    .update({ ativo: false })
    .eq('id', id);

  if (error) throw error;
};

export const reativarVendedor = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('vendedores')
    .update({ ativo: true })
    .eq('id', id);

  if (error) throw error;
};
