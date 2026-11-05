import { supabase } from '@/integrations/supabase/client';

export interface Curso {
  id: string;
  nome: string;
  nivel_ensino?: string | null;
  instituicao?: string | null;
  ativo: boolean;
  created_at?: string;
}

export const getCursos = async (): Promise<Curso[]> => {
  try {
    let allData: Curso[] = [];
    const pageSize = 1000;
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('cursos')
        .select('*')
        .eq('ativo', true)
        .order('nome')
        .range(from, from + pageSize - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    return allData;
  } catch (error) {
    console.error('Error loading cursos:', error);
    return [];
  }
};

export const saveCurso = async (curso: Omit<Curso, 'id' | 'created_at'>): Promise<string> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data, error } = await supabase
      .from('cursos')
      .insert({
        nome: curso.nome.toUpperCase(), // Store in uppercase for consistency
        ativo: curso.ativo,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error saving curso:', error);
    throw error;
  }
};
