import { supabase } from '@/integrations/supabase/client';

export interface GrupoRepasse {
  id: string;
  nome: string;
  porcentagem_empresa: number;
  ativo: boolean;
  created_at?: string;
}

export const getGruposRepasse = async (): Promise<GrupoRepasse[]> => {
  const { data, error } = await supabase
    .from('grupos_repasse')
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.error('Error fetching grupos_repasse:', error);
    throw error;
  }

  return data || [];
};

export const getGruposRepasseAtivos = async (): Promise<GrupoRepasse[]> => {
  const { data, error } = await supabase
    .from('grupos_repasse')
    .select('*')
    .eq('ativo', true)
    .order('nome', { ascending: true });

  if (error) {
    console.error('Error fetching grupos_repasse ativos:', error);
    throw error;
  }

  return data || [];
};

export const saveGrupoRepasse = async (grupo: Partial<GrupoRepasse>): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const grupoData = {
    id: grupo.id,
    user_id: user.id,
    nome: grupo.nome!,
    porcentagem_empresa: grupo.porcentagem_empresa!,
    ativo: grupo.ativo ?? true,
  };

  const { error } = await supabase
    .from('grupos_repasse')
    .upsert(grupoData);

  if (error) throw error;
};

export const toggleGrupoRepasseStatus = async (id: string, ativo: boolean): Promise<void> => {
  const { error } = await supabase
    .from('grupos_repasse')
    .update({ ativo })
    .eq('id', id);

  if (error) throw error;
};

export const checkGrupoRepasseHasVendas = async (id: string): Promise<boolean> => {
  const { count, error } = await supabase
    .from('sales')
    .select('*', { count: 'exact', head: true })
    .eq('grupo_repasse_id', id);

  if (error) {
    console.error('Error checking grupo repasse vendas:', error);
    throw error;
  }

  return (count || 0) > 0;
};
