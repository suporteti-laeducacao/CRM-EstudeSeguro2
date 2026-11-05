import { supabase } from '@/integrations/supabase/client';
import { Credor, ContaPagar } from './payables-types';

// Credores
export const getCredores = async (): Promise<Credor[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('credores')
    .select('*')
    .order('nome');

  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    nome: row.nome,
    tipo: row.tipo as Credor['tipo'],
    status: row.status as Credor['status'],
    observacoes: row.observacoes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

export const saveCredor = async (credor: Omit<Credor, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Credor> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('credores')
    .insert({
      user_id: user.id,
      nome: credor.nome,
      tipo: credor.tipo,
      status: credor.status,
      observacoes: credor.observacoes,
    })
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    user_id: data.user_id,
    nome: data.nome,
    tipo: data.tipo as Credor['tipo'],
    status: data.status as Credor['status'],
    observacoes: data.observacoes || undefined,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
};

export const updateCredor = async (id: string, credor: Partial<Omit<Credor, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> => {
  const { error } = await supabase
    .from('credores')
    .update(credor)
    .eq('id', id);

  if (error) throw error;
};

export const deleteCredor = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('credores')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

// Contas a Pagar
export const getContasPagar = async (): Promise<ContaPagar[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .order('data_vencimento');

  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.id,
    user_id: row.user_id,
    credor_id: row.credor_id,
    descricao: row.descricao,
    categoria: row.categoria as ContaPagar['categoria'],
    valor: Number(row.valor),
    valor_pago: row.valor_pago ? Number(row.valor_pago) : undefined,
    valor_total: row.valor_total ? Number(row.valor_total) : undefined,
    data_vencimento: row.data_vencimento,
    status: row.status as ContaPagar['status'],
    forma_pagamento: row.forma_pagamento || undefined,
    data_pagamento: row.data_pagamento || undefined,
    observacoes: row.observacoes || undefined,
    comprovante_url: row.comprovante_url || undefined,
    boleto_url: row.boleto_url || undefined,
    mes_referencia: row.mes_referencia || undefined,
    recurrence_type: (row as any).recurrence_type || undefined,
    recurrence_interval: (row as any).recurrence_interval ?? undefined,
    recurrence_unit: (row as any).recurrence_unit || undefined,
    recurrence_end_type: (row as any).recurrence_end_type || undefined,
    recurrence_count: (row as any).recurrence_count ?? undefined,
    recurrence_end_date: (row as any).recurrence_end_date || undefined,
    recurrence_group_id: (row as any).recurrence_group_id || undefined,
    installment_number: (row as any).installment_number ?? undefined,
    installment_total: (row as any).installment_total ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
};

export const saveContaPagar = async (conta: Omit<ContaPagar, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ContaPagar> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const { data, error } = await supabase
    .from('contas_pagar')
    .insert({
      user_id: user.id,
      credor_id: conta.credor_id,
      descricao: conta.descricao,
      categoria: conta.categoria,
      valor: conta.valor,
      data_vencimento: conta.data_vencimento,
      status: conta.status,
      forma_pagamento: conta.forma_pagamento,
      data_pagamento: conta.data_pagamento,
      observacoes: conta.observacoes,
      comprovante_url: conta.comprovante_url,
      boleto_url: conta.boleto_url,
      mes_referencia: conta.mes_referencia,
    })
    .select()
    .single();

  if (error) throw error;
  
  return {
    id: data.id,
    user_id: data.user_id,
    credor_id: data.credor_id,
    descricao: data.descricao,
    categoria: data.categoria as ContaPagar['categoria'],
    valor: Number(data.valor),
    data_vencimento: data.data_vencimento,
    status: data.status as ContaPagar['status'],
    forma_pagamento: data.forma_pagamento || undefined,
    data_pagamento: data.data_pagamento || undefined,
    observacoes: data.observacoes || undefined,
    comprovante_url: data.comprovante_url || undefined,
    boleto_url: data.boleto_url || undefined,
    mes_referencia: data.mes_referencia || undefined,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
};

export const updateContaPagar = async (id: string, conta: Partial<Omit<ContaPagar, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<void> => {
  const { error } = await supabase
    .from('contas_pagar')
    .update(conta)
    .eq('id', id);

  if (error) throw error;
};

export const deleteContaPagar = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('contas_pagar')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export interface JurosPago {
  id: string;
  conta_pagar_id: string;
  credor_id?: string;
  descricao?: string;
  categoria?: string;
  valor_original: number;
  valor_pago: number;
  valor_juros: number;
  data_vencimento?: string;
  data_pagamento: string;
  dias_atraso?: number;
  observacoes?: string;
  created_at: string;
}

/** Registra o valor pago acima do previsto (juros/multa) da conta. */
export const registrarJuros = async (params: {
  conta: ContaPagar;
  valorJuros: number;
  valorPago: number;
  dataPagamento: string;
  observacoes?: string;
}): Promise<void> => {
  if (!params.valorJuros || params.valorJuros <= 0.001) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  const venc = params.conta.data_vencimento;
  let diasAtraso: number | null = null;
  if (venc) {
    const [vy, vm, vd] = venc.split('-').map(Number);
    const [py, pm, pd] = params.dataPagamento.split('-').map(Number);
    const diff = Math.round(
      (new Date(py, pm - 1, pd).getTime() - new Date(vy, vm - 1, vd).getTime()) / 86400000
    );
    diasAtraso = diff > 0 ? diff : 0;
  }

  const { error } = await supabase.from('contas_pagar_juros').insert({
    user_id: user.id,
    conta_pagar_id: params.conta.id,
    credor_id: params.conta.credor_id,
    descricao: params.conta.descricao,
    categoria: params.conta.categoria,
    valor_original: params.conta.valor_total ?? params.conta.valor ?? 0,
    valor_pago: params.valorPago,
    valor_juros: params.valorJuros,
    data_vencimento: venc || null,
    data_pagamento: params.dataPagamento,
    dias_atraso: diasAtraso,
    observacoes: params.observacoes || null,
  });
  if (error) throw error;
};

/** Juros pagos no período (datas no formato YYYY-MM-DD). */
export const getJurosPagos = async (inicio?: string, fim?: string): Promise<JurosPago[]> => {
  let query = supabase.from('contas_pagar_juros').select('*').order('data_pagamento', { ascending: false });
  if (inicio) query = query.gte('data_pagamento', inicio);
  if (fim) query = query.lte('data_pagamento', fim);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row: any) => ({
    ...row,
    valor_original: Number(row.valor_original),
    valor_pago: Number(row.valor_pago),
    valor_juros: Number(row.valor_juros),
  })) as JurosPago[];
};

export const confirmarPagamento = async (
  id: string, 
  dataPagamento: string, 
  formaPagamento: string,
  valorPago: number,
  valorTotal: number,
  observacoes?: string
): Promise<void> => {
  const novoValorPago = valorPago;
  const valorRestante = valorTotal - novoValorPago;
  const isPagamentoIntegral = valorRestante <= 0.01;

  if (isPagamentoIntegral) {
    // Pagamento integral
    const { error } = await supabase
      .from('contas_pagar')
      .update({
        status: 'pago',
        data_pagamento: dataPagamento,
        forma_pagamento: formaPagamento,
        valor_pago: valorTotal,
        valor_total: valorTotal,
        valor: 0,
        observacoes: observacoes,
      })
      .eq('id', id);

    if (error) throw error;
  } else {
    // Pagamento parcial - mantém pendente com saldo restante
    const { data: conta } = await supabase
      .from('contas_pagar')
      .select('valor_pago, valor_total, valor, observacoes')
      .eq('id', id)
      .single();

    const valorPagoAnterior = conta?.valor_pago ? Number(conta.valor_pago) : 0;
    const novoTotalPago = valorPagoAnterior + valorPago;
    const novoValorRestante = valorTotal - novoTotalPago;
    const isAgoraPagoIntegral = novoValorRestante <= 0.01;

    const notaPagamento = `Pagamento parcial em ${dataPagamento}: R$ ${valorPago.toFixed(2).replace('.', ',')} via ${formaPagamento}`;
    const novasObservacoes = observacoes 
      ? `${conta?.observacoes ? conta.observacoes + ' | ' : ''}${notaPagamento}. ${observacoes}`
      : `${conta?.observacoes ? conta.observacoes + ' | ' : ''}${notaPagamento}`;

    const { error } = await supabase
      .from('contas_pagar')
      .update({
        status: isAgoraPagoIntegral ? 'pago' : 'pendente',
        data_pagamento: isAgoraPagoIntegral ? dataPagamento : null,
        forma_pagamento: formaPagamento,
        valor_pago: novoTotalPago,
        valor_total: valorTotal,
        valor: isAgoraPagoIntegral ? 0 : novoValorRestante,
        observacoes: novasObservacoes,
      })
      .eq('id', id);

    if (error) throw error;
  }
};

/** Reverte a baixa (integral ou parcial) da conta, voltando-a para pendente com o valor original. */
export const reverterPagamento = async (conta: ContaPagar): Promise<void> => {
  const valorOriginal = Number(conta.valor_total ?? 0) > 0
    ? Number(conta.valor_total)
    : Number(conta.valor || 0) + Number(conta.valor_pago || 0);
  const nota = `Pagamento revertido em ${new Date().toLocaleDateString('pt-BR')}`;
  const { error } = await supabase
    .from('contas_pagar')
    .update({
      status: 'pendente',
      data_pagamento: null,
      forma_pagamento: null,
      valor_pago: 0,
      valor: valorOriginal,
      valor_total: valorOriginal,
      observacoes: conta.observacoes ? `${conta.observacoes} | ${nota}` : nota,
    })
    .eq('id', conta.id);
  if (error) throw error;
  await supabase.from('contas_pagar_juros').delete().eq('conta_pagar_id', conta.id);
};

// ===== Recorrência: operações em grupo =====

/**
 * Retorna os lançamentos futuros (mesma data ou posteriores) do mesmo grupo
 * de recorrência que ainda NÃO foram pagos.
 */
export const getFutureRecurrenceContas = async (
  groupId: string,
  fromDate: string,
  excludeId?: string
): Promise<ContaPagar[]> => {
  const { data, error } = await supabase
    .from('contas_pagar')
    .select('*')
    .eq('recurrence_group_id', groupId)
    .gte('data_vencimento', fromDate)
    .neq('status', 'pago')
    .order('data_vencimento');

  if (error) throw error;

  return (data || [])
    .filter((row: any) => (excludeId ? row.id !== excludeId : true))
    .map((row: any) => ({
      ...row,
      valor: Number(row.valor),
      valor_pago: row.valor_pago ? Number(row.valor_pago) : undefined,
      valor_total: row.valor_total ? Number(row.valor_total) : undefined,
    })) as ContaPagar[];
};

/** Exclui este lançamento e os próximos do grupo (nunca os já pagos). */
export const deleteRecurrenceFromHere = async (conta: ContaPagar): Promise<number> => {
  if (!conta.recurrence_group_id) {
    await deleteContaPagar(conta.id);
    return 1;
  }
  const futuros = await getFutureRecurrenceContas(
    conta.recurrence_group_id,
    conta.data_vencimento,
    conta.id
  );
  const ids = [conta.id, ...futuros.map(c => c.id)];

  const { error } = await supabase
    .from('contas_pagar')
    .delete()
    .in('id', ids)
    .neq('status', 'pago');

  if (error) throw error;
  return ids.length;
};

/** Atualiza este lançamento e os próximos do grupo (nunca os já pagos). */
export const updateRecurrenceFromHere = async (
  conta: ContaPagar,
  updates: Partial<Omit<ContaPagar, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<number> => {
  if (!conta.recurrence_group_id) {
    await updateContaPagar(conta.id, updates);
    return 1;
  }

  const futuros = await getFutureRecurrenceContas(
    conta.recurrence_group_id,
    conta.data_vencimento,
    conta.id
  );
  const ids = futuros.map(c => c.id);

  // O lançamento atual recebe todas as alterações (inclusive data/descrição)
  await updateContaPagar(conta.id, updates);

  if (ids.length > 0) {
    // Nos próximos, não alteramos data de vencimento nem status/pagamento
    const {
      data_vencimento,
      data_pagamento,
      status,
      boleto_url,
      ...comuns
    } = updates as any;

    if (Object.keys(comuns).length > 0) {
      const { error } = await supabase
        .from('contas_pagar')
        .update(comuns)
        .in('id', ids)
        .neq('status', 'pago');
      if (error) throw error;
    }
  }

  return ids.length + 1;
};
