import { supabase } from '@/integrations/supabase/client';

export interface CategoriaPersonalizada {
  id: string;
  user_id: string;
  nome: string;
  ativo: boolean;
  custo_operacional?: boolean;
  created_at: string;
}

export const getCategoriasPersonalizadas = async (): Promise<CategoriaPersonalizada[]> => {
  const { data, error } = await supabase
    .from('categorias_conta')
    .select('*')
    .eq('ativo', true)
    .order('nome');

  if (error) {
    console.error('Error fetching categorias personalizadas:', error);
    throw error;
  }

  return data || [];
};

/** Todas as categorias cadastradas (inclusive inativas) — usado na configuração de custo operacional. */
export const getTodasCategorias = async (): Promise<CategoriaPersonalizada[]> => {
  const { data, error } = await supabase
    .from('categorias_conta')
    .select('*')
    .order('nome');

  if (error) {
    console.error('Error fetching categorias:', error);
    throw error;
  }

  return data || [];
};

/** Nomes de categorias marcadas como custo operacional. */
export const getCategoriasCustoOperacional = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('categorias_conta')
    .select('nome, custo_operacional')
    .eq('custo_operacional', true);

  if (error) {
    console.error('Error fetching categorias custo operacional:', error);
    return [];
  }

  return (data || []).map((c: any) => c.nome);
};

export const setCategoriaCustoOperacional = async (id: string, value: boolean): Promise<void> => {
  const { error } = await supabase
    .from('categorias_conta')
    .update({ custo_operacional: value })
    .eq('id', id);

  if (error) {
    console.error('Error updating categoria custo operacional:', error);
    throw error;
  }
};


export const saveCategoriaPersonalizada = async (nome: string): Promise<CategoriaPersonalizada> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { data, error } = await supabase
    .from('categorias_conta')
    .insert({
      user_id: user.id,
      nome: nome.trim(),
      ativo: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving categoria personalizada:', error);
    throw error;
  }

  return data;
};

export const deleteCategoriaPersonalizada = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('categorias_conta')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting categoria personalizada:', error);
    throw error;
  }
};
