import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rangeMock, orderMock, selectMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rangeMock: vi.fn(),
  orderMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fromMock },
}));
vi.mock('./certificacoes-storage', () => ({
  cancelarCertificacaoDaVenda: vi.fn(),
}));

import { getInstallments } from './supabase-storage';

const row = (index: number) => ({
  id: `installment-${index}`,
  sale_id: 'other-sale',
  student_name: 'Outro aluno',
  course: 'Curso',
  installment_number: 1,
  total_installments: 11,
  value: '109.90',
  due_date: '2027-04-01',
  status: 'pending',
  sales: { vendedor_id: 'seller', payment_mode: 'Boleto', tipo_boleto: 'proprio' },
});

describe('getInstallments pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = { select: selectMock, order: orderMock, range: rangeMock };
    fromMock.mockReturnValue(query);
    selectMock.mockReturnValue(query);
    orderMock.mockReturnValue(query);
  });

  it('loads all 1124 records and all 11 Marcelo monthly installments across the 1000-record boundary', async () => {
    const rows = Array.from({ length: 1124 }, (_, index) => row(index));
    for (let number = 1; number <= 11; number += 1) {
      rows[994 + number] = {
        ...row(994 + number),
        sale_id: 'marcelo-sale',
        student_name: 'Marcelo Augusto Tenório Guedes',
        installment_number: number,
      };
    }
    rangeMock.mockImplementation(async (start: number, end: number) => ({
      data: rows.slice(start, end + 1), error: null,
    }));

    const result = await getInstallments();
    expect(result).toHaveLength(1124);
    expect(rangeMock.mock.calls).toEqual([[0, 999], [1000, 1999]]);
    expect(orderMock).toHaveBeenCalledWith('id', { ascending: true });
    const monthly = result.filter(inst => inst.saleId === 'marcelo-sale');
    expect(monthly.map(inst => inst.installmentNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(monthly.reduce((sum, inst) => sum + Math.round(inst.value * 100), 0)).toBe(120890);
  });

  it('fetches the terminating empty page when the total is exactly 2000', async () => {
    const rows = Array.from({ length: 2000 }, (_, index) => row(index));
    rangeMock.mockImplementation(async (start: number, end: number) => ({
      data: rows.slice(start, end + 1), error: null,
    }));
    expect(await getInstallments()).toHaveLength(2000);
    expect(rangeMock.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('does not return a truncated list if a later page fails', async () => {
    rangeMock.mockResolvedValueOnce({
      data: Array.from({ length: 1000 }, (_, index) => row(index)), error: null,
    }).mockResolvedValueOnce({ data: null, error: { message: 'Network failure' } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await getInstallments()).toEqual([]);
      expect(log).toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});