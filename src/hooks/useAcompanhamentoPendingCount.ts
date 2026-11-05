import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getMyVendedorId } from '@/lib/vendedores-storage';
import { calcularAlerta, ContatoAcompanhamento, todayISO, addDays } from '@/lib/acompanhamento';

/** Contagem leve de alertas pendentes para o badge do menu lateral. */
export const useAcompanhamentoPendingCount = () => {
  const { user, hasRole } = useAuth();
  const [count, setCount] = useState(0);

  const podeVerTodos = hasRole('admin') || hasRole('gerente') || hasRole('supervisor');

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let cancelled = false;

    const fetchCount = async () => {
      const hoje = todayISO();
      const limite = addDays(hoje, 30);
      const meuVendedorId = podeVerTodos ? null : await getMyVendedorId();

      let query = supabase
        .from('sales')
        .select('id, student_name, course, vendedor_id, previsao_conclusao')
        .not('previsao_conclusao', 'is', null)
        .lte('previsao_conclusao', limite)
        .neq('status', 'cancelada');
      if (!podeVerTodos) {
        if (!meuVendedorId) {
          if (!cancelled) setCount(0);
          return;
        }
        query = query.eq('vendedor_id', meuVendedorId);
      }

      const { data, error } = await query;
      if (error || !data) return;

      const ids = data.map((s) => s.id);
      if (ids.length === 0) {
        if (!cancelled) setCount(0);
        return;
      }

      const { data: contatos } = await supabase
        .from('acompanhamento_contatos')
        .select('*')
        .in('sale_id', ids);

      const porSale = new Map<string, ContatoAcompanhamento[]>();
      ((contatos || []) as unknown as ContatoAcompanhamento[]).forEach((c) => {
        if (!c.sale_id) return;
        porSale.set(c.sale_id, [...(porSale.get(c.sale_id) || []), c]);
      });

      const pendentes = data.filter((s) =>
        calcularAlerta(
          {
            saleId: s.id,
            alunoNome: s.student_name,
            curso: s.course,
            vendedorId: s.vendedor_id,
            previsaoConclusao: s.previsao_conclusao as string,
          },
          porSale.get(s.id) || [],
          { hoje }
        ).pendente
      ).length;

      if (!cancelled) setCount(pendentes);
    };

    fetchCount();
    const interval = setInterval(fetchCount, 300_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, podeVerTodos]);

  return count;
};
