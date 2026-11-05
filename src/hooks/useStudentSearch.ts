import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StudentSearchResult {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  academic_course: string | null;
}

const onlyDigits = (v: string) => v.replace(/\D/g, '');

export const maskCpf = (cpf?: string | null) => {
  const d = onlyDigits(cpf || '');
  if (d.length !== 11) return cpf || '—';
  return `${d.slice(0, 3)}.***.**${d.slice(8, 9)}-${d.slice(9)}`;
};

/**
 * Busca única de alunos usada em todo o sistema (aba Alunos e Certificação).
 * Busca no servidor por nome, e-mail, CPF e telefone.
 */
export const searchStudents = async (term: string): Promise<StudentSearchResult[]> => {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, email, phone, cpf, academic_course')
    .or(`full_name.ilike.${like},email.ilike.${like},cpf.ilike.${like},phone.ilike.${like}`)
    .order('full_name', { ascending: true })
    .limit(20);
  if (error) throw error;

  let results = (data || []) as StudentSearchResult[];

  // Fallback para busca por dígitos (CPF/telefone com máscara no cadastro)
  const digits = onlyDigits(q);
  if (results.length === 0 && digits.length >= 4) {
    const { data: all, error: err2 } = await supabase
      .from('students')
      .select('id, full_name, email, phone, cpf, academic_course')
      .order('full_name', { ascending: true })
      .limit(2000);
    if (err2) throw err2;
    results = ((all || []) as StudentSearchResult[])
      .filter(
        (s) =>
          onlyDigits(s.cpf || '').includes(digits) || onlyDigits(s.phone || '').includes(digits)
      )
      .slice(0, 20);
  }

  return results;
};

export const useStudentSearch = (term: string) => {
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (term.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const r = await searchStudents(term);
        if (!cancelled) setResults(r);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erro na busca');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, reloadKey]);

  return { results, loading, error, retry: () => setReloadKey((k) => k + 1) };
};
