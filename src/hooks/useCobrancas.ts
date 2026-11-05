import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getPainelCobrancas, sincronizarCobrancas } from '@/lib/cobrancas-storage';

const db = supabase as any;

export interface CobrancaItem {
  id: string;
  saleId: string;
  studentId: string | null;
  alunoNome: string;
  curso: string;
  saleDate: string | null;
  telefone: string | null;
  email: string | null;
  situacao: string;
  situacaoOperacional: string;
  etapaCodigo: string | null;
  etapaId: string | null;
  proximaAcaoEm: string | null;
  proximaAcaoTipo: string | null;
  ultimaAcaoEm: string | null;
  ultimaAcaoDescricao: string | null;
  responsavelId: string | null;
  responsavelNome: string;
  parcelaReferenciaId: string | null;
  parcelaNumero: number | null;
  parcelaVencimento: string | null;
  diasAtraso: number;
  valorVencido: number;
  totalAberto: number;
  parcelasAbertas: number;
  promessaAtiva: { data: string; valor: number | null; criadaEm: string; observacao: string | null } | null;
  promessaNaoCumprida: boolean;
  aguardandoRetorno: boolean;
  renegociacaoAtiva: boolean;
  renegociacao: { inicio: string; suspensaAte: string | null; observacao: string | null } | null;
  acoes: { tipo: string; status: string; dataPrevista: string | null }[];
  motivoEncerramento: string | null;
  carteiraInicial: boolean;
  proximaEtapaCodigo: string | null;
  promessaParcial: boolean;
  valorAtraso: number;
  parcelasVencidas: number;
  valorAVencer: number;
  parcelasAVencer: number;
  vencidaMaisAntiga: string | null;
  vencidaMaisAntigaNumero: number | null;
  maiorAtraso: number;
}

const hojeISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const diffDias = (a: string, b: string) => {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86400000);
};

const inChunks = async (table: string, select: string, col: string, ids: string[], extra?: (q: any) => any) => {
  const out: any[] = [];
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  for (let i = 0; i < uniq.length; i += 200) {
    let q = db.from(table).select(select).in(col, uniq.slice(i, i + 200));
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
};

export const useCobrancas = () => {
  const [itens, setItens] = useState<CobrancaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsaveis, setResponsaveis] = useState<[string, string][]>([]);

  const load = useCallback(async (sync = false) => {
    setLoading(true);
    try {
      if (sync) {
        try { await sincronizarCobrancas(); } catch (e) { console.warn('sync cobrancas', e); }
      }
      const painel = await getPainelCobrancas();
      const saleIds = painel.map((p: any) => p.sale_id);
      const studentIds = painel.map((p: any) => p.student_id).filter(Boolean);
      const cobIds = painel.map((p: any) => p.id);

      const [sales, students, abertas, promessas, renegs, acoes, interacoes, vend] = await Promise.all([
        inChunks('sales', 'id, course, date', 'id', saleIds),
        inChunks('students', 'id, phone, email', 'id', studentIds),
        inChunks('installments', 'id, sale_id, value, status, due_date, installment_number', 'sale_id', saleIds, (q) => q.in('status', ['pending', 'due_today', 'overdue'])),
        inChunks('cobranca_promessas', 'cobranca_id, status, cumprimento, data_prometida, valor_prometido, observacao, created_at', 'cobranca_id', cobIds, (q) => q.order('created_at', { ascending: false })),
        inChunks('cobranca_renegociacoes', 'cobranca_id, status, inicio, suspensa_ate, observacao, created_at', 'cobranca_id', cobIds, (q) => q.eq('status', 'ativa').order('created_at', { ascending: false })),
        inChunks('cobranca_acoes_especiais', 'cobranca_id, tipo, status, data_prevista, created_at', 'cobranca_id', cobIds, (q) => q.order('created_at', { ascending: false })),
        inChunks('collection_attempts', 'cobranca_id, resultado, tipo_interacao, date', 'cobranca_id', cobIds, (q) => q.order('date', { ascending: false })),
        db.rpc('get_vendedores_basic', { _apenas_ativos: false }),
      ]);

      const vendMap = new Map<string, string>((vend.data || []).map((v: any) => [v.user_id, v.nome]));
      setResponsaveis(Array.from(vendMap.entries()).sort((a, b) => a[1].localeCompare(b[1])));
      const saleMap = new Map(sales.map((s: any) => [s.id, s]));
      const stuMap = new Map(students.map((s: any) => [s.id, s]));
      const hoje = hojeISO();

      const lista: CobrancaItem[] = painel.map((p: any) => {
        const sale: any = saleMap.get(p.sale_id) || {};
        const stu: any = p.student_id ? stuMap.get(p.student_id) || {} : {};
        const ab = abertas.filter((i: any) => i.sale_id === p.sale_id);
        const proms = promessas.filter((x: any) => x.cobranca_id === p.id);
        const ativa = proms.find((x: any) => x.status === 'ativa');
        const ren = renegs.find((r: any) => r.cobranca_id === p.id);
        const ultimaInter = interacoes.find((x: any) => x.cobranca_id === p.id && x.tipo_interacao !== 'observacao');
        // mantém somente o estado mais recente de cada tipo de ação especial
        const vistos = new Set<string>();
        const acs = acoes
          .filter((a: any) => a.cobranca_id === p.id)
          .filter((a: any) => (vistos.has(a.tipo) ? false : (vistos.add(a.tipo), true)))
          .map((a: any) => ({ tipo: a.tipo, status: a.status, dataPrevista: a.data_prevista }));
        return {
          id: p.id,
          saleId: p.sale_id,
          studentId: p.student_id,
          alunoNome: p.aluno_nome || '—',
          curso: sale.course || '—',
          saleDate: sale.date || null,
          telefone: stu.phone || null,
          email: stu.email || null,
          situacao: p.situacao,
          situacaoOperacional: p.situacao_operacional,
          etapaCodigo: p.etapa_codigo,
          etapaId: p.etapa_atual_id,
          proximaAcaoEm: p.proxima_acao_em,
          proximaAcaoTipo: p.proxima_acao_tipo,
          ultimaAcaoEm: p.ultima_acao_em,
          ultimaAcaoDescricao: p.ultima_acao_descricao,
          responsavelId: p.responsavel_id,
          responsavelNome: (p.responsavel_id && vendMap.get(p.responsavel_id)) || '—',
          parcelaReferenciaId: p.parcela_referencia_id,
          parcelaNumero: p.parcela_numero,
          parcelaVencimento: p.parcela_vencimento,
          diasAtraso: p.parcela_vencimento ? Math.max(0, diffDias(hoje, p.parcela_vencimento)) : 0,
          valorVencido: Number(p.valor_vencido || 0),
          totalAberto: ab.reduce((s: number, i: any) => s + Number(i.value || 0), 0),
          parcelasAbertas: ab.length,
          promessaAtiva: ativa ? { data: ativa.data_prometida, valor: ativa.valor_prometido, criadaEm: ativa.created_at, observacao: ativa.observacao } : null,
          promessaNaoCumprida: !ativa && proms[0]?.status === 'nao_cumprida',
          aguardandoRetorno: !!ultimaInter && ultimaInter.tipo_interacao === 'cobranca' && ['sem_resposta', 'aguardando_retorno'].includes(ultimaInter.resultado),
          renegociacaoAtiva: !!ren,
          renegociacao: ren ? { inicio: ren.inicio, suspensaAte: ren.suspensa_ate, observacao: ren.observacao } : null,
          acoes: acs,
          motivoEncerramento: p.motivo_encerramento,
          carteiraInicial: !!p.carteira_inicial,
          proximaEtapaCodigo: p.proxima_etapa_codigo || null,
          promessaParcial: ativa?.cumprimento === 'parcialmente_cumprida',
          ...(() => {
            const venc = ab.filter((i: any) => i.due_date < hoje).sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));
            const fut = ab.filter((i: any) => i.due_date >= hoje);
            const soma = (l: any[]) => l.reduce((s: number, i: any) => s + Number(i.value || 0), 0);
            return {
              valorAtraso: soma(venc),
              parcelasVencidas: venc.length,
              valorAVencer: soma(fut),
              parcelasAVencer: fut.length,
              vencidaMaisAntiga: venc[0]?.due_date || null,
              vencidaMaisAntigaNumero: venc[0]?.installment_number ?? null,
              maiorAtraso: venc[0] ? diffDias(hoje, venc[0].due_date) : 0,
            };
          })(),
        };
      });
      setItens(lista);
    } catch (e) {
      console.error('Erro ao carregar cobranças', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  return { itens, loading, reload: () => load(false), responsaveis, hoje: hojeISO() };
};
