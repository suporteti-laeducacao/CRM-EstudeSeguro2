import { describe, it, expect } from 'vitest';
import { buildCalendarEngine, computeIndicators } from '@/lib/business-days';
import { Holiday, WorkScheduleDay } from '@/lib/calendar-types';

const workSchedule: WorkScheduleDay[] = [
  { id: '0', weekday: 0, hours: 0 },
  { id: '1', weekday: 1, hours: 8 },
  { id: '2', weekday: 2, hours: 8 },
  { id: '3', weekday: 3, hours: 8 },
  { id: '4', weekday: 4, hours: 8 },
  { id: '5', weekday: 5, hours: 8 },
  { id: '6', weekday: 6, hours: 4 },
];

const holidays: Holiday[] = [
  {
    id: 'h1',
    name: 'Emancipação de Itabaiana',
    day: 28,
    month: 8,
    date: null,
    is_recurring: true,
    is_movable: false,
    movable_rule: null,
    scope: 'municipal',
    day_weight: 0,
    is_facultative: false,
    is_active: true,
    legal_basis: 'Decreto 544/2023',
  },
];

const engine = buildCalendarEngine({ workSchedule, holidays, exceptions: [], considerFacultative: false });

const START = '2026-08-01';
const END = '2026-08-31';

const statsFor = (today: string) => ({
  totais: engine.getWeightedDays(START, END),
  decorridos: engine.getElapsedWeightedDays(START, END, today),
  restantes: engine.getRemainingWeightedDays(START, END, today),
  pesoHoje: today >= START && today <= END ? engine.getDayWeight(today) : 0,
});

describe('motor de dias úteis', () => {
  it('agosto/2026 tem 22,5 dias ponderados', () => {
    expect(engine.getWeightedDays(START, END)).toBeCloseTo(22.5, 6);
  });

  it('invariante: decorridos + restantes === totais para qualquer data de referência', () => {
    for (let d = 1; d <= 31; d += 1) {
      const today = `2026-08-${String(d).padStart(2, '0')}`;
      const s = statsFor(today);
      expect(s.decorridos + s.restantes).toBeCloseTo(s.totais, 6);
    }
    // datas fora do período
    ['2026-07-15', '2026-09-10'].forEach((today) => {
      const s = statsFor(today);
      expect(s.decorridos + s.restantes).toBeCloseTo(s.totais, 6);
    });
  });
});

describe('indicadores — 05/08/2026', () => {
  const s = statsFor('2026-08-05');
  const ind = computeIndicators({
    metaTotal: 50000,
    realizado: 1009.9,
    diasPonderadosTotais: s.totais,
    diasPonderadosDecorridos: s.decorridos,
    diasPonderadosRestantes: s.restantes,
    pesoHoje: s.pesoHoje,
  });

  it('base do período', () => {
    expect(s.totais).toBeCloseTo(22.5, 6);
    expect(s.decorridos).toBeCloseTo(2.5, 6);
    expect(s.pesoHoje).toBeCloseTo(1, 6);
    expect(s.restantes).toBeCloseTo(20, 6);
  });

  it('valores calculados', () => {
    expect(ind.metaDiariaIdeal).toBeCloseTo(2222.22, 2);
    expect(ind.metaDoDiaIdeal).toBeCloseTo(2222.22, 2);
    expect(ind.ritmoNecessario).toBeCloseTo(2449.505, 3);
    expect(ind.metaDoDia).toBeCloseTo(2449.505, 3);
    expect(ind.metaAcumuladaEsperada).toBeCloseTo(5555.56, 2);
    expect(ind.saldo).toBeCloseTo(-4545.66, 2);
    expect(ind.ritmoAtual).toBeCloseTo(288.54, 2);
    expect(ind.projecaoFechamento).toBeCloseTo(1009.9 + 288.542857 * 19, 2);

    expect(ind.status).toBe('atrasado');
  });
});

describe('indicadores — sábado 08/08/2026', () => {
  const s = statsFor('2026-08-08');
  const ind = computeIndicators({
    metaTotal: 50000,
    realizado: 10000,
    diasPonderadosTotais: s.totais,
    diasPonderadosDecorridos: s.decorridos,
    diasPonderadosRestantes: s.restantes,
    pesoHoje: s.pesoHoje,
  });

  it('peso de sábado é 0,5 e a meta de hoje é metade do ritmo diário', () => {
    expect(s.pesoHoje).toBeCloseTo(0.5, 6);
    expect(ind.metaDoDia).toBeCloseTo(ind.ritmoNecessario / 2, 6);
    expect(ind.metaDoDiaIdeal).toBeCloseTo(ind.metaDiariaIdeal / 2, 6);
  });
});

describe('bordas', () => {
  it('sem dias decorridos → ritmo e projeção zerados com flag', () => {
    const ind = computeIndicators({
      metaTotal: 50000, realizado: 0,
      diasPonderadosTotais: 22.5, diasPonderadosDecorridos: 0,
      diasPonderadosRestantes: 22.5, pesoHoje: 1,
    });
    expect(ind.semDiasDecorridos).toBe(true);
    expect(ind.ritmoAtual).toBe(0);
    expect(ind.projecaoFechamento).toBe(0);
    expect(ind.status).toBe('inicio');
  });

  it('período encerrado → ritmo necessário zerado', () => {
    const ind = computeIndicators({
      metaTotal: 50000, realizado: 10000,
      diasPonderadosTotais: 22.5, diasPonderadosDecorridos: 22.5,
      diasPonderadosRestantes: 0, pesoHoje: 0,
    });
    expect(ind.periodoEncerrado).toBe(true);
    expect(ind.ritmoNecessario).toBe(0);
    expect(ind.metaDoDia).toBe(0);
  });

  it('meta zero → percentuais finitos', () => {
    const ind = computeIndicators({
      metaTotal: 0, realizado: 500,
      diasPonderadosTotais: 22.5, diasPonderadosDecorridos: 2.5,
      diasPonderadosRestantes: 20, pesoHoje: 1,
    });
    expect(Number.isFinite(ind.percentualAtingido)).toBe(true);
    expect(ind.status).toBe('sem_meta');
  });

  it('faixas de status por desvio', () => {
    const mk = (realizado: number) => computeIndicators({
      metaTotal: 22500, realizado,
      diasPonderadosTotais: 22.5, diasPonderadosDecorridos: 10,
      diasPonderadosRestantes: 12.5, pesoHoje: 1,
    }).status;
    expect(mk(11500)).toBe('adiantado');   // +15%
    expect(mk(10000)).toBe('no_ritmo');    // 0%
    expect(mk(8500)).toBe('atencao');      // -15%
    expect(mk(6000)).toBe('atrasado');     // -40%
  });
});

describe('separação realizado até ontem × hoje', () => {
  const base = {
    metaTotal: 50000,
    diasPonderadosTotais: 22.5,
    diasPonderadosDecorridos: 2.5,
    diasPonderadosRestantes: 20,
    pesoHoje: 1,
  };

  it('usa bases iguais no saldo e projeção incluindo o dia corrente', () => {
    const i = computeIndicators({ ...base, realizado: 3000, realizadoHoje: 1000 });
    expect(i.realizadoAteOntem).toBe(2000);
    expect(i.realizadoHoje).toBe(1000);
    // esperado até ontem = (50000/22.5)*2.5
    expect(i.saldo).toBeCloseTo(2000 - (50000 / 22.5) * 2.5, 2);
    // projeção considera hoje encerrado com o resultado atual
    expect(i.ritmoAtual).toBeCloseTo(3000 / 3.5, 2);
    expect(i.projecaoFechamento).toBeCloseTo(3000 + (3000 / 3.5) * 19, 2);
    // ritmo necessário usa o total (inclui hoje)
    expect(i.ritmoNecessario).toBeCloseTo((50000 - 3000) / 20, 2);
  });

  it('sinaliza amostra insuficiente e ausência de base', () => {
    const i = computeIndicators({ ...base, realizado: 0, realizadoHoje: 0 });
    expect(i.amostraInsuficiente).toBe(true);
    expect(i.semBaseProjecao).toBe(true);
  });

  it('calcula faixa de projeção com melhor e pior dia', () => {
    const i = computeIndicators({
      ...base,
      realizado: 3000,
      realizadoHoje: 1000,
      piorDiaRealizado: 0,
      melhorDiaRealizado: 2000,
    });
    expect(i.projecaoMin).toBeCloseTo(3000, 2);
    expect(i.projecaoMax).toBeCloseTo(3000 + 2000 * 19, 2);
  });
});
