/**
 * Relatório de Contas a Pagar (regime de caixa / conciliação bancária).
 * Fonte: contas_pagar.data_pagamento + valor_pago; pagamentos parciais são
 * reconstruídos a partir das anotações "Pagamento parcial em YYYY-MM-DD: R$ X via Y"
 * gravadas em observacoes pela baixa; juros vêm de contas_pagar_juros.
 */

export interface ContaRelatorio {
  id: string;
  credor_id: string;
  descricao: string;
  categoria: string;
  valor: number;
  valor_pago?: number | null;
  valor_total?: number | null;
  data_vencimento: string;
  data_pagamento?: string | null;
  status: string;
  forma_pagamento?: string | null;
  observacoes?: string | null;
  updated_at?: string;
  conciliado?: boolean;
}

export interface JurosRelatorio {
  conta_pagar_id: string;
  valor_juros: number;
  data_pagamento: string;
}

export interface LinhaPagamento {
  key: string;
  contaId: string;
  dataPagamento: string;
  credorId: string;
  credorNome: string;
  descricao: string;
  categoria: string;
  vencimento: string;
  diasAtraso: number;
  valorOriginal: number;
  juros: number;
  desconto: number;
  valorPago: number;
  forma?: string;
  parcial: boolean;
  acumulado: number;
  conciliado: boolean;
  ordem: string;
}

export interface Pendencia {
  contaId: string;
  vencimento: string;
  credorNome: string;
  descricao: string;
  categoria: string;
  valorRestante: number;
  diasAtraso: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export const diffDias = (a: string, b: string) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86400000);
};

/** Data de hoje (YYYY-MM-DD) no fuso de Brasília. */
export const hojeBrasilia = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const PARCIAL_RE = /Pagamento parcial em (\d{4}-\d{2}-\d{2}): R\$ ([\d.,]+) via ([^.|]+)/g;

const parseValor = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

/** Todos os pagamentos efetivos de uma conta (sem filtro de período). */
export const pagamentosDaConta = (
  conta: ContaRelatorio,
  credorNome: string,
  juros: JurosRelatorio[],
): Omit<LinhaPagamento, 'acumulado'>[] => {
  const obs = conta.observacoes || '';
  // Ignora anotações anteriores a uma reversão de pagamento
  const idxRev = obs.lastIndexOf('Pagamento revertido em');
  const obsValida = idxRev >= 0 ? obs.slice(idxRev) : obs;

  const brutos: { data: string; valor: number; forma?: string }[] = [];
  for (const m of obsValida.matchAll(PARCIAL_RE)) {
    brutos.push({ data: m[1], valor: parseValor(m[2]), forma: m[3].trim() });
  }
  const somaParciais = brutos.reduce((s, p) => s + p.valor, 0);
  const totalPago = Number(conta.valor_pago || 0);

  if (conta.status === 'pago' && conta.data_pagamento) {
    const pagoTotal = totalPago > 0 ? totalPago : Number(conta.valor_total || conta.valor || 0);
    const resto = round(pagoTotal - somaParciais);
    if (resto > 0.005) {
      brutos.push({ data: conta.data_pagamento, valor: resto, forma: conta.forma_pagamento || undefined });
    }
  }
  if (brutos.length === 0) return [];

  const parcial = brutos.length > 1 || conta.status !== 'pago';
  const jurosRest = [...juros];

  return brutos.map((p, i) => {
    let j = 0;
    const idx = jurosRest.findIndex(x => x.data_pagamento === p.data);
    if (idx >= 0) {
      j = Number(jurosRest[idx].valor_juros);
      jurosRest.splice(idx, 1);
    } else if (i === brutos.length - 1 && jurosRest.length > 0) {
      j = jurosRest.reduce((s, x) => s + Number(x.valor_juros), 0);
    }
    j = Math.min(round(j), p.valor);
    return {
      key: `${conta.id}:${i}`,
      contaId: conta.id,
      dataPagamento: p.data,
      credorId: conta.credor_id,
      credorNome,
      descricao: conta.descricao,
      categoria: conta.categoria,
      vencimento: conta.data_vencimento,
      diasAtraso: diffDias(p.data, conta.data_vencimento),
      valorOriginal: round(p.valor - j),
      juros: j,
      desconto: 0,
      valorPago: round(p.valor),
      forma: p.forma,
      parcial,
      conciliado: !!conta.conciliado,
      ordem: conta.updated_at || '',
    };
  });
};

export interface FiltrosRelatorioCP {
  inicio: string; // YYYY-MM-DD
  fim: string;
  credores?: string[]; // vazio/undefined = todos
  categorias?: string[];
  formas?: string[];
  somenteNaoConciliados?: boolean;
}

export const gerarRelatorioCP = (
  contas: ContaRelatorio[],
  credorNomes: Record<string, string>,
  juros: JurosRelatorio[],
  f: FiltrosRelatorioCP,
  hoje: string = hojeBrasilia(),
) => {
  const passa = (c: ContaRelatorio) =>
    (!f.credores?.length || f.credores.includes(c.credor_id)) &&
    (!f.categorias?.length || f.categorias.includes(c.categoria));

  const jurosPorConta = new Map<string, JurosRelatorio[]>();
  juros.forEach(j => {
    const l = jurosPorConta.get(j.conta_pagar_id) || [];
    l.push(j);
    jurosPorConta.set(j.conta_pagar_id, l);
  });

  const todos = contas.flatMap(c =>
    pagamentosDaConta(c, credorNomes[c.credor_id] || '—', jurosPorConta.get(c.id) || []),
  );

  const linhasBase = todos
    .filter(l => l.dataPagamento >= f.inicio && l.dataPagamento <= f.fim)
    .filter(l => passa(contas.find(c => c.id === l.contaId)!))
    .filter(l => !f.formas?.length || f.formas.includes(l.forma || ''))
    .filter(l => !f.somenteNaoConciliados || !l.conciliado)
    .sort((a, b) =>
      a.dataPagamento.localeCompare(b.dataPagamento) ||
      a.ordem.localeCompare(b.ordem) ||
      a.credorNome.localeCompare(b.credorNome, 'pt-BR'),
    );

  let acc = 0;
  const linhas: LinhaPagamento[] = linhasBase.map(l => {
    acc = round(acc + l.valorPago);
    return { ...l, acumulado: acc };
  });

  const total = round(linhas.reduce((s, l) => s + l.valorPago, 0));
  const atrasados = linhas.filter(l => l.diasAtraso > 0);

  const agrupar = (key: (l: LinhaPagamento) => string) => {
    const m = new Map<string, { nome: string; qtd: number; total: number }>();
    linhas.forEach(l => {
      const k = key(l);
      const g = m.get(k) || { nome: k, qtd: 0, total: 0 };
      g.qtd++;
      g.total = round(g.total + l.valorPago);
      m.set(k, g);
    });
    return [...m.values()]
      .map(g => ({ ...g, pct: total > 0 ? (g.total / total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  };

  const subtotaisDia = new Map<string, { total: number; qtd: number }>();
  linhas.forEach(l => {
    const s = subtotaisDia.get(l.dataPagamento) || { total: 0, qtd: 0 };
    s.total = round(s.total + l.valorPago);
    s.qtd++;
    subtotaisDia.set(l.dataPagamento, s);
  });

  const pendencias: Pendencia[] = contas
    .filter(c => c.status !== 'pago' && c.data_vencimento >= f.inicio && c.data_vencimento <= f.fim && passa(c))
    .map(c => ({
      contaId: c.id,
      vencimento: c.data_vencimento,
      credorNome: credorNomes[c.credor_id] || '—',
      descricao: c.descricao,
      categoria: c.categoria,
      valorRestante: round(Number(c.valor || 0)),
      diasAtraso: Math.max(0, diffDias(hoje, c.data_vencimento)),
    }))
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  return {
    linhas,
    subtotaisDia,
    totalPago: total,
    qtdLancamentos: linhas.length,
    qtdContas: new Set(linhas.map(l => l.contaId)).size,
    principal: round(linhas.reduce((s, l) => s + l.valorOriginal, 0)),
    juros: round(linhas.reduce((s, l) => s + l.juros, 0)),
    descontos: 0,
    atrasados,
    valorAtrasados: round(atrasados.reduce((s, l) => s + l.valorPago, 0)),
    ticketMedio: linhas.length ? round(total / linhas.length) : 0,
    conciliados: linhas.filter(l => l.conciliado).length,
    porCategoria: agrupar(l => l.categoria),
    porFornecedor: agrupar(l => l.credorNome),
    porForma: agrupar(l => l.forma || 'Não informada'),
    pendencias,
    totalPendencias: round(pendencias.reduce((s, p) => s + p.valorRestante, 0)),
    todosPagamentos: todos,
  };
};

export type RelatorioCP = ReturnType<typeof gerarRelatorioCP>;

export type StatusConciliacao = 'conciliado' | 'extrato_maior' | 'relatorio_maior';
export const statusConciliacao = (totalRelatorio: number, totalExtrato: number): StatusConciliacao => {
  const d = round(totalExtrato - totalRelatorio);
  if (Math.abs(d) < 0.005) return 'conciliado';
  return d > 0 ? 'extrato_maior' : 'relatorio_maior';
};
