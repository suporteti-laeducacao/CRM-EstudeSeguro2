import { describe, it, expect } from 'vitest';
import { gerarRelatorioCP, statusConciliacao, type ContaRelatorio } from './payables-report';

const base = { credor_id: 'x', categoria: 'outros', forma_pagamento: 'pix' };
const contas: ContaRelatorio[] = [
  { ...base, id: 'A', credor_id: 'a', descricao: 'A', valor: 0, valor_pago: 500, valor_total: 500, data_vencimento: '2026-10-05', data_pagamento: '2026-10-03', status: 'pago' },
  { ...base, id: 'B', credor_id: 'b', descricao: 'B', valor: 0, valor_pago: 1000, valor_total: 1000, data_vencimento: '2026-10-01', data_pagamento: '2026-10-15', status: 'pago',
    observacoes: 'Pagamento parcial em 2026-10-01: R$ 400,00 via pix | Pagamento parcial em 2026-10-15: R$ 600,00 via pix' },
  { ...base, id: 'C', credor_id: 'c', descricao: 'C', valor: 0, valor_pago: 312.5, valor_total: 300, data_vencimento: '2026-09-20', data_pagamento: '2026-10-02', status: 'pago' },
  { ...base, id: 'D', credor_id: 'd', descricao: 'D', valor: 0, valor_pago: 250, valor_total: 250, data_vencimento: '2026-10-10', data_pagamento: '2026-09-30', status: 'pago' },
  { ...base, id: 'E', credor_id: 'e', descricao: 'E', valor: 800, data_vencimento: '2026-10-08', status: 'pendente' },
  { ...base, id: 'F', credor_id: 'f', descricao: 'F', valor: 0, valor_pago: 150, valor_total: 150, data_vencimento: '2026-10-31', data_pagamento: '2026-10-31', status: 'pago' },
];
const nomes = { a: 'A', b: 'B', c: 'C', d: 'D', e: 'E', f: 'F' };
const juros = [{ conta_pagar_id: 'C', valor_juros: 12.5, data_pagamento: '2026-10-02' }];
const out = gerarRelatorioCP(contas, nomes, juros, { inicio: '2026-10-01', fim: '2026-10-31' }, '2026-11-01');

describe('relatório contas a pagar', () => {
  it('ordena pela data de pagamento', () => {
    expect(out.linhas.map(l => `${l.contaId}${l.valorPago}`)).toEqual(['B400', 'C312.5', 'A500', 'B600', 'F150']);
  });
  it('acumulado', () => {
    expect(out.linhas.map(l => l.acumulado)).toEqual([400, 712.5, 1212.5, 1812.5, 1962.5]);
  });
  it('totais', () => {
    expect(out.totalPago).toBe(1962.5);
    expect(out.qtdLancamentos).toBe(5);
    expect(out.qtdContas).toBe(4);
    expect(out.principal).toBe(1950);
    expect(out.juros).toBe(12.5);
  });
  it('D fora e E só em pendências', () => {
    expect(out.linhas.some(l => l.contaId === 'D' || l.contaId === 'E')).toBe(false);
    expect(out.pendencias.map(p => [p.contaId, p.valorRestante])).toEqual([['E', 800]]);
  });
  it('pagos com atraso', () => {
    expect(out.atrasados.map(l => [l.contaId, l.diasAtraso])).toEqual([['C', 12], ['B', 14]]);
    expect(out.valorAtrasados).toBe(912.5);
  });
  it('conciliação', () => {
    expect(statusConciliacao(1962.5, 2012.5)).toBe('extrato_maior');
    expect(statusConciliacao(1962.5, 1962.5)).toBe('conciliado');
    expect(statusConciliacao(1962.5, 1900)).toBe('relatorio_maior');
  });
  it('setembro mostra só D antecipada', () => {
    const s = gerarRelatorioCP(contas, nomes, juros, { inicio: '2026-09-01', fim: '2026-09-30' });
    expect(s.linhas.map(l => [l.contaId, l.valorPago, l.diasAtraso])).toEqual([['D', 250, -10]]);
  });
  it('ignora parciais anteriores a uma reversão', () => {
    const r = gerarRelatorioCP([{ ...base, id: 'R', descricao: 'R', valor: 100, valor_pago: 0, data_vencimento: '2026-10-01', status: 'pendente',
      observacoes: 'Pagamento parcial em 2026-10-02: R$ 50,00 via pix | Pagamento revertido em 03/10/2026' }], {}, [], { inicio: '2026-10-01', fim: '2026-10-31' });
    expect(r.linhas.length).toBe(0);
  });
});
