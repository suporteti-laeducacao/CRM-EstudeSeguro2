import { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import { getMetaGeralAtiva, getMetasVendedoresAtivas, MetaGeral, MetaVendedor } from '@/lib/metas-storage';
import { getVendedores, Vendedor } from '@/lib/vendedores-storage';
import { storage } from '@/lib/storage';
import { Sale, Installment } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useBusinessDays } from '@/hooks/useBusinessDays';
import { todayKeySP } from '@/lib/business-days';
import DualProgress from '@/components/ranking/DualProgress';
import DailyGoalCards from '@/components/ranking/DailyGoalCards';
import DailyGoalTable from '@/components/ranking/DailyGoalTable';

interface PaymentLogEntry {
  installment_id: string;
  valor: number;
  data_pagamento: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const AcompanhamentoMetas = () => {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [mesRef, setMesRef] = useState(currentMonth);
  const [metaGeral, setMetaGeral] = useState<MetaGeral | null>(null);
  const [metasVendedores, setMetasVendedores] = useState<MetaVendedor[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { getPeriodStats, getIndicators, engine } = useBusinessDays();

  const refDate = useMemo(() => {
    const d = parse(mesRef + '-15', 'yyyy-MM-dd', new Date());
    return d;
  }, [mesRef]);

  const loadBaseData = useCallback(async () => {
    try {
      const [v, s, i, logsResult] = await Promise.all([
        getVendedores(),
        storage.getSales(),
        storage.getInstallments(),
        supabase.from('installment_payments').select('installment_id, valor, data_pagamento'),
      ]);
      setVendedores(v);
      setSales(s);
      setInstallments(i);
      if (logsResult.data) setPaymentLogs(logsResult.data as PaymentLogEntry[]);
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  }, []);

  const loadMetas = useCallback(async () => {
    try {
      const [mg, mv] = await Promise.all([
        getMetaGeralAtiva(refDate),
        getMetasVendedoresAtivas(refDate),
      ]);
      setMetaGeral(mg);
      setMetasVendedores(mv);
    } catch { toast.error('Erro ao carregar metas'); }
  }, [refDate]);

  useEffect(() => { loadBaseData(); }, [loadBaseData]);
  useEffect(() => { loadMetas(); }, [loadMetas]);

  const isEncerrada = useMemo(() => {
    if (!metaGeral) return false;
    const today = new Date().toISOString().split('T')[0];
    return metaGeral.data_fim < today;
  }, [metaGeral]);

  // Calculate realized amount per vendedor using ledger-first logic (same as Ranking)
  const realizadoDetalhado = useMemo(() => {
    const period = metaGeral || (metasVendedores.length > 0 ? metasVendedores[0] : null);
    if (!period) return { total: new Map<string, number>(), daily: new Map<string, Record<string, number>>() };

    const startDate = period.data_inicio;
    const endDate = period.data_fim;

    const map = new Map<string, number>();
    const dailyMap = new Map<string, Record<string, number>>();

    sales.forEach(sale => {
      const isBoleto = sale.paymentMode?.toLowerCase().includes('boleto');
      const vendedorId = sale.vendedorId || '';

      const saleInstallments = installments.filter(
        inst => inst.saleId === sale.id
          && inst.status !== 'refunded'
          && (!isBoleto || inst.installmentNumber === 0)
          && (inst.status === 'paid' || (inst.paidAmount || 0) > 0)
      );

      let totalForSale = 0;
      const dailyForSale: Record<string, number> = {};

      saleInstallments.forEach(inst => {
        const instLogs = paymentLogs.filter(log => log.installment_id === inst.id);

        if (instLogs.length > 0) {
          // LEDGER-FIRST: only count payments within the period
          const logsInPeriod = instLogs.filter(
            log => log.data_pagamento >= startDate && log.data_pagamento <= endDate
          );
          logsInPeriod.forEach((log) => {
            const valor = Number(log.valor);
            totalForSale += valor;
            const key = log.data_pagamento.slice(0, 10);
            dailyForSale[key] = (dailyForSale[key] || 0) + valor;
          });
        } else if (inst.status === 'paid' && inst.paidDate) {
          // FALLBACK for pre-ledger installments
          if (inst.paidDate >= startDate && inst.paidDate <= endDate) {
            const amount = inst.paidAmount ?? inst.fullValue ?? inst.value;
            const valor = sale.tipoBoleto === 'repasse' && inst.isRepasse
              ? (inst.companyValue || amount)
              : amount;
            totalForSale += valor;
            const key = inst.paidDate.slice(0, 10);
            dailyForSale[key] = (dailyForSale[key] || 0) + valor;
          }
        }
      });

      if (totalForSale > 0) {
        map.set(vendedorId, (map.get(vendedorId) || 0) + totalForSale);
        const acc = dailyMap.get(vendedorId) || {};
        Object.entries(dailyForSale).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; });
        dailyMap.set(vendedorId, acc);
      }
    });
    return { total: map, daily: dailyMap };
  }, [sales, installments, paymentLogs, metaGeral, metasVendedores]);

  const realizadoPorVendedor = realizadoDetalhado.total;
  const dailyPorVendedor = realizadoDetalhado.daily;

  const totalRealizado = useMemo(() => {
    let total = 0;
    realizadoPorVendedor.forEach(v => total += v);
    return total;
  }, [realizadoPorVendedor]);

  const percentGeral = metaGeral ? Math.min((totalRealizado / metaGeral.valor) * 100, 100) : 0;

  const periodStart = metaGeral?.data_inicio || format(startOfMonth(refDate), 'yyyy-MM-dd');
  const periodEnd = metaGeral?.data_fim || format(endOfMonth(refDate), 'yyyy-MM-dd');
  const periodStats = getPeriodStats(periodStart, periodEnd);

  const elapsedDayKeys = useMemo(
    () =>
      engine
        .listDays(periodStats.start, periodStats.end)
        .filter((d) => d.weight > 0 && d.key < periodStats.today)
        .map((d) => d.key),
    [engine, periodStats.start, periodStats.end, periodStats.today]
  );

  const hojeKey = todayKeySP();
  const totalHoje = useMemo(() => {
    let t = 0;
    dailyPorVendedor.forEach((d) => { t += d[hojeKey] || 0; });
    return t;
  }, [dailyPorVendedor, hojeKey]);

  const totaisPorDia = useMemo(
    () => elapsedDayKeys.map((k) => {
      let t = 0;
      dailyPorVendedor.forEach((d) => { t += d[k] || 0; });
      return t;
    }),
    [elapsedDayKeys, dailyPorVendedor]
  );

  const geralIndicators = getIndicators(metaGeral?.valor || 0, totalRealizado, periodStats, {
    realizadoHoje: totalHoje,
    melhorDiaRealizado: totaisPorDia.length ? Math.max(...totaisPorDia) : undefined,
    piorDiaRealizado: totaisPorDia.length ? Math.min(...totaisPorDia) : undefined,
  });

  const percentTempo = geralIndicators.percentualTempo * 100;

  const vendedorRows = useMemo(() => {
    return vendedores.map(v => {
      const meta = metasVendedores.find(m => m.vendedor_id === v.id);
      const realizado = realizadoPorVendedor.get(v.id) || 0;
      const percent = meta ? (realizado / meta.valor) * 100 : 0;
      let status: 'abaixo' | 'na_meta' | 'acima' = 'abaixo';
      if (percent >= 100) status = 'acima';
      else if (percent >= 70) status = 'na_meta';
      return { vendedor: v, meta, realizado, percent, status };
    }).filter(r => r.meta || r.realizado > 0)
      .sort((a, b) => b.percent - a.percent);
  }, [vendedores, metasVendedores, realizadoPorVendedor]);

  const dailySellers = useMemo(
    () => vendedorRows.map(r => ({
      name: r.vendedor.nome,
      totalAmount: r.realizado,
      todayAmount: dailyPorVendedor.get(r.vendedor.id)?.[hojeKey] || 0,
      daily: dailyPorVendedor.get(r.vendedor.id) || {},
    })),
    [vendedorRows, dailyPorVendedor, hojeKey]
  );

  const metaBySellerName = useMemo(() => {
    const map = new Map<string, number>();
    vendedorRows.forEach(r => { if (r.meta) map.set(r.vendedor.nome, r.meta.valor); });
    return map;
  }, [vendedorRows]);

  const getStatusBadge = (status: string, percent: number) => {
    if (status === 'acima') return <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">🟢 Acima da meta ({percent.toFixed(0)}%)</Badge>;
    if (status === 'na_meta') return <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent">🟡 Na meta ({percent.toFixed(0)}%)</Badge>;
    return <Badge variant="destructive">🔴 Abaixo da meta ({percent.toFixed(0)}%)</Badge>;
  };

  const mesLabel = (() => {
    try {
      const d = parse(mesRef + '-01', 'yyyy-MM-dd', new Date());
      return format(d, 'MMMM/yyyy', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase());
    } catch { return mesRef; }
  })();

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <PageHeader
            title="Acompanhamento de Metas"
            subtitle="Visão geral do atingimento de metas da equipe"
            className="mb-0"
          />
          <div className="flex items-center gap-3">
            <Label htmlFor="mes-filter" className="text-sm whitespace-nowrap">Mês de Referência</Label>
            <Input
              id="mes-filter"
              type="month"
              value={mesRef}
              onChange={e => setMesRef(e.target.value)}
              className="w-44"
            />
          </div>
        </div>

        {/* Meta Geral Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Meta Geral da Equipe — {mesLabel}
              {isEncerrada && <Badge variant="outline" className="border-muted-foreground text-muted-foreground ml-2">Encerrada</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metaGeral ? (
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-ink-500">Realizado</p>
                    <p className="font-display text-[34px] leading-none text-ink-950 tabular-nums">{formatCurrency(totalRealizado)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-ink-500">Meta</p>
                    <p className="text-2xl font-semibold tabular-nums text-ink-900">{formatCurrency(metaGeral.valor)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Realizado {percentGeral.toFixed(1)}% · Esperado {percentTempo.toFixed(1)}%</span>
                    <span>{formatCurrency(Math.max(metaGeral.valor - totalRealizado, 0))} restante</span>
                  </div>
                  <DualProgress value={percentGeral} expected={percentTempo} barClassName="h-4" />
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">Nenhuma meta geral encontrada para {mesLabel}</p>
            )}
          </CardContent>
        </Card>

        {/* Indicadores de meta diária (dias úteis ponderados) */}
        <DailyGoalCards indicators={geralIndicators} stats={periodStats} />

        {/* Meta diária por vendedor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Meta Diária por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyGoalTable
              sellers={dailySellers}
              metaBySellerName={metaBySellerName}
              stats={periodStats}
              elapsedDayKeys={elapsedDayKeys}
              geralIndicators={geralIndicators}
            />

          </CardContent>
        </Card>

        {/* Tabela por Vendedor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Desempenho por Vendedor</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Meta</TableHead>
                  <TableHead className="text-right">Realizado</TableHead>
                  <TableHead className="w-48">Progresso</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedorRows.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum dado disponível para {mesLabel}</TableCell></TableRow>
                ) : vendedorRows.map(r => (
                  <TableRow key={r.vendedor.id}>
                    <TableCell className="font-medium">{r.vendedor.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.meta ? formatCurrency(r.meta.valor) : <span className="text-ink-500">Sem meta</span>}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.realizado)}</TableCell>
                    <TableCell>
                      {r.meta ? (
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(r.percent, 100)}
                            className={`h-2.5 flex-1 bg-ink-100 ${r.percent >= 100 ? '[&>div]:bg-brand' : ''}`}
                          />
                          <span className={`text-sm font-bold tabular-nums ${r.percent >= 100 ? 'text-brand-ink' : 'text-ink-700'}`}>
                            {r.percent.toFixed(0)}%
                          </span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {r.meta ? getStatusBadge(r.status, r.percent) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AcompanhamentoMetas;
