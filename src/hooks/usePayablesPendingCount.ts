import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const TARGET_EMAIL = 'suporte.ti@facla.edu.br';

export const usePayablesPendingCount = () => {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user || user.email !== TARGET_EMAIL) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('id', { count: 'exact' })
        .lte('data_vencimento', todayStr)
        .neq('status', 'pago');
      if (error) return;
      setCount((data || []).length);
    };

    fetchCount();

    const channel = supabase
      .channel('payables-pending-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_pagar' }, () => {
        fetchCount();
      })
      .subscribe();

    const interval = setInterval(fetchCount, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user]);

  return count;
};
