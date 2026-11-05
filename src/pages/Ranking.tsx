import { getPhotoSignedUrl } from '@/lib/photo-url';
import { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, subMonths } from 'date-fns';
import { toPng } from 'html-to-image';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { storage } from '@/lib/storage';
import { Sale, Installment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useRankingSound } from '@/hooks/useRankingSound';
import RankingPodium from '@/components/ranking/RankingPodium';
import RankingTable from '@/components/ranking/RankingTable';
import RankingControls from '@/components/ranking/RankingControls';
import RankingMetrics from '@/components/ranking/RankingMetrics';
import DailyGoalCards from '@/components/ranking/DailyGoalCards';
import DailyGoalTable from '@/components/ranking/DailyGoalTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBusinessDays } from '@/hooks/useBusinessDays';
import { todayKeySP } from '@/lib/business-days';
import DualProgress from '@/components/ranking/DualProgress';
import { getMetaGeralAtiva, getMetasVendedoresAtivas, MetaGeral, MetaVendedor } from '@/lib/metas-storage';
import { getVendedores } from '@/lib/vendedores-storage';
import { supabase } from '@/integrations/supabase/client';

interface PaymentLogEntry {
  id: string;
  installment_id: string;
  valor: number;
  data_pagamento: string;
}

interface SellerStats {
  name: string;
  totalSales: number;
  totalAmount: number;
  salesCount: number;
  averageTicket: number;
  fotoUrl?: string;
  /** realizado por dia (yyyy-MM-dd → valor) */
  daily: Record<string, number>;
  /** realizado do dia corrente */
  todayAmount: number;
}

// Inicializar com o mês atual
const getDefaultDates = () => {
  const now = new Date();
  return {
    start: format(startOfMonth(now), 'yyyy-MM-dd'),
    end: format(endOfMonth(now), 'yyyy-MM-dd'),
  };
};

const Ranking = () => {
  const defaultDates = getDefaultDates();
  const [sales, setSales] = useState<Sale[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogEntry[]>([]);
  const [exclusions, setExclusions] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [periodoRapido, setPeriodoRapido] = useState<string>('mes_atual');
  const [sellerStats, setSellerStats] = useState<SellerStats[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [metaGeral, setMetaGeral] = useState<MetaGeral | null>(null);
  const [metasVendedores, setMetasVendedores] = useState<MetaVendedor[]>([]);
  const [vendedorIdByName, setVendedorIdByName] = useState<Map<string, string>>(new Map());
  const [vendedorPhotoByName, setVendedorPhotoByName] = useState<Map<string, string>>(new Map());
  const [vendedorRoleNames, setVendedorRoleNames] = useState<Set<string>>(new Set());

  const exportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { getPeriodStats, getIndicators, engine } = useBusinessDays();

  const {
    isMuted,
    setIsMuted,
    volume,
    setVolume,
    changedPositions,
    checkForOvertakes,
  } = useRankingSound();

  const handleExportImage = async () => {
    if (!exportRef.current) return;
    try {
      setIsExporting(true);
      // wait for re-render hiding non-essential UI
      await new Promise((r) => setTimeout(r, 50));
      const dataUrl = await toPng(exportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--background')
          ? `hsl(${getComputedStyle(document.documentElement).getPropertyValue('--background')})`
          : '#ffffff',
      });
      const link = document.createElement('a');
      const periodLabel = startDate && endDate ? `${startDate}_a_${endDate}` : 'ranking';
      link.download = `ranking_${periodLabel}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: 'Imagem exportada', description: 'O ranking foi salvo como imagem.' });
    } catch (err) {
      console.error('Erro ao exportar ranking:', err);
      toast({ title: 'Erro ao exportar', description: 'Não foi possível gerar a imagem.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const loadMetas = useCallback(async (refDate?: Date) => {
    const ref = refDate || new Date();
    const [mg, mv, vends] = await Promise.all([
      getMetaGeralAtiva(ref),
      getMetasVendedoresAtivas(ref),
      getVendedores(),
    ]);
    setMetaGeral(mg);
    setMetasVendedores(mv);

    const nameMap = new Map<string, string>();
    const photoMap = new Map<string, string>();
    await Promise.all(vends.map(async (v) => {
      nameMap.set(v.nome, v.id);
      const signed = await getPhotoSignedUrl(v.foto_url);
      if (signed) photoMap.set(v.nome, signed);
    }));
    setVendedorIdByName(nameMap);
    setVendedorPhotoByName(photoMap);

    const roleChecks = await Promise.all(
      vends.map(async (v) => {
        if (!v.user_id) return { nome: v.nome, hasRole: false };
        const { data } = await supabase.rpc('has_role', { _user_id: v.user_id, _role: 'vendedor' });
        return { nome: v.nome, hasRole: Boolean(data) };
      })
    );

    const roleNames = new Set<string>();
    roleChecks.forEach((result) => {
      if (result.hasRole) roleNames.add(result.nome);
    });
    setVendedorRoleNames(roleNames);
  }, []);

  useEffect(() => {
    // Busca paginada: RPCs retornam no máximo 1000 linhas por requisição.
    const fetchAllRpc = async (fn: 'get_ranking_sales' | 'get_ranking_installments' | 'get_ranking_payments') => {
      const pageSize = 1000;
      let from = 0;
      const all: any[] = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase.rpc(fn as any).range(from, from + pageSize - 1);
        if (error) {
          console.error(`Erro ao carregar ${fn}:`, error);
          break;
        }
        const rows = (data as any[]) || [];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    };

    const loadSalesData = async () => {
      // O ranking usa funções seguras no backend para enxergar TODOS os
      // vendedores, mesmo para usuários com cargo de vendedor (que continuam
      // restritos às próprias vendas nas demais telas).
      const [salesRows, instRows, logs] = await Promise.all([
        fetchAllRpc('get_ranking_sales'),
        fetchAllRpc('get_ranking_installments'),
        fetchAllRpc('get_ranking_payments'),
      ]);

      setSales(
        (salesRows || []).map((s) => ({
          id: s.id,
          seller: s.seller,
          paymentMode: s.payment_mode,
          tipoBoleto: s.tipo_boleto,
          status: s.status,
        })) as unknown as Sale[]
      );

      setInstallments(
        (instRows || []).map((i) => ({
          id: i.id,
          saleId: i.sale_id,
          installmentNumber: i.installment_number,
          status: i.status,
          paidDate: i.paid_date,
          paidAmount: i.paid_amount != null ? Number(i.paid_amount) : undefined,
          value: Number(i.value),
          fullValue: i.full_value != null ? Number(i.full_value) : undefined,
          companyValue: i.company_value != null ? Number(i.company_value) : undefined,
          isRepasse: i.is_repasse,
        })) as unknown as Installment[]
      );

      setPaymentLogs(
        (logs || []).map((l) => ({
          id: l.id,
          installment_id: l.installment_id,
          valor: Number(l.valor),
          data_pagamento: l.data_pagamento,
        }))
      );

      // Values manually excluded from the ranking (financeiro keeps counting them)
      const { data: excl } = await supabase
        .from('ranking_exclusions')
        .select('reference_type, reference_id');
      if (excl) {
        setExclusions(
          new Set(
            (excl as { reference_type: string; reference_id: string }[]).map(
              (r) => `${r.reference_type}:${r.reference_id}`
            )
          )
        );
      }
    };
    loadSalesData();
    loadMetas();
    const interval = setInterval(() => {
      loadSalesData();
      loadMetas(startDate ? new Date(startDate + 'T12:00:00') : undefined);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Reload metas when date filters change
  useEffect(() => {
    if (startDate) {
      loadMetas(new Date(startDate + 'T12:00:00'));
    } else {
      loadMetas();
    }
  }, [startDate, loadMetas]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const calculateSellerStats = useCallback(() => {
    // Do NOT filter sales by sale.date — revenue attribution is based on
    // installment paidDate, not the sale creation date. A sale from a
    // previous month whose entry was paid this month must count for the
    // seller in the current period.
    const filteredSales = sales;

    // Group by seller
    const sellerMap = new Map<string, SellerStats>();

    filteredSales.forEach(sale => {
      const isBoleto = sale.paymentMode?.toLowerCase().includes('boleto');

      // Get all relevant installments for this sale (paid or with partial payments)
      const saleInstallments = installments.filter(
        inst => inst.saleId === sale.id
          && inst.status !== 'refunded'
          && (!isBoleto || inst.installmentNumber === 0)
          && (inst.status === 'paid' || (inst.paidAmount || 0) > 0)
      );

      let totalForSale = 0;
      const dailyForSale: Record<string, number> = {};

      saleInstallments.forEach(inst => {
        // Check if this installment has ledger entries
        const instLogs = paymentLogs.filter(log => log.installment_id === inst.id);

        if (instLogs.length > 0) {
          // USE LEDGER: only count payments whose dates fall within the period
          const logsInPeriod = instLogs.filter(
            log => log.data_pagamento >= (startDate || '')
              && log.data_pagamento <= (endDate || '9999-12-31')
          );
          logsInPeriod
            .filter((log) => !exclusions.has(`payment:${log.id}`))
            .forEach((log) => {
              totalForSale += Number(log.valor);
              const key = log.data_pagamento.slice(0, 10);
              dailyForSale[key] = (dailyForSale[key] || 0) + Number(log.valor);
            });
        } else if (inst.status === 'paid' && inst.paidDate) {
          // FALLBACK for installments paid before the ledger system existed
          if (
            inst.paidDate >= (startDate || '') &&
            inst.paidDate <= (endDate || '9999-12-31') &&
            !exclusions.has(`installment:${inst.id}`)
          ) {
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

      if (totalForSale === 0) return;

      const seller = sale.seller || 'Sem Vendedor';

      if (!sellerMap.has(seller)) {
        sellerMap.set(seller, {
          name: seller,
          totalSales: 0,
          totalAmount: 0,
          salesCount: 0,
          averageTicket: 0,
          daily: {},
          todayAmount: 0,
        });
      }

      const stats = sellerMap.get(seller)!;
      Object.entries(dailyForSale).forEach(([k, v]) => {
        stats.daily[k] = (stats.daily[k] || 0) + v;
      });
      stats.totalAmount += totalForSale;
      stats.salesCount += 1;
      stats.totalSales += sale.quantity;
    });

    // Add active vendors with 'vendedor' role that have zero sales
    vendedorIdByName.forEach((_, name) => {
      if (!sellerMap.has(name) && vendedorRoleNames.has(name)) {
        sellerMap.set(name, {
          name,
          totalSales: 0,
          totalAmount: 0,
          salesCount: 0,
          averageTicket: 0,
          daily: {},
          todayAmount: 0,
        });
      }
    });

    // Calculate average ticket and sort by total amount
    const hoje = todayKeySP();
    const statsArray = Array.from(sellerMap.values()).map(stat => ({
      ...stat,
      averageTicket: stat.salesCount > 0 ? stat.totalAmount / stat.salesCount : 0,
      fotoUrl: vendedorPhotoByName.get(stat.name),
      todayAmount: stat.daily[hoje] || 0,
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    // Check for overtakes before updating state
    checkForOvertakes(statsArray);
    setSellerStats(statsArray);
  }, [sales, installments, paymentLogs, exclusions, startDate, endDate, checkForOvertakes, vendedorPhotoByName, vendedorIdByName, vendedorRoleNames]);

  useEffect(() => {
    calculateSellerStats();
  }, [calculateSellerStats]);

  const handlePeriodoRapido = (periodo: string) => {
    setPeriodoRapido(periodo);
    const hoje = new Date();
    switch (periodo) {
      case 'hoje':
        setStartDate(format(hoje, 'yyyy-MM-dd'));
        setEndDate(format(hoje, 'yyyy-MM-dd'));
        break;
      case 'semana_atual':
        setStartDate(format(startOfWeek(hoje, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(hoje, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
        break;
      case 'semana_passada':
        setStartDate(format(startOfWeek(subWeeks(hoje, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd'));
        setEndDate(format(endOfWeek(subWeeks(hoje, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd'));
        break;
      case 'mes_atual':
        setStartDate(format(startOfMonth(hoje), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(hoje), 'yyyy-MM-dd'));
        break;
      case 'mes_passado':
        setStartDate(format(startOfMonth(subMonths(hoje, 1)), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(subMonths(hoje, 1)), 'yyyy-MM-dd'));
        break;
      case 'ultimos_3_meses':
        setStartDate(format(startOfMonth(subMonths(hoje, 2)), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(hoje), 'yyyy-MM-dd'));
        break;
      case 'ultimos_6_meses':
        setStartDate(format(startOfMonth(subMonths(hoje, 5)), 'yyyy-MM-dd'));
        setEndDate(format(endOfMonth(hoje), 'yyyy-MM-dd'));
        break;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const totalAmount = sellerStats.reduce((sum, stat) => sum + stat.totalAmount, 0);
  const totalSalesCount = sellerStats.reduce((sum, stat) => sum + stat.salesCount, 0);

  // Build metas map by seller name
  const metaBySellerName = new Map<string, number>();
  metasVendedores.forEach(mv => {
    if (mv.vendedor?.nome) metaBySellerName.set(mv.vendedor.nome, mv.valor);
  });
  sellerStats.forEach(stat => {
    const vid = vendedorIdByName.get(stat.name);
    if (vid) {
      const mv = metasVendedores.find(m => m.vendedor_id === vid);
      if (mv) metaBySellerName.set(stat.name, mv.valor);
    }
  });

  const metaGeralPercent = metaGeral ? Math.min((totalAmount / metaGeral.valor) * 100, 100) : 0;

  // Dias úteis ponderados do período selecionado (calendário/feriados)
  const periodStats = getPeriodStats(
    metaGeral?.data_inicio || startDate,
    metaGeral?.data_fim || endDate
  );

  // Dias úteis já decorridos (anteriores a hoje) — base da faixa de projeção
  const elapsedDayKeys = engine
    .listDays(periodStats.start, periodStats.end)
    .filter((d) => d.weight > 0 && d.key < periodStats.today)
    .map((d) => d.key);

  const todayKey = periodStats.today;
  const totalHoje = sellerStats.reduce((sum, s) => sum + (s.daily?.[todayKey] || 0), 0);
  const dailyTotals = elapsedDayKeys.map((k) =>
    sellerStats.reduce((sum, s) => sum + (s.daily?.[k] || 0), 0)
  );

  const geralIndicators = getIndicators(metaGeral?.valor || 0, totalAmount, periodStats, {
    realizadoHoje: totalHoje,
    melhorDiaRealizado: dailyTotals.length ? Math.max(...dailyTotals) : undefined,
    piorDiaRealizado: dailyTotals.length ? Math.min(...dailyTotals) : undefined,
  });

  const percentTempo = geralIndicators.percentualTempo * 100;
  const todayBySellerName = new Map(sellerStats.map((s) => [s.name, s.daily?.[todayKey] || 0]));






  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
        <RankingControls
          isMuted={isMuted}
          setIsMuted={setIsMuted}
          volume={volume}
          setVolume={setVolume}
          isFullscreen={isFullscreen}
          toggleFullscreen={toggleFullscreen}
        />

        <div className="p-6 lg:p-8 bg-muted/30 min-h-screen">
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="font-display text-[26px] leading-8 text-ink-950 mb-2">🏆 Ranking de Vendedores</h1>
              <p className="text-[13.5px] text-ink-500">Desempenho em tempo real</p>
            </div>

            <RankingMetrics
              totalAmount={totalAmount}
              totalSalesCount={totalSalesCount}
              activeVendorsCount={sellerStats.length}
              formatCurrency={formatCurrency}
              metaGeralValor={metaGeral?.valor}
            />

            <DailyGoalCards indicators={geralIndicators} stats={periodStats} isFullscreen />



            {metaGeral && (
              <div className="bg-card rounded-lg p-4 border border-primary/20 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Target className="h-4 w-4 text-primary" />
                    Meta Geral da Equipe
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(totalAmount)} / {formatCurrency(metaGeral.valor)} — Realizado {metaGeralPercent.toFixed(1)}% · Esperado {percentTempo.toFixed(1)}%
                  </span>
                </div>
                <DualProgress value={metaGeralPercent} expected={percentTempo} />
              </div>
            )}

            <div className="pt-6">
              <RankingPodium
                sellers={sellerStats}
                formatCurrency={formatCurrency}
                metaBySellerName={metaBySellerName}
                expectedPercent={percentTempo}
                todayBySellerName={todayBySellerName}
              />
            </div>

            <div className="bg-card rounded-[14px] shadow-card border border-ink-200 p-6">
              <RankingTable
                sellers={sellerStats}
                formatCurrency={formatCurrency}
                changedPositions={changedPositions}
                showOnlyAfterTop3
                metaBySellerName={metaBySellerName}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal mode
  return (
    <Layout>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="font-display text-[26px] leading-8 text-ink-950 mb-2">🏆 Ranking de Vendedores</h1>
          <p className="text-[13.5px] text-ink-500">Desempenho em tempo real</p>
        </div>
        <div className="flex justify-end -mt-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportImage}
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
            {isExporting ? 'Exportando...' : 'Exportar imagem'}
          </Button>
          <RankingControls
            isMuted={isMuted}
            setIsMuted={setIsMuted}
            volume={volume}
            setVolume={setVolume}
            isFullscreen={isFullscreen}
            toggleFullscreen={toggleFullscreen}
          />
        </div>

        {/* Filters (outside exported area) */}
        <div className="bg-card rounded-lg shadow-sm border p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Período</Label>
              <Select value={periodoRapido} onValueChange={handlePeriodoRapido}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="semana_atual">Semana Atual</SelectItem>
                  <SelectItem value="semana_passada">Semana Passada</SelectItem>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="mes_passado">Mês Passado</SelectItem>
                  <SelectItem value="ultimos_3_meses">Últimos 3 Meses</SelectItem>
                  <SelectItem value="ultimos_6_meses">Últimos 6 Meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Data Início</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPeriodoRapido(''); }}
              />
            </div>
            <div>
              <Label htmlFor="endDate">Data Fim</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPeriodoRapido(''); }}
              />
            </div>
          </div>
        </div>

        {/* Exported area */}
        <div ref={exportRef} className="space-y-6 bg-background p-4 rounded-lg">
          <div className="text-center">
            <h2 className="font-display text-[22px] leading-7 text-ink-950">🏆 Ranking de Vendedores</h2>
            <p className="text-sm text-muted-foreground">
              Período: {startDate} a {endDate}
            </p>
          </div>

          {/* Metrics */}
          <RankingMetrics
            totalAmount={totalAmount}
            totalSalesCount={totalSalesCount}
            activeVendorsCount={sellerStats.length}
            formatCurrency={formatCurrency}
            metaGeralValor={metaGeral?.valor}
          />

          {/* Meta diária baseada em dias úteis */}
          <DailyGoalCards indicators={geralIndicators} stats={periodStats} />



          {/* Meta Geral */}
          {metaGeral && (
            <div className="bg-card rounded-lg p-4 border border-primary/20 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Meta Geral da Equipe
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(totalAmount)} / {formatCurrency(metaGeral.valor)} — Realizado {metaGeralPercent.toFixed(1)}% · Esperado {percentTempo.toFixed(1)}%
                </span>
              </div>
              <DualProgress value={metaGeralPercent} expected={percentTempo} />
            </div>
          )}

          {/* Podium */}
          <div className="pt-2">
            <RankingPodium
              sellers={sellerStats}
              formatCurrency={formatCurrency}
              metaBySellerName={metaBySellerName}
              expectedPercent={percentTempo}
              todayBySellerName={todayBySellerName}
            />
          </div>

          {/* Table */}
          <div className="bg-card rounded-[14px] shadow-card border border-ink-200 p-6">
            <Tabs defaultValue="ranking">
              <TabsList className="mb-4">
                <TabsTrigger value="ranking">Ranking</TabsTrigger>
                <TabsTrigger value="meta-diaria">Meta Diária</TabsTrigger>
              </TabsList>
              <TabsContent value="ranking">
                <RankingTable
                  sellers={sellerStats}
                  formatCurrency={formatCurrency}
                  changedPositions={changedPositions}
                  metaBySellerName={metaBySellerName}
                />
              </TabsContent>
              <TabsContent value="meta-diaria">
                <DailyGoalTable
                  sellers={sellerStats}
                  metaBySellerName={metaBySellerName}
                  stats={periodStats}
                  elapsedDayKeys={elapsedDayKeys}
                  geralIndicators={geralIndicators}
                />

              </TabsContent>
            </Tabs>
          </div>
        </div>





      </div>
    </Layout>
  );
};

export default Ranking;
