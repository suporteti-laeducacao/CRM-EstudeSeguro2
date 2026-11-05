import { supabase } from '@/integrations/supabase/client';

export type CertificacaoStatus =
  | 'pendente_documentos'
  | 'em_analise'
  | 'enviado_certificadora'
  | 'em_processamento'
  | 'certificado_emitido'
  | 'entregue'
  | 'cancelada';

export type ResultadoContato =
  | 'nao_contatado'
  | 'sem_retorno'
  | 'sem_interesse'
  | 'interessado'
  | 'matriculado';

export const STATUS_LABELS: Record<CertificacaoStatus, string> = {
  pendente_documentos: 'Pendente de documentos',
  em_analise: 'Em análise',
  enviado_certificadora: 'Enviado à certificadora',
  em_processamento: 'Em processamento',
  certificado_emitido: 'Certificado emitido',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
};

export const STATUS_ORDER: CertificacaoStatus[] = [
  'pendente_documentos',
  'em_analise',
  'enviado_certificadora',
  'em_processamento',
  'certificado_emitido',
  'entregue',
];

export const STATUS_BADGE_CLASS: Record<CertificacaoStatus, string> = {
  pendente_documentos: 'bg-[#FFF1E7] text-[#B44309]',
  em_analise: 'bg-ink-100 text-ink-700',
  em_processamento: 'bg-ink-100 text-ink-700',
  enviado_certificadora: 'bg-ink-200 text-ink-800',
  certificado_emitido: 'bg-[#E7F7F0] text-[#07714E]',
  entregue: 'bg-ink-950 text-white',
  cancelada: 'bg-[#FDECEC] text-[#B02121]',
};

export const RESULTADO_LABELS: Record<ResultadoContato, string> = {
  nao_contatado: 'Não contatado',
  sem_retorno: 'Sem retorno',
  sem_interesse: 'Sem interesse',
  interessado: 'Interessado',
  matriculado: 'Matriculado',
};

export const CANAIS_ENTREGA = ['presencial', 'correios', 'e-mail', 'whatsapp', 'outro'];

export interface Certificacao {
  id: string;
  aluno_id?: string | null;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  certificadora?: string | null;
  nivel_ensino?: string | null;
  curso?: string | null;
  vendedor_id?: string | null;
  notas?: string | null;
  status: CertificacaoStatus;
  data_solicitacao: string;
  data_envio_certificadora?: string | null;
  data_emissao?: string | null;
  data_entrega?: string | null;
  prazo_previsto?: string | null;
  canal_entrega?: string | null;
  apto_nova_oferta: boolean;
  data_ultimo_contato_pos_certificacao?: string | null;
  resultado_contato: ResultadoContato;
  is_segunda_via: boolean;
  motivo_cancelamento?: string | null;
  promessa_certificacao?: string | null;
  previsao_certificacao?: string | null;
  created_at: string;
}

export interface CertificacaoHistorico {
  id: string;
  certificacao_id: string;
  status_anterior: string | null;
  status_novo: string;
  usuario_id: string | null;
  observacao: string | null;
  created_at: string;
}

export const todayISO = () => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
  return fmt.format(new Date());
};

export const isAtrasada = (c: Certificacao) =>
  !!c.prazo_previsto && c.prazo_previsto < todayISO() && c.status !== 'entregue' && c.status !== 'cancelada';

export const getCertificacoes = async (): Promise<Certificacao[]> => {
  const all: Certificacao[] = [];
  let from = 0;
  const size = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('certificacoes')
      .select('*')
      .order('previsao_certificacao', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + size - 1);
    if (error) throw error;
    all.push(...((data || []) as unknown as Certificacao[]));
    if (!data || data.length < size) break;
    from += size;
  }
  return all;
};

export const diasParaConcluir = (c: Certificacao): number | null => {
  const prev = c.previsao_certificacao || c.prazo_previsto;
  if (!prev || c.status === 'entregue' || c.status === 'cancelada') return null;
  const hoje = new Date(todayISO() + 'T12:00:00');
  const fim = new Date(prev + 'T12:00:00');
  return Math.ceil((fim.getTime() - hoje.getTime()) / 86400000);
};

export const saveCertificacao = async (cert: Partial<Certificacao>): Promise<string> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const payload: Record<string, unknown> = {
    aluno_id: cert.aluno_id || null,
    nome: cert.nome,
    email: cert.email || null,
    telefone: cert.telefone || null,
    cpf: cert.cpf || null,
    certificadora: cert.certificadora || null,
    nivel_ensino: cert.nivel_ensino || null,
    curso: cert.curso || null,
    vendedor_id: cert.vendedor_id || null,
    notas: cert.notas || null,
    status: cert.status || 'pendente_documentos',
    data_solicitacao: cert.data_solicitacao || todayISO(),
    data_envio_certificadora: cert.data_envio_certificadora || null,
    data_emissao: cert.data_emissao || null,
    data_entrega: cert.data_entrega || null,
    prazo_previsto: cert.prazo_previsto || null,
    canal_entrega: cert.canal_entrega || null,
    apto_nova_oferta: cert.apto_nova_oferta ?? false,
    data_ultimo_contato_pos_certificacao: cert.data_ultimo_contato_pos_certificacao || null,
    resultado_contato: cert.resultado_contato || 'nao_contatado',
    is_segunda_via: cert.is_segunda_via ?? false,
    motivo_cancelamento: cert.motivo_cancelamento || null,
    promessa_certificacao: cert.promessa_certificacao || null,
    previsao_certificacao: cert.previsao_certificacao || null,
  };

  if (cert.id) {
    const { error } = await supabase.from('certificacoes').update(payload).eq('id', cert.id);
    if (error) throw error;
    return cert.id;
  }

  const { data, error } = await supabase
    .from('certificacoes')
    .insert({ ...payload, user_id: user.id } as never)
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
};

/**
 * Cria (ou atualiza) automaticamente a certificação vinculada a uma venda
 * que possui previsão de conclusão. Idempotente por sale_id.
 */
export const ensureCertificacaoDaVenda = async (params: {
  saleId: string;
  alunoId?: string | null;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  curso?: string | null;
  nivelEnsino?: string | null;
  vendedorId?: string | null;
  dataSolicitacao: string;
  previsaoConclusao?: string | null;
}) => {
  if (!params.previsaoConclusao) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from('certificacoes')
    .select('id, status')
    .eq('sale_id', params.saleId)
    .maybeSingle();

  const base = {
    aluno_id: params.alunoId || null,
    nome: params.nome,
    email: params.email || null,
    telefone: params.telefone || null,
    cpf: params.cpf || null,
    nivel_ensino: params.nivelEnsino || null,
    curso: params.curso || null,
    vendedor_id: params.vendedorId || null,
    prazo_previsto: params.previsaoConclusao,
    previsao_certificacao: params.previsaoConclusao,
  };

  if (existing) {
    const { error } = await supabase
      .from('certificacoes')
      .update(base as never)
      .eq('id', (existing as { id: string }).id);
    if (error) throw error;
    return (existing as { id: string }).id;
  }

  const { data, error } = await supabase
    .from('certificacoes')
    .insert({
      ...base,
      sale_id: params.saleId,
      user_id: user.id,
      status: 'pendente_documentos',
      data_solicitacao: params.dataSolicitacao || todayISO(),
    } as never)
    .select('id')
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
};

// Certificações nunca são excluídas (histórico imutável) — use cancelamento.

export const getHistorico = async (certificacaoId: string): Promise<CertificacaoHistorico[]> => {
  const { data, error } = await supabase
    .from('certificacoes_historico')
    .select('*')
    .eq('certificacao_id', certificacaoId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as CertificacaoHistorico[];
};

/** Aplica as regras de transição de status (Parte B.3) */
export const changeStatus = async (
  cert: Certificacao,
  novo: CertificacaoStatus,
  extra?: { data_entrega?: string; canal_entrega?: string; motivo_cancelamento?: string }
) => {
  const hoje = todayISO();
  const patch: Record<string, unknown> = { status: novo };

  if (novo === 'enviado_certificadora' && !cert.data_envio_certificadora) {
    patch.data_envio_certificadora = hoje;
  }
  if (novo === 'certificado_emitido' && !cert.data_emissao) {
    patch.data_emissao = hoje;
  }
  if (novo === 'entregue') {
    const dataEntrega = extra?.data_entrega || cert.data_entrega;
    const canal = extra?.canal_entrega || cert.canal_entrega;
    if (!dataEntrega || !canal) throw new Error('Informe a data de entrega e o canal de entrega');
    patch.data_entrega = dataEntrega;
    patch.canal_entrega = canal;
    patch.apto_nova_oferta = true;
  }
  if (novo === 'cancelada') {
    const motivo = extra?.motivo_cancelamento || cert.motivo_cancelamento;
    if (!motivo) throw new Error('Informe o motivo do cancelamento');
    patch.motivo_cancelamento = motivo;
  }

  const { error } = await supabase.from('certificacoes').update(patch).eq('id', cert.id);
  if (error) throw error;
};

export const registrarContatoPos = async (
  id: string,
  data: string,
  resultado: ResultadoContato
) => {
  const { error } = await supabase
    .from('certificacoes')
    .update({ data_ultimo_contato_pos_certificacao: data, resultado_contato: resultado })
    .eq('id', id);
  if (error) throw error;
};

/**
 * Cancela a certificação vinculada a uma venda (usado quando a venda é
 * cancelada ou excluída). Idempotente: ignora as já canceladas/entregues.
 */
export const cancelarCertificacaoDaVenda = async (saleId: string, motivo: string) => {
  const { data } = await supabase
    .from('certificacoes')
    .select('id, status')
    .eq('sale_id', saleId);

  const alvos = ((data || []) as { id: string; status: string }[]).filter(
    (c) => c.status !== 'cancelada'
  );
  if (alvos.length === 0) return 0;

  const { error } = await supabase
    .from('certificacoes')
    .update({ status: 'cancelada', motivo_cancelamento: motivo } as never)
    .in('id', alvos.map((c) => c.id));
  if (error) throw error;
  return alvos.length;
};
