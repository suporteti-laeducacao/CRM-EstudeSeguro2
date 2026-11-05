import { supabase } from '@/integrations/supabase/client';
import {
  AlertaAcompanhamento,
  Canal,
  ContatoAcompanhamento,
  MatriculaMonitorada,
  ResultadoContato,
  calcularAlerta,
  ordenarFila,
  todayISO,
} from './acompanhamento';

interface SaleRow {
  id: string;
  student_name: string;
  course: string;
  course_levels: string[] | null;
  vendedor_id: string | null;
  seller: string | null;
  previsao_conclusao: string | null;
  status: string | null;
  aluno_inativado_inadimplencia: boolean | null;
}

const pageAll = async <T,>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> => {
  const all: T[] = [];
  const size = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await run(from, from + size - 1);
    if (error) throw error;
    const rows = data || [];
    all.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return all;
};

export interface ReguaData {
  alertas: AlertaAcompanhamento[];
  cancelados: AlertaAcompanhamento[];
  totalMatriculasAtivas: number;
  semPrevisao: number;
  semVendedor: number;
  hoje: string;
}

/** Carrega a régua inteira (matrículas monitoradas + histórico de contatos). */
export const carregarRegua = async (): Promise<ReguaData> => {
  const hoje = todayISO();

  const [sales, contatos, students, vendedores] = await Promise.all([
    pageAll<SaleRow>((from, to) =>
      supabase
        .from('sales')
        .select(
          'id, student_name, course, course_levels, vendedor_id, seller, previsao_conclusao, status, aluno_inativado_inadimplencia'
        )
        .range(from, to) as never
    ),
    pageAll<ContatoAcompanhamento>((from, to) =>
      supabase.from('acompanhamento_contatos').select('*').range(from, to) as never
    ),
    pageAll<{ id: string; full_name: string; phone: string | null; email: string | null }>(
      (from, to) =>
        supabase.from('students').select('id, full_name, phone, email').range(from, to) as never
    ),
    supabase.from('vendedores').select('id, nome').then((r) => (r.data || []) as { id: string; nome: string }[]),
  ]);

  const studentByName = new Map<string, { id: string; phone: string | null; email: string | null }>();
  students.forEach((s) => {
    const key = (s.full_name || '').trim().toLowerCase();
    if (key && !studentByName.has(key)) studentByName.set(key, { id: s.id, phone: s.phone, email: s.email });
  });

  const vendedorNome = new Map(vendedores.map((v) => [v.id, v.nome]));

  const ativas = sales.filter(
    (s) => s.status !== 'cancelada' && !s.aluno_inativado_inadimplencia
  );

  const contatosPorSale = new Map<string, ContatoAcompanhamento[]>();
  contatos.forEach((c) => {
    const key = c.sale_id || `nome:${c.aluno_nome}`;
    const list = contatosPorSale.get(key) || [];
    list.push(c);
    contatosPorSale.set(key, list);
  });

  const montar = (s: SaleRow, cancelado: boolean) => {
    const aluno = studentByName.get((s.student_name || '').trim().toLowerCase());
    const m: MatriculaMonitorada = {
      saleId: s.id,
      alunoId: aluno?.id || null,
      alunoNome: s.student_name,
      curso: s.course,
      nivel: s.course_levels?.[0] || null,
      telefone: aluno?.phone || null,
      email: aluno?.email || null,
      vendedorId: s.vendedor_id,
      vendedorNome: (s.vendedor_id && vendedorNome.get(s.vendedor_id)) || s.seller || null,
      previsaoConclusao: s.previsao_conclusao as string,
      cancelado,
    };
    return calcularAlerta(m, contatosPorSale.get(s.id) || [], { hoje });
  };

  const alertas = ativas
    .filter((s) => !!s.previsao_conclusao)
    .map((s) => montar(s, false))
    .sort(ordenarFila);

  const cancelados = sales
    .filter(
      (s) =>
        !!s.previsao_conclusao &&
        (s.status === 'cancelada' || !!s.aluno_inativado_inadimplencia)
    )
    .map((s) => montar(s, true))
    .sort(ordenarFila);

  return {
    alertas,
    cancelados,
    totalMatriculasAtivas: ativas.length,
    semPrevisao: ativas.filter((s) => !s.previsao_conclusao).length,
    semVendedor: ativas.filter((s) => !s.vendedor_id).length,
    hoje,
  };
};

export interface NovoContato {
  alerta: AlertaAcompanhamento;
  canal: Canal;
  resultado: ResultadoContato;
  observacao?: string;
  proximoContatoEm?: string;
}

export const registrarContato = async ({
  alerta,
  canal,
  resultado,
  observacao,
  proximoContatoEm,
}: NovoContato) => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const { error } = await supabase.from('acompanhamento_contatos').insert({
    aluno_id: alerta.alunoId || null,
    sale_id: alerta.saleId,
    aluno_nome: alerta.alunoNome,
    vendedor_id: alerta.vendedorId || null,
    marco: alerta.marcoAtual || 'VENCIDO',
    data_prevista_conclusao: alerta.previsaoConclusao,
    dias_restantes_no_contato: alerta.diasRestantes,
    data_contato: todayISO(),
    canal,
    resultado,
    observacao: observacao || null,
    proximo_contato_em: proximoContatoEm || null,
    criado_por: user.id,
  } as never);
  if (error) throw error;
};

/** Atualiza a previsão de conclusão da matrícula (resultado `prazo_prorrogado`). */
export const atualizarPrevisao = async (saleId: string, novaPrevisao: string) => {
  const { error } = await supabase
    .from('sales')
    .update({ previsao_conclusao: novaPrevisao } as never)
    .eq('id', saleId);
  if (error) throw error;
};
