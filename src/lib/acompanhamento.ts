/**
 * Régua de acompanhamento ativo — motor determinístico.
 * Todo alerta é calculado na leitura (nenhum job agendado).
 */

export type Marco = 'D-30' | 'D-15' | 'D-7' | 'D-3' | 'D-0' | 'VENCIDO';
export type Prioridade = 'atencao' | 'alta' | 'critica' | 'vencido';

export type ResultadoContato =
  | 'tudo_certo_concluindo'
  | 'precisa_de_ajuda'
  | 'dificuldade_academica'
  | 'dificuldade_financeira'
  | 'sem_retorno'
  | 'numero_invalido'
  | 'desistiu'
  | 'ja_concluiu'
  | 'prazo_prorrogado';

export const RESULTADO_LABELS: Record<ResultadoContato, string> = {
  tudo_certo_concluindo: 'Tudo certo, concluindo',
  precisa_de_ajuda: 'Precisa de ajuda',
  dificuldade_academica: 'Dificuldade acadêmica',
  dificuldade_financeira: 'Dificuldade financeira',
  sem_retorno: 'Sem retorno',
  numero_invalido: 'Número inválido',
  desistiu: 'Desistiu',
  ja_concluiu: 'Já concluiu',
  prazo_prorrogado: 'Prazo prorrogado',
};

export const CANAIS = ['whatsapp', 'telefone', 'email', 'presencial'] as const;
export type Canal = (typeof CANAIS)[number];

export const CANAL_LABELS: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  email: 'E-mail',
  presencial: 'Presencial',
};

/** Resultados que exigem agendar o próximo contato e ligam o acompanhamento especial. */
export const RESULTADOS_ESPECIAIS: ResultadoContato[] = [
  'precisa_de_ajuda',
  'dificuldade_academica',
  'dificuldade_financeira',
];

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  vencido: 'Vencido',
  critica: 'Crítica',
  alta: 'Alta',
  atencao: 'Atenção',
};

export const PRIORIDADE_ORDER: Prioridade[] = ['vencido', 'critica', 'alta', 'atencao'];

export const MARCOS_ORDEM: Marco[] = ['D-30', 'D-15', 'D-7', 'D-3', 'D-0'];

export interface ContatoAcompanhamento {
  id: string;
  sale_id: string | null;
  aluno_id: string | null;
  aluno_nome: string;
  vendedor_id: string | null;
  marco: string;
  data_prevista_conclusao: string | null;
  dias_restantes_no_contato: number | null;
  data_contato: string;
  canal: string;
  resultado: string;
  observacao: string | null;
  proximo_contato_em: string | null;
  criado_por: string | null;
  created_at: string;
}

export interface MatriculaMonitorada {
  saleId: string;
  alunoId?: string | null;
  alunoNome: string;
  curso: string;
  nivel?: string | null;
  telefone?: string | null;
  email?: string | null;
  vendedorId?: string | null;
  vendedorNome?: string | null;
  previsaoConclusao: string;
  cancelado?: boolean;
}

export interface AlertaAcompanhamento extends MatriculaMonitorada {
  diasRestantes: number;
  marcoAtual: Marco | null;
  prioridade: Prioridade | null;
  pendente: boolean;
  adiadoAte?: string | null;
  foraDaRegua: boolean;
  acompanhamentoEspecial: boolean;
  marcosContatados: Marco[];
  contatos: ContatoAcompanhamento[];
}

/** Data de hoje (America/Sao_Paulo) em formato YYYY-MM-DD. */
export const todayISO = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const toUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Diferença em dias inteiros entre duas datas YYYY-MM-DD (b − a). */
export const diffDays = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86_400_000);

export const addDays = (iso: string, days: number) => {
  const d = new Date(toUTC(iso) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
};

export const marcoDe = (diasRestantes: number): Marco | null => {
  if (diasRestantes < 0) return 'VENCIDO';
  if (diasRestantes === 0) return 'D-0';
  if (diasRestantes <= 3) return 'D-3';
  if (diasRestantes <= 7) return 'D-7';
  if (diasRestantes <= 15) return 'D-15';
  if (diasRestantes <= 30) return 'D-30';
  return null;
};

export const prioridadeDe = (marco: Marco | null): Prioridade | null => {
  if (!marco) return null;
  if (marco === 'VENCIDO') return 'vencido';
  if (marco === 'D-0' || marco === 'D-3') return 'critica';
  if (marco === 'D-7') return 'alta';
  return 'atencao';
};

export const PRIORIDADE_CLASSES: Record<Prioridade, { bar: string; badge: string }> = {
  vencido: { bar: 'bg-[#7F1D1D]', badge: 'bg-[#7F1D1D] text-white' },
  critica: { bar: 'bg-destructive', badge: 'bg-destructive text-destructive-foreground' },
  alta: { bar: 'bg-warning', badge: 'bg-warning text-white' },
  atencao: { bar: 'bg-ink-400', badge: 'bg-ink-100 text-ink-700' },
};

export const seloDe = (dias: number) => {
  if (dias < 0) return `Vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
  if (dias === 0) return 'Vence HOJE';
  return `Faltam ${dias} dia${dias === 1 ? '' : 's'} para concluir`;
};

export interface ReguaOptions {
  hoje?: string;
  diasReincidenciaSemRetorno?: number;
}

/**
 * Calcula o alerta de uma matrícula a partir do histórico de contatos.
 * Regras: um alerta por marco; exceções de sem retorno, saída definitiva e adiamento.
 */
export const calcularAlerta = (
  m: MatriculaMonitorada,
  contatos: ContatoAcompanhamento[],
  opts: ReguaOptions = {}
): AlertaAcompanhamento => {
  const hoje = opts.hoje || todayISO();
  const reincidencia = opts.diasReincidenciaSemRetorno ?? 2;

  const ordenados = [...contatos].sort((a, b) =>
    a.data_contato === b.data_contato
      ? a.created_at.localeCompare(b.created_at)
      : a.data_contato.localeCompare(b.data_contato)
  );

  const diasRestantes = diffDays(hoje, m.previsaoConclusao);
  const marcoAtual = marcoDe(diasRestantes);
  const prioridade = prioridadeDe(marcoAtual);

  const foraDaRegua = ordenados.some(
    (c) => c.resultado === 'ja_concluiu' || c.resultado === 'desistiu'
  );

  const doMarco = marcoAtual ? ordenados.filter((c) => c.marco === marcoAtual) : [];
  const ultimoDoMarco = doMarco[doMarco.length - 1];
  const ultimo = ordenados[ordenados.length - 1];

  let pendente = !!marcoAtual && !foraDaRegua && !ultimoDoMarco;

  // Exceção 1 — sem retorno / número inválido reabre o alerta após N dias
  if (
    !pendente &&
    marcoAtual &&
    !foraDaRegua &&
    ultimoDoMarco &&
    (ultimoDoMarco.resultado === 'sem_retorno' || ultimoDoMarco.resultado === 'numero_invalido') &&
    diffDays(ultimoDoMarco.data_contato, hoje) >= reincidencia
  ) {
    pendente = true;
  }

  // Adiamento — próximo contato agendado para o futuro tira da fila de hoje
  const adiadoAte =
    ultimo?.proximo_contato_em && ultimo.proximo_contato_em > hoje ? ultimo.proximo_contato_em : null;
  if (adiadoAte) pendente = false;

  const especialAberto = (() => {
    for (let i = ordenados.length - 1; i >= 0; i--) {
      const r = ordenados[i].resultado as ResultadoContato;
      if (r === 'tudo_certo_concluindo' || r === 'ja_concluiu') return false;
      if (RESULTADOS_ESPECIAIS.includes(r)) return true;
    }
    return false;
  })();

  return {
    ...m,
    diasRestantes,
    marcoAtual,
    prioridade,
    pendente,
    adiadoAte,
    foraDaRegua,
    acompanhamentoEspecial: especialAberto && !foraDaRegua,
    marcosContatados: Array.from(new Set(ordenados.map((c) => c.marco))) as Marco[],
    contatos: ordenados.slice().reverse(),
  };
};

/** Vencidos primeiro, depois menor número de dias restantes. */
export const ordenarFila = (a: AlertaAcompanhamento, b: AlertaAcompanhamento) =>
  a.diasRestantes - b.diasRestantes;

export const ROTEIRO: Record<Marco, string[]> = {
  'D-30': [
    'Como está o andamento das disciplinas?',
    'Tem alguma matéria travando?',
    'Precisa de material de apoio ou orientação da coordenação?',
  ],
  'D-15': [
    'Faltam 15 dias — o que ainda falta para você concluir?',
    'Já enviou toda a documentação?',
    'Posso agendar um suporte com a coordenação?',
  ],
  'D-7': [
    'Vamos garantir sua conclusão: o que falta exatamente?',
    'Confirmar dados para emissão do certificado',
    'Alinhar prazo real com o aluno',
  ],
  'D-3': [
    'Vamos garantir sua conclusão: o que falta exatamente?',
    'Confirmar dados para emissão do certificado',
    'Alinhar prazo real com o aluno',
  ],
  'D-0': [
    'Entender o motivo',
    'Verificar possibilidade de prorrogação',
    'Registrar decisão do aluno',
  ],
  VENCIDO: [
    'Entender o motivo',
    'Verificar possibilidade de prorrogação',
    'Registrar decisão do aluno',
  ],
};
