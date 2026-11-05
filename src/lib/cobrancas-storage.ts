import { supabase } from '@/integrations/supabase/client';

/**
 * Gestão de Cobranças — camada de serviço.
 * O Financeiro continua sendo a fonte oficial das parcelas; aqui só
 * referenciamos vendas/parcelas/alunos existentes.
 * Toda regra (régua, parcela de referência, estados) roda no banco via RPC,
 * com checagem de cargo (Admin, Financeiro, Gerente) dentro de cada função.
 */

export type SituacaoOperacional = 'hoje' | 'atrasados' | 'agendados' | 'sem_agendamento' | 'encerrada';
export type TipoInteracao = 'cobranca' | 'retorno' | 'observacao';
export type CanalCobranca = 'whatsapp' | 'email' | 'phone' | 'sms' | 'presencial' | 'outro';
export type TipoAcaoEspecial = 'inativacao' | 'aviso_negativacao' | 'negativacao';
export type StatusAcaoEspecial = 'pendente' | 'confirmada' | 'suspensa' | 'cancelada';

export const COBRANCA_ROLES = ['admin', 'financeiro', 'gerente'] as const;
export const COBRANCA_HISTORICO_GERAL_ROLES = ['admin', 'gerente'] as const;

export const canAccessCobranca = (roles: string[]) => roles.some(r => (COBRANCA_ROLES as readonly string[]).includes(r));
export const canViewHistoricoGeral = (roles: string[]) =>
  roles.some(r => (COBRANCA_HISTORICO_GERAL_ROLES as readonly string[]).includes(r));

const db = supabase as any;

const unwrap = <T>(res: { data: T; error: any }): T => {
  if (res.error) throw res.error;
  return res.data;
};

export const sincronizarCobrancas = async (): Promise<number> =>
  unwrap(await db.rpc('cobranca_sincronizar')) as number;

export const getPainelCobrancas = async (situacao?: SituacaoOperacional) => {
  const all: any[] = [];
  let from = 0;
  while (true) {
    let q = db.from('cobrancas_painel').select('*').order('proxima_acao_em', { ascending: true, nullsFirst: false }).range(from, from + 999);
    if (situacao) q = q.eq('situacao_operacional', situacao);
    const data = unwrap(await q) as any[];
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
};

export const getCobranca = async (id: string) =>
  unwrap(await db.from('cobrancas_painel').select('*').eq('id', id).maybeSingle());

export const getHistoricoCobranca = async (cobrancaId: string) => {
  const [eventos, interacoes, promessas, renegociacoes, agendamentos, acoes] = await Promise.all([
    db.rpc('cobranca_historico', { _cobranca: cobrancaId }),
    db.from('collection_attempts').select('*').eq('cobranca_id', cobrancaId).order('date', { ascending: false }),
    db.from('cobranca_promessas').select('*').eq('cobranca_id', cobrancaId).order('created_at', { ascending: false }),
    db.from('cobranca_renegociacoes').select('*').eq('cobranca_id', cobrancaId).order('created_at', { ascending: false }),
    db.from('cobranca_agendamentos').select('*').eq('cobranca_id', cobrancaId).order('data', { ascending: false }),
    db.from('cobranca_acoes_especiais').select('*').eq('cobranca_id', cobrancaId).order('created_at', { ascending: false }),
  ]);
  return {
    eventos: unwrap(eventos), interacoes: unwrap(interacoes), promessas: unwrap(promessas),
    renegociacoes: unwrap(renegociacoes), agendamentos: unwrap(agendamentos), acoes: unwrap(acoes),
  };
};

export const registrarInteracao = async (cobrancaId: string, tipo: TipoInteracao, canal: CanalCobranca, resultado: string, observacao?: string) =>
  unwrap(await db.rpc('cobranca_registrar_interacao', {
    _cobranca: cobrancaId, _tipo: tipo, _canal: canal, _resultado: resultado, _observacao: observacao ?? null,
  })) as string;

export const registrarPromessa = async (cobrancaId: string, data: string, valor?: number, observacao?: string, parcelas?: string[]) =>
  unwrap(await db.rpc('cobranca_registrar_promessa', {
    _cobranca: cobrancaId, _data: data, _valor: valor ?? null, _observacao: observacao ?? null, _parcelas: parcelas?.length ? parcelas : null,
  })) as string;

export const registrarRenegociacao = async (cobrancaId: string, inicio: string, suspensaAte: string | null, observacao?: string) =>
  unwrap(await db.rpc('cobranca_registrar_renegociacao', {
    _cobranca: cobrancaId, _inicio: inicio, _suspensa_ate: suspensaAte, _observacao: observacao ?? null,
  })) as string;

export const agendarManual = async (cobrancaId: string, data: string, tipo = 'contato', motivo?: string) =>
  unwrap(await db.rpc('cobranca_agendar_manual', { _cobranca: cobrancaId, _data: data, _tipo: tipo, _motivo: motivo ?? null })) as string;

export const cancelarAgendamento = async (agendamentoId: string, motivo: string) =>
  unwrap(await db.rpc('cobranca_cancelar_agendamento', { _agendamento: agendamentoId, _motivo: motivo }));

export const registrarAcaoEspecial = async (cobrancaId: string, tipo: TipoAcaoEspecial, status: StatusAcaoEspecial, observacao?: string) =>
  unwrap(await db.rpc('cobranca_acao_especial', { _cobranca: cobrancaId, _tipo: tipo, _status: status, _observacao: observacao ?? null })) as string;

export const encerrarCobranca = async (cobrancaId: string, motivo: string) =>
  unwrap(await db.rpc('cobranca_encerrar', { _cobranca: cobrancaId, _motivo: motivo }));

export const reabrirCobranca = async (cobrancaId: string, motivo: string) =>
  unwrap(await db.rpc('cobranca_reabrir', { _cobranca: cobrancaId, _motivo: motivo }));

export const recalcularCobranca = async (cobrancaId: string) =>
  unwrap(await db.rpc('cobranca_recalcular', { _id: cobrancaId }));

export const getReguaEtapas = async () =>
  unwrap(await db.from('cobranca_regua_etapas').select('*').order('offset_dias'));

export const resolverPromessa = async (cobrancaId: string, acao: 'pago' | 'nao_pagou', observacao?: string) =>
  unwrap(await db.rpc('cobranca_resolver_promessa', { _cobranca: cobrancaId, _acao: acao, _observacao: observacao ?? null }));

export const resolverRenegociacao = async (cobrancaId: string, acao: 'regularizado' | 'nao_regularizado', observacao?: string) =>
  unwrap(await db.rpc('cobranca_resolver_renegociacao', { _cobranca: cobrancaId, _acao: acao, _observacao: observacao ?? null }));

export const getParcelasAbertas = async (saleId: string) =>
  unwrap(await db.from('installments').select('id, installment_number, due_date, value, status').eq('sale_id', saleId)
    .in('status', ['pending', 'due_today', 'overdue']).order('due_date')) as { id: string; installment_number: number; due_date: string; value: number }[];
