export interface Credor {
  id: string;
  user_id: string;
  nome: string;
  tipo: 'vendedor' | 'administrativo' | 'fornecedor' | 'outros';
  status: 'ativo' | 'inativo';
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContaPagar {
  id: string;
  user_id: string;
  credor_id: string;
  descricao: string;
  categoria: string; // Pode ser uma das predefinidas ou personalizada
  valor: number;
  valor_pago?: number;
  valor_total?: number;
  data_vencimento: string;
  status: 'pendente' | 'pago' | 'atrasado';
  forma_pagamento?: string;
  data_pagamento?: string;
  observacoes?: string;
  comprovante_url?: string;
  boleto_url?: string;
  mes_referencia?: string; // formato "YYYY-MM", usado para comissão/salário
  recurrence_type?: 'none' | 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';
  recurrence_interval?: number;
  recurrence_unit?: 'day' | 'month' | 'year';
  recurrence_end_type?: 'count' | 'date' | 'never';
  recurrence_count?: number;
  recurrence_end_date?: string;
  recurrence_group_id?: string;
  installment_number?: number;
  installment_total?: number;
  created_at: string;
  updated_at: string;
}


export type TipoCredor = Credor['tipo'];
export type StatusCredor = Credor['status'];
export type CategoriaContaPagar = string;
export type StatusContaPagar = ContaPagar['status'];

export const TIPOS_CREDOR: { value: TipoCredor; label: string }[] = [
  { value: 'vendedor', label: 'Vendedor' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'outros', label: 'Outros' },
];

export const CATEGORIAS_CONTA: { value: CategoriaContaPagar; label: string }[] = [
  { value: 'comissao', label: 'Comissão' },
  { value: 'salario', label: 'Salário' },
  { value: 'vale', label: 'Vale' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'despesa_fixa', label: 'Despesa Fixa' },
  { value: 'despesa_variavel', label: 'Despesa Variável' },
  { value: 'outros', label: 'Outros' },
];

export const FORMAS_PAGAMENTO: { value: string; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'parcelado', label: 'Parcelado' },
  { value: 'outros', label: 'Outros' },
];

export type Recorrencia = 'nenhuma' | 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'personalizada';

export const RECORRENCIAS: { value: Recorrencia; label: string; meses: number }[] = [
  { value: 'nenhuma', label: 'Sem Recorrência', meses: 0 },
  { value: 'mensal', label: 'Mensal', meses: 1 },
  { value: 'trimestral', label: 'Trimestral (3 meses)', meses: 3 },
  { value: 'semestral', label: 'Semestral (6 meses)', meses: 6 },
  { value: 'anual', label: 'Anual (12 meses)', meses: 12 },
  { value: 'personalizada', label: 'Personalizada', meses: 0 },
];

export const RECORRENCIA_DB_TYPE: Record<Recorrencia, NonNullable<ContaPagar['recurrence_type']>> = {
  nenhuma: 'none',
  mensal: 'monthly',
  trimestral: 'quarterly',
  semestral: 'semiannual',
  anual: 'annual',
  personalizada: 'custom',
};

