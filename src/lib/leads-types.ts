export type LeadStatus = 
  | 'novo' 
  | 'em_conversa' 
  | 'potencial' 
  | 'rechamada'
  | 'matriculado' 
  | 'reciclagem'
  | 'perdido';

export type LeadOrigem =
  | 'indicacao_externa'
  | 'indicacao_interna'
  | 'indicacao_la'
  | 'organico'
  | 'trafego_pago';

export interface Lead {
  id: string;
  user_id: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  curso_interesse?: string;
  valor_estimado?: number;
  origem: LeadOrigem;
  status: LeadStatus;
  vendedor_id?: string;
  sunchat_id?: string;
  tags?: string[];
  arquivado: boolean;
  data_entrada: string;
  created_at: string;
  updated_at: string;
}

export interface LeadHistory {
  id: string;
  lead_id: string;
  user_id: string;
  status_anterior?: string;
  status_novo: string;
  observacao?: string;
  created_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  user_id: string;
  conteudo: string;
  created_at: string;
}

export interface LeadMessage {
  id: string;
  lead_id: string;
  sunchat_message_id?: string;
  remetente: string;
  conteudo: string;
  data_mensagem: string;
  created_at: string;
}

export interface LeadTask {
  id: string;
  lead_id: string;
  user_id: string;
  titulo: string;
  descricao?: string;
  data_vencimento?: string;
  concluida: boolean;
  cancelada?: boolean;
  tipo?: string | null;
  rechamada_ordem?: number | null;
  rechamada_ciclo?: number | null;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at: string;
}

export const RECHAMADA_TASKS: { ordem: number; titulo: string; dias: number }[] = [
  { ordem: 2, titulo: 'Rechamada 2 - Texto ou Áudio', dias: 1 },
  { ordem: 3, titulo: 'Rechamada 3 - Texto ou Áudio', dias: 2 },
  { ordem: 4, titulo: 'Rechamada 4 - Oportunidade', dias: 6 },
  { ordem: 5, titulo: 'Rechamada 5 - Texto', dias: 9 },
  { ordem: 6, titulo: 'Rechamada 6 - Mídia (Vídeo / Imagem)', dias: 15 },
  { ordem: 7, titulo: 'Rechamada 7 - Ameaça de Finalização', dias: 20 },
  { ordem: 8, titulo: 'Rechamada 8 - Despedida (mover para reciclagem após enviar)', dias: 30 },
];

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string }> = {
  novo: { label: 'Novo Lead', color: 'text-ink-700', bgColor: 'bg-ink-100' },
  em_conversa: { label: 'Em Conversa', color: 'text-ink-800', bgColor: 'bg-ink-200' },
  potencial: { label: 'Potencial', color: 'text-brand-ink', bgColor: 'bg-brand-tint' },
  rechamada: { label: 'Rechamada', color: 'text-[#B44309]', bgColor: 'bg-[#FFF1E7]' },
  matriculado: { label: 'Matriculados', color: 'text-[#07714E]', bgColor: 'bg-[#E7F7F0]' },
  reciclagem: { label: 'Reciclagem', color: 'text-[#B44309]', bgColor: 'bg-[#FFF1E7]' },
  perdido: { label: 'Perdidos', color: 'text-[#B02121]', bgColor: 'bg-[#FDECEC]' },
};

export const LEAD_ORIGEM_CONFIG: Record<LeadOrigem, { label: string; icon: string }> = {
  indicacao_externa: { label: 'Indicação Externa', icon: 'Users' },
  indicacao_interna: { label: 'Indicação Interna', icon: 'Users' },
  indicacao_la: { label: 'Indicação LA', icon: 'Users' },
  organico: { label: 'Orgânico', icon: 'Globe' },
  trafego_pago: { label: 'Tráfego Pago', icon: 'Megaphone' },
};

export const KANBAN_COLUMNS: LeadStatus[] = [
  'novo',
  'em_conversa',
  'potencial',
  'rechamada',
  'matriculado',
  'reciclagem',
  'perdido',
];
