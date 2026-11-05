import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getMyVendedorId } from '@/lib/vendedores-storage';
import { carregarRegua, ReguaData } from '@/lib/acompanhamento-storage';
import { AlertaAcompanhamento, Prioridade } from '@/lib/acompanhamento';

/**
 * Carrega a régua de acompanhamento já respeitando a visibilidade do usuário:
 * vendedor vê apenas os próprios alunos, perfis de gestão veem todos.
 */
export const useAcompanhamento = () => {
  const { hasRole } = useAuth();
  const [data, setData] = useState<ReguaData | null>(null);
  const [meuVendedorId, setMeuVendedorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const podeVerTodos = hasRole('admin') || hasRole('gerente') || hasRole('supervisor');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [regua, vendedorId] = await Promise.all([carregarRegua(), getMyVendedorId()]);
      setData(regua);
      setMeuVendedorId(vendedorId);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const alertas = useMemo(() => {
    if (!data) return [] as AlertaAcompanhamento[];
    if (podeVerTodos) return data.alertas;
    return data.alertas.filter((a) => a.vendedorId && a.vendedorId === meuVendedorId);
  }, [data, podeVerTodos, meuVendedorId]);

  const cancelados = useMemo(() => {
    if (!data) return [] as AlertaAcompanhamento[];
    if (podeVerTodos) return data.cancelados;
    return data.cancelados.filter((a) => a.vendedorId && a.vendedorId === meuVendedorId);
  }, [data, podeVerTodos, meuVendedorId]);

  const pendentes = useMemo(() => alertas.filter((a) => a.pendente), [alertas]);

  const porPrioridade = useMemo(() => {
    const base: Record<Prioridade, number> = { vencido: 0, critica: 0, alta: 0, atencao: 0 };
    pendentes.forEach((a) => {
      if (a.prioridade) base[a.prioridade] += 1;
    });
    return base;
  }, [pendentes]);

  return {
    loading,
    reload,
    alertas,
    cancelados,
    pendentes,
    porPrioridade,
    podeVerTodos,
    meuVendedorId,
    hoje: data?.hoje,
    semPrevisao: data?.semPrevisao ?? 0,
    semVendedor: data?.semVendedor ?? 0,
    totalMatriculasAtivas: data?.totalMatriculasAtivas ?? 0,
    monitorados: alertas.length,
  };
};
