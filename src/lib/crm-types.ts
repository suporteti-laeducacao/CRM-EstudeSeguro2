export interface Cliente {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  empresa?: string;
  nivel_ensino?: string;
  curso?: string;
  vendedor_id?: string;
  vendedor?: { nome: string };
  promessa_certificacao?: string;
  previsao_certificacao?: string;
  notas?: string;
  created_at?: string;
}

export interface Negocio {
  id: string;
  curso: string;
  descricao?: string;
  valor?: number;
  status: 'novo' | 'em_andamento' | 'fechado' | 'perdido';
  cliente_id?: string;
  cliente?: Cliente;
  cliente_nome?: string;
  vendedor_id?: string;
  vendedor?: { nome: string };
  telefone?: string;
  data?: string;
  follow_up_1?: string;
  follow_up_2?: string;
  follow_ups?: string[];
  created_at?: string;
}

export interface Atividade {
  id: string;
  tipo: 'ligacao' | 'email' | 'reuniao' | 'tarefa';
  descricao?: string;
  data?: string;
  negocio_id?: string;
  created_at?: string;
}
