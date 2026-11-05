import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';
import { Loader2, TrendingUp, TrendingDown, Minus, FileDown, Printer, CalendarIcon, Target } from 'lucide-react';
import { generateMonthlyClosingPDF } from './MonthlyClosingPDF';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, getMonth, getYear, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getMetaGeralAtiva, getMetasVendedoresAtivas, type MetaGeral, type MetaVendedor } from '@/lib/metas-storage';
import { getCategoriasCustoOperacional } from '@/lib/categorias-storage';
import { resolverCompetencia, valorConta, formatCompetencia, ORIGEM_LABEL } from '@/lib/custoOperacional';
import { useAuth } from '@/hooks/useAuth';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


// ─── Types ────────────────────────────────────────────────────────────
interface Sale {
  id: string;
  studentName: string;
  course: string;
  paymentMode: string;
  amount: number;
  quantity: number;
  date: string;
  seller: string;
  vendedorId?: string;
  valorEmpresa?: number;
  status?: string;
  tipoBoleto?: 'proprio' | 'repasse';
}

interface Installment {
  id: string;
  saleId: string;
  studentName: string;
  course: string;
  installmentNumber: number;
  totalInstallments: number;
  value: number;
  dueDate: string;
  status: 'pending' | 'due_today' | 'overdue' | 'paid' | 'refunded';
  paidDate?: string;
  paidAmount?: number;
  fullValue?: number;
  companyValue?: number;
  isRepasse?: boolean;
}

interface PaymentLogEntry {
  installment_id: string;
  valor: number;
  data_pagamento: string;
}

interface Vendedor { id: string; nome: string }
interface Lancamento {
  id: string;
  campanha_id: string;
  data: string;
  valor_gasto: number;
  leads: number;
  alunos_convertidos: number;
}
interface Campanha {
  id: string;
  nome: string;
  plataforma: string;
  categoria: string;
}
interface ContaPagar {
  id: string;
  descricao: string;
  categoria: string;
  valor: number;
  valor_pago?: number;
  valor_total?: number;
  data_vencimento: string;
  status: string;
  data_pagamento?: string;
  credor_id: string;
  mes_referencia?: string;
  created_at?: string;

}
interface Credor { id: string; nome: string }

// ─── Helpers ──────────────────────────────────────────────────────────
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const pct = (cur: number, prev: number) => {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

const CompIndicator = ({ current, previous, isCurrency = true, invertColors = false }: {
  current: number; previous: number; isCurrency?: boolean; invertColors?: boolean;
}) => {
  const diff = current - previous;
  const p = pct(current, previous);
  const isPositive = diff > 0;
  const isNeutral = diff === 0;
  // For costs, positive = bad (red), for revenue positive = good (green)
  const colorPositive = invertColors ? 'text-destructive' : 'text-[#07714E]';
  const colorNegative = invertColors ? 'text-[#07714E]' : 'text-destructive';

  return (
    <div className={`flex items-center gap-1 text-sm ${isNeutral ? 'text-muted-foreground' : isPositive ? colorPositive : colorNegative}`}>
      {isNeutral ? <Minus className="h-3 w-3" /> : isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      <span>
        {isPositive ? '+' : ''}{isCurrency ? fmt(diff) : diff.toFixed(0)} ({isPositive ? '+' : ''}{p.toFixed(1)}%)
      </span>
    </div>
  );
};

const MetricBox = ({ label, value, previous, isCurrency = true, invertColors = false, className = '' }: {
  label: string; value: number; previous: number; isCurrency?: boolean; invertColors?: boolean; className?: string;
}) => (
  <div className={`rounded-lg p-4 ${className}`}>
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{isCurrency ? fmt(value) : value}</p>
    <CompIndicator current={value} previous={previous} isCurrency={isCurrency} invertColors={invertColors} />
  </div>
);

// ─── Month options ────────────────────────────────────────────────────
const buildMonthOptions = () => {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = subMonths(now, i);
    const val = `${getYear(d)}-${String(getMonth(d) + 1).padStart(2, '0')}`;
    const label = format(d, 'MMMM yyyy', { locale: ptBR });
    options.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
};

// ─── Component ────────────────────────────────────────────────────────
const MonthlyClosingReport = () => {
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [sales, setSales] = useState<Sale[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([]);
  const [credores, setCredores] = useState<Credor[]>([]);
  const [metaGeral, setMetaGeral] = useState<MetaGeral | null>(null);
  const [metasVendedores, setMetasVendedores] = useState<MetaVendedor[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<PaymentLogEntry[]>([]);
  const [categoriasCusto, setCategoriasCusto] = useState<string[]>([]);
  const [diagnostico, setDiagnostico] = useState(false);
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);


  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    // Use selected month as reference date for metas
    const [sy, sm] = selectedMonth.split('-').map(Number);
    const refDate = new Date(sy, sm - 1, 15); // mid-month to safely match

    try {
      setLoading(true);

      // Pagination helper to bypass 1000-row limit
      const fetchAll = async <T,>(buildQuery: () => any): Promise<T[]> => {
        const PAGE_SIZE = 1000;
        let all: T[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
          if (error) throw error;
          if (data) all = [...all, ...data];
          if (!data || data.length < PAGE_SIZE) break;
          from += PAGE_SIZE;
        }
        return all;
      };

      const [salesData, installmentsData, vendData, lancData, campData, contasRaw, credData, mgData, mvData, logsResult, categoriasCustoData] = await Promise.all([
        storage.getSales(),
        storage.getInstallments(),
        (async () => {
          const [{ data: vends }, { data: roles }] = await Promise.all([
            supabase.from('vendedores').select('id, nome, user_id').eq('ativo', true).order('nome'),
            supabase.from('user_roles').select('user_id, role').eq('role', 'vendedor'),
          ]);
          const vendedorUserIds = new Set((roles || []).map((r: any) => r.user_id));
          return ((vends || []) as any[]).filter(v => v.user_id && vendedorUserIds.has(v.user_id));
        })(),
        fetchAll<Lancamento>(() => supabase.from('lancamentos_campanha').select('id, campanha_id, data, valor_gasto, leads, alunos_convertidos')),
        fetchAll<Campanha>(() => supabase.from('campanhas_trafego').select('id, nome, plataforma, categoria')),
        fetchAll<any>(() => supabase.from('contas_pagar').select('*').order('data_vencimento')),
        fetchAll<Credor>(() => supabase.from('credores').select('id, nome')),
        getMetaGeralAtiva(refDate),
        getMetasVendedoresAtivas(refDate),
        fetchAll<PaymentLogEntry>(() => supabase.from('installment_payments').select('installment_id, valor, data_pagamento')),
        getCategoriasCustoOperacional(),
      ]);
      setSales(salesData as Sale[]);
      setInstallments(installmentsData as Installment[]);
      setVendedores(vendData);
      setLancamentos(lancData);
      setCampanhas(campData);
      setContasPagar(contasRaw.map((r: any) => ({
        id: r.id, descricao: r.descricao, categoria: r.categoria,
        valor: Number(r.valor), valor_pago: r.valor_pago ? Number(r.valor_pago) : undefined,
        valor_total: r.valor_total ? Number(r.valor_total) : undefined,
        data_vencimento: r.data_vencimento, status: r.status,
        data_pagamento: r.data_pagamento || undefined, credor_id: r.credor_id,
        mes_referencia: r.mes_referencia || undefined,
        created_at: r.created_at || undefined,
      })));
      setCredores(credData);
      setMetaGeral(mgData);
      setMetasVendedores(mvData);
      setPaymentLogs(logsResult);
      setCategoriasCusto(categoriasCustoData);

    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Parse selected month
  const [selYear, selMon] = selectedMonth.split('-').map(Number);
  const currentStart = startOfMonth(new Date(selYear, selMon - 1));
  const currentEnd = endOfMonth(currentStart);
  const prevStart = startOfMonth(subMonths(currentStart, 1));
  const prevEnd = endOfMonth(prevStart);

  const inRange = (dateStr: string, start: Date, end: Date) => {
    try {
      const d = parseISO(dateStr);
      return isWithinInterval(d, { start, end });
    } catch { return false; }
  };

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 1: Financial Movements
  // ═══════════════════════════════════════════════════════════════════
  const sec1 = useMemo(() => {
    const paidCur = installments.filter(i => i.status === 'paid' && i.paidDate && inRange(i.paidDate, currentStart, currentEnd));
    const paidPrev = installments.filter(i => i.status === 'paid' && i.paidDate && inRange(i.paidDate, prevStart, prevEnd));
    const receivedCur = paidCur.reduce((s, i) => s + (i.paidAmount ?? i.fullValue ?? i.value), 0);
    const receivedPrev = paidPrev.reduce((s, i) => s + (i.paidAmount ?? i.fullValue ?? i.value), 0);

    // Add partial payments from pending installments to received totals (exclude refunded)
    const partialCur = installments.filter(i => i.status !== 'paid' && i.status !== 'refunded' && (i.paidAmount || 0) > 0);
    const partialReceivedCur = partialCur.reduce((s, i) => s + (i.paidAmount || 0), 0);

    const openCur = installments.filter(i => i.status !== 'paid' && i.status !== 'refunded');
    const openPrev = installments.filter(i => {
      if (i.status === 'refunded') return false;
      if (i.status === 'paid' && i.paidDate) {
        return parseISO(i.paidDate) > prevEnd;
      }
      return i.status !== 'paid';
    });
    // i.value is already the remaining balance after partial payments
    const toReceiveCur = openCur.reduce((s, i) => s + i.value, 0);
    const toReceivePrev = openPrev.reduce((s, i) => s + i.value, 0);
    const openCountCur = openCur.length;
    const openCountPrev = openPrev.length;

    return { receivedCur: receivedCur + partialReceivedCur, receivedPrev, toReceiveCur, toReceivePrev, openCountCur, openCountPrev };
  }, [installments, currentStart, currentEnd, prevStart, prevEnd]);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 2: Sales — Ledger-first revenue attribution (matches Ranking)
  // ═══════════════════════════════════════════════════════════════════
  const sec2 = useMemo(() => {
    const curStartStr = format(currentStart, 'yyyy-MM-dd');
    const curEndStr = format(currentEnd, 'yyyy-MM-dd');
    const prevStartStr = format(prevStart, 'yyyy-MM-dd');
    const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

    // Sales in the period (for count metrics only)
    const salesCur = sales.filter(s => s.status !== 'cancelada' && inRange(s.date, currentStart, currentEnd));
    const salesPrev = sales.filter(s => s.status !== 'cancelada' && inRange(s.date, prevStart, prevEnd));
    const cancelCur = sales.filter(s => s.status === 'cancelada' && inRange(s.date, currentStart, currentEnd)).length;
    const cancelPrev = sales.filter(s => s.status === 'cancelada' && inRange(s.date, prevStart, prevEnd)).length;

    // Build sale lookup maps (ALL sales, not just current period)
    const salesMap = new Map(sales.map(s => [s.id, s]));

    const isBoleto = (sale: Sale | undefined) => sale?.paymentMode?.toLowerCase().includes('boleto');

    // Helper: calculate revenue for a period using ledger-first approach (same as Ranking)
    const calcRevenueForPeriod = (periodStart: string, periodEnd: string) => {
      const bySellerMap: Record<string, { nome: string; count: number; received: number }> = {};
      const byModeMap: Record<string, { count: number; value: number; toReceive: number }> = {};
      let totalReceived = 0;
      const countedSaleIds = new Set<string>();

      // Iterate ALL sales (revenue comes from payments, not sale date)
      sales.forEach(sale => {
        const isSaleBoleto = isBoleto(sale);

        // Get relevant installments for this sale
        const saleInstallments = installments.filter(
          inst => inst.saleId === sale.id
            && inst.status !== 'refunded'
            && (!isSaleBoleto || inst.installmentNumber === 0)
            && (inst.status === 'paid' || (inst.paidAmount || 0) > 0)
        );

        let totalForSale = 0;

        saleInstallments.forEach(inst => {
          const instLogs = paymentLogs.filter(log => log.installment_id === inst.id);

          if (instLogs.length > 0) {
            // LEDGER-FIRST: only count payments within the period
            const logsInPeriod = instLogs.filter(
              log => log.data_pagamento >= periodStart && log.data_pagamento <= periodEnd
            );
            totalForSale += logsInPeriod.reduce((sum, log) => sum + Number(log.valor), 0);
          } else if (inst.status === 'paid' && inst.paidDate) {
            // FALLBACK for pre-ledger installments
            if (inst.paidDate >= periodStart && inst.paidDate <= periodEnd) {
              const amount = inst.paidAmount ?? inst.fullValue ?? inst.value;
              if (sale.tipoBoleto === 'repasse' && inst.isRepasse) {
                totalForSale += inst.companyValue || amount;
              } else {
                totalForSale += amount;
              }
            }
          }
        });

        if (totalForSale === 0) return;

        totalReceived += totalForSale;
        countedSaleIds.add(sale.id);

        // By seller
        const nome = vendedores.find(v => v.id === sale.vendedorId)?.nome || sale.seller || 'Não identificado';
        if (!bySellerMap[nome]) bySellerMap[nome] = { nome, count: 0, received: 0 };
        bySellerMap[nome].received += totalForSale;
        bySellerMap[nome].count += 1;

        // By payment mode
        if (!byModeMap[sale.paymentMode]) byModeMap[sale.paymentMode] = { count: 0, value: 0, toReceive: 0 };
        byModeMap[sale.paymentMode].value += totalForSale;
      });

      return { totalReceived, bySellerMap, byModeMap, countedSaleIds };
    };

    const curResult = calcRevenueForPeriod(curStartStr, curEndStr);
    const prevResult = calcRevenueForPeriod(prevStartStr, prevEndStr);

    // By mode: set sale counts from salesCur (active sales in period)
    const byModeCur = curResult.byModeMap;
    salesCur.forEach(s => {
      if (!byModeCur[s.paymentMode]) byModeCur[s.paymentMode] = { count: 0, value: 0, toReceive: 0 };
      byModeCur[s.paymentMode].count++;
    });
    // Reset counts to only count sales in the period (not from revenue attribution)
    Object.keys(byModeCur).forEach(mode => {
      byModeCur[mode].count = salesCur.filter(s => s.paymentMode === mode).length;
    });

    // A Receber: unpaid installments for active sales in the period
    const activeCurSaleIds = new Set(salesCur.map(s => s.id));
    installments.filter(i =>
      i.status !== 'paid' && i.status !== 'refunded' && activeCurSaleIds.has(i.saleId)
    ).forEach(inst => {
      const sale = salesMap.get(inst.saleId);
      if (sale) {
        if (!byModeCur[sale.paymentMode]) byModeCur[sale.paymentMode] = { count: 0, value: 0, toReceive: 0 };
        if (sale.tipoBoleto === 'repasse' && inst.isRepasse) {
          byModeCur[sale.paymentMode].toReceive += inst.companyValue || inst.value;
        } else {
          byModeCur[sale.paymentMode].toReceive += inst.value;
        }
      }
    });

    // Seller ranking: use sale counts from salesCur, received from ledger
    const bySellerCur = curResult.bySellerMap;
    // Ensure all sellers with sales in the period appear, even if no revenue yet
    salesCur.forEach(s => {
      const nome = vendedores.find(v => v.id === s.vendedorId)?.nome || s.seller || 'Não identificado';
      if (!bySellerCur[nome]) bySellerCur[nome] = { nome, count: 0, received: 0 };
    });
    // Fix counts: use only active sales in the period for count
    Object.keys(bySellerCur).forEach(nome => {
      bySellerCur[nome].count = salesCur.filter(s => {
        const sellerName = vendedores.find(v => v.id === s.vendedorId)?.nome || s.seller || 'Não identificado';
        return sellerName === nome;
      }).length;
    });

    const bySellerPrev = prevResult.bySellerMap;
    // Fix prev counts too
    const salesPrevActive = sales.filter(s => s.status !== 'cancelada' && inRange(s.date, prevStart, prevEnd));
    salesPrevActive.forEach(s => {
      const nome = vendedores.find(v => v.id === s.vendedorId)?.nome || s.seller || 'Não identificado';
      if (!bySellerPrev[nome]) bySellerPrev[nome] = { nome, count: 0, received: 0 };
    });
    Object.keys(bySellerPrev).forEach(nome => {
      bySellerPrev[nome].count = salesPrevActive.filter(s => {
        const sellerName = vendedores.find(v => v.id === s.vendedorId)?.nome || s.seller || 'Não identificado';
        return sellerName === nome;
      }).length;
    });

    // Incluir todos os vendedores ativos, mesmo sem vendas (aparecem zerados)
    vendedores.forEach(v => {
      if (!bySellerCur[v.nome]) {
        bySellerCur[v.nome] = { nome: v.nome, count: 0, received: 0 };
      }
    });

    const sellerRanking = Object.values(bySellerCur).sort((a, b) => b.received - a.received);

    return {
      totalCur: salesCur.length, totalPrev: salesPrev.length,
      cancelCur, cancelPrev,
      receivedCur: curResult.totalReceived, receivedPrev: prevResult.totalReceived,
      byModeCur,
      sellerRanking, bySellerPrev,
    };
  }, [sales, installments, paymentLogs, vendedores, currentStart, currentEnd, prevStart, prevEnd]);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 3: Delinquency
  // ═══════════════════════════════════════════════════════════════════
  const sec3 = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const overdue = installments.filter(i => i.status !== 'paid' && i.status !== 'refunded' && parseISO(i.dueDate) < hoje);

    const byStudent: Record<string, { nome: string; parcelas: number; valor: number }> = {};
    overdue.forEach(i => {
      if (!byStudent[i.studentName]) byStudent[i.studentName] = { nome: i.studentName, parcelas: 0, valor: 0 };
      byStudent[i.studentName].parcelas++;
      byStudent[i.studentName].valor += i.value;
    });

    const sorted = Object.values(byStudent).sort((a, b) => b.valor - a.valor);
    const top10 = sorted.slice(0, 10);
    const rest = sorted.slice(10);
    const restParcelas = rest.reduce((s, a) => s + a.parcelas, 0);
    const restValor = rest.reduce((s, a) => s + a.valor, 0);

    return { total: sorted.length, top10, restCount: rest.length, restParcelas, restValor };
  }, [installments]);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 4: Paid Traffic
  // ═══════════════════════════════════════════════════════════════════
  const sec4 = useMemo(() => {
    const lancCur = lancamentos.filter(l => inRange(l.data, currentStart, currentEnd));
    const lancPrev = lancamentos.filter(l => inRange(l.data, prevStart, prevEnd));

    const gastoCur = lancCur.reduce((s, l) => s + Number(l.valor_gasto), 0);
    const gastoPrev = lancPrev.reduce((s, l) => s + Number(l.valor_gasto), 0);
    const leadsCur = lancCur.reduce((s, l) => s + l.leads, 0);
    const leadsPrev = lancPrev.reduce((s, l) => s + l.leads, 0);
    const convCur = lancCur.reduce((s, l) => s + l.alunos_convertidos, 0);
    const convPrev = lancPrev.reduce((s, l) => s + l.alunos_convertidos, 0);
    const cplCur = leadsCur > 0 ? gastoCur / leadsCur : 0;
    const cplPrev = leadsPrev > 0 ? gastoPrev / leadsPrev : 0;
    const cpaCur = convCur > 0 ? gastoCur / convCur : 0;
    const cpaPrev = convPrev > 0 ? gastoPrev / convPrev : 0;
    const taxaCur = leadsCur > 0 ? (convCur / leadsCur) * 100 : 0;
    const taxaPrev = leadsPrev > 0 ? (convPrev / leadsPrev) * 100 : 0;

    // Campaigns with activity this month
    const campIdsWithActivity = new Set(lancCur.map(l => l.campanha_id));
    const activeCampaigns = campanhas
      .filter(c => campIdsWithActivity.has(c.id))
      .map(c => {
        const cLancs = lancCur.filter(l => l.campanha_id === c.id);
        return {
          ...c,
          gasto: cLancs.reduce((s, l) => s + Number(l.valor_gasto), 0),
          leads: cLancs.reduce((s, l) => s + l.leads, 0),
          conversoes: cLancs.reduce((s, l) => s + l.alunos_convertidos, 0),
        };
      });

    return {
      gastoCur, gastoPrev, leadsCur, leadsPrev, convCur, convPrev,
      cplCur, cplPrev, cpaCur, cpaPrev, taxaCur, taxaPrev,
      activeCampaigns,
    };
  }, [lancamentos, campanhas, currentStart, currentEnd, prevStart, prevEnd]);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 5: Payables — REGIME DE CAIXA (data de pagamento)
  // ═══════════════════════════════════════════════════════════════════
  const sec5 = useMemo(() => {
    const paidCur = contasPagar.filter(c => c.status === 'pago' && c.data_pagamento && inRange(c.data_pagamento, currentStart, currentEnd));
    const paidPrev = contasPagar.filter(c => c.status === 'pago' && c.data_pagamento && inRange(c.data_pagamento, prevStart, prevEnd));
    const pendCur = contasPagar.filter(c => c.status !== 'pago' && c.data_vencimento && inRange(c.data_vencimento, currentStart, currentEnd));

    const paidValCur = paidCur.reduce((s, c) => s + valorConta(c), 0);
    const paidValPrev = paidPrev.reduce((s, c) => s + valorConta(c), 0);
    const pendValCur = pendCur.reduce((s, c) => s + c.valor, 0);

    const getCredorNome = (id: string) => credores.find(c => c.id === id)?.nome || 'Desconhecido';

    return {
      paidValCur, paidValPrev,
      paidCountCur: paidCur.length, paidCountPrev: paidPrev.length,
      pendValCur, pendCountCur: pendCur.length,
      paidList: paidCur.map(c => ({ ...c, credorNome: getCredorNome(c.credor_id) })),
      pendList: pendCur.map(c => ({ ...c, credorNome: getCredorNome(c.credor_id) })),
    };
  }, [contasPagar, credores, currentStart, currentEnd, prevStart, prevEnd]);

  // ═══════════════════════════════════════════════════════════════════
  // SECTION 6: Custo Operacional — REGIME DE COMPETÊNCIA (mês de referência)
  // ═══════════════════════════════════════════════════════════════════
  const sec6 = useMemo(() => {
    const getCredorNome = (id: string) => credores.find(c => c.id === id)?.nome || 'Desconhecido';
    const isCusto = (c: ContaPagar) => !!c.categoria && categoriasCusto.includes(c.categoria);

    const prevComp = `${getYear(prevStart)}-${String(getMonth(prevStart) + 1).padStart(2, '0')}`;

    const enriched = contasPagar
      .filter(isCusto)
      .map(c => {
        const r = resolverCompetencia(c);
        return { ...c, credorNome: getCredorNome(c.credor_id), competencia: r.competencia, origem: r.origem, valorConsiderado: valorConta(c) };
      });

    const list = enriched
      .filter(c => c.competencia === selectedMonth)
      .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''));

    const totalCur = list.reduce((s, c) => s + c.valorConsiderado, 0);
    const totalPrev = enriched.filter(c => c.competencia === prevComp).reduce((s, c) => s + c.valorConsiderado, 0);
    const pagoCur = list.filter(c => c.status === 'pago').reduce((s, c) => s + c.valorConsiderado, 0);
    const pendenteCur = list.filter(c => c.status !== 'pago').reduce((s, c) => s + c.valorConsiderado, 0);

    // Por categoria (subtotais)
    const byCategoria = Object.values(
      list.reduce((acc, c) => {
        acc[c.categoria] = acc[c.categoria] || { categoria: c.categoria, count: 0, valor: 0 };
        acc[c.categoria].count += 1;
        acc[c.categoria].valor += c.valorConsiderado;
        return acc;
      }, {} as Record<string, { categoria: string; count: number; valor: number }>)
    ).sort((a, b) => b.valor - a.valor);

    const byOrigem = list.reduce((acc, c) => {
      acc[c.origem] = (acc[c.origem] || 0) + c.valorConsiderado;
      return acc;
    }, {} as Record<string, number>);

    const foraDaCompetencia = enriched
      .filter(c => c.competencia !== selectedMonth)
      .sort((a, b) => (a.competencia || '').localeCompare(b.competencia || ''));

    return { list, totalCur, totalPrev, pagoCur, pendenteCur, byCategoria, byOrigem, foraDaCompetencia };
  }, [contasPagar, credores, categoriasCusto, selectedMonth, prevStart]);


  // ─── Metas computation ──────────────────────────────────────────────
  const metaBySellerName = useMemo(() => {
    const map = new Map<string, number>();
    metasVendedores.forEach(mv => {
      if (mv.vendedor?.nome) map.set(mv.vendedor.nome, mv.valor);
    });
    // Also match by vendedor_id
    sec2.sellerRanking.forEach(s => {
      const vend = vendedores.find(v => v.nome === s.nome);
      if (vend) {
        const mv = metasVendedores.find(m => m.vendedor_id === vend.id);
        if (mv) map.set(s.nome, mv.valor);
      }
    });
    return map;
  }, [metasVendedores, vendedores, sec2.sellerRanking]);

  const metaGeralPercent = metaGeral ? Math.min((sec2.receivedCur / metaGeral.valor) * 100, 100) : 0;
  const hasMetas = metaBySellerName.size > 0;

  // ─── PDF / Print ────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    // Build meta data for PDF
    const metaSellerData: Record<string, number> = {};
    metaBySellerName.forEach((val, key) => { metaSellerData[key] = val; });

    await generateMonthlyClosingPDF({
      selectedLabel: monthOptions.find(o => o.value === selectedMonth)?.label || '',
      prevLabel: (() => {
        const l = format(prevStart, 'MMMM yyyy', { locale: ptBR });
        return l.charAt(0).toUpperCase() + l.slice(1);
      })(),
      sec1, sec2, sec3, sec4, sec5,
      sec6: {
        totalCur: sec6.totalCur, totalPrev: sec6.totalPrev,
        pagoCur: sec6.pagoCur, pendenteCur: sec6.pendenteCur,
        byCategoria: sec6.byCategoria,
        list: sec6.list.map(c => ({
          descricao: c.descricao, credorNome: c.credorNome, categoria: c.categoria,
          competencia: formatCompetencia(c.competencia), status: c.status,
          valorConsiderado: c.valorConsiderado,
          data_pagamento: c.data_pagamento,
        })),
      },

      metaGeral: metaGeral ? { valor: metaGeral.valor } : undefined,
      metaBySellerName: metaSellerData,
    });
    toast.success('PDF gerado com sucesso!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedLabel = monthOptions.find(o => o.value === selectedMonth)?.label || '';
  const prevLabel = format(prevStart, 'MMMM yyyy', { locale: ptBR });
  const prevLabelCap = prevLabel.charAt(0).toUpperCase() + prevLabel.slice(1);

  return (
    <div className="space-y-6">
      {/* Month selector - hidden on print */}
      <div id="monthly-report-controls" className="flex flex-col sm:flex-row gap-4 items-start sm:items-end print:hidden">
        <div className="space-y-2">
          <p className="text-sm font-medium">Mês de Referência</p>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[240px]">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { loadData(); setShowReport(true); }} className="gap-2">
            Gerar Relatório
          </Button>
          {showReport && (
            <>
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
                <FileDown className="h-4 w-4" />
                Baixar PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {showReport && (
        <div className="space-y-6 print:space-y-4 print:block" id="monthly-closing-report">
          {/* Header */}
          <Card>
            <CardHeader className="text-center border-b">
              <CardTitle className="text-xl">FECHAMENTO DO MÊS — {selectedLabel.toUpperCase()}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Comparativo com {prevLabelCap} • Gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </CardHeader>
          </Card>

          {/* ══════ SEÇÃO 1 ══════ */}
          <Card>
            <CardHeader><CardTitle className="text-lg">1. MOVIMENTAÇÕES FINANCEIRAS DO MÊS</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <MetricBox label="Valor Total Recebido" value={sec1.receivedCur} previous={sec1.receivedPrev} className="bg-[#E7F7F0]" />
                <MetricBox label="Valor Total a Receber" value={sec1.toReceiveCur} previous={sec1.toReceivePrev} className="bg-[#FFF1E7]" />
                <MetricBox label="Parcelas em Aberto" value={sec1.openCountCur} previous={sec1.openCountPrev} isCurrency={false} className="bg-muted/50" />
              </div>
            </CardContent>
          </Card>

          {/* ══════ SEÇÃO 2 ══════ */}
          <Card>
            <CardHeader><CardTitle className="text-lg">2. VENDAS DO MÊS</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className={`grid grid-cols-1 gap-4 ${metaGeral ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div className="rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">Quantidade de Vendas (ativas)</p>
                  <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{sec2.totalCur}</p>
                  <CompIndicator current={sec2.totalCur} previous={sec2.totalPrev} isCurrency={false} />
                  {sec2.cancelCur > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      + {sec2.cancelCur} cancelada(s) · Total no mês: {sec2.totalCur + sec2.cancelCur}
                    </p>
                  )}
                </div>
                <MetricBox label="Valor Recebido (vendas do mês)" value={sec2.receivedCur} previous={sec2.receivedPrev} className="bg-[#E7F7F0]" />
                {metaGeral && (() => {
                  const remaining = Math.max(metaGeral.valor - sec2.receivedCur, 0);
                  const atingiu = sec2.receivedCur >= metaGeral.valor;
                  return (
                    <div className={`rounded-lg p-4 ${atingiu ? 'bg-[#E7F7F0]' : 'bg-[#FDECEC]'}`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm text-muted-foreground">
                          {atingiu ? 'Acima da Meta 🎉' : 'Restante p/ Meta'}
                        </p>
                        <Target className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className={`font-display text-[26px] leading-8 font-bold tabular-nums ${atingiu ? 'text-[#07714E]' : 'text-destructive'}`}>
                        {fmt(remaining)}
                      </p>
                    </div>
                  );
                })()}
              </div>

              {/* Meta Geral Progress */}
              {metaGeral && (
                <div className="bg-muted/30 rounded-lg p-4 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Target className="h-4 w-4 text-primary" />
                      Meta Geral da Equipe
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {fmt(sec2.receivedCur)} / {fmt(metaGeral.valor)} — {metaGeralPercent.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={metaGeralPercent} className="h-3" />
                  {sec2.receivedCur >= metaGeral.valor && (
                    <p className="text-sm text-[#07714E] font-semibold mt-2">🎉 Meta atingida!</p>
                  )}
                </div>
              )}

              {/* Seller ranking */}
              {sec2.sellerRanking.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Ranking por Vendedor</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center">Vendas</TableHead>
                        <TableHead className="text-center">Recebido</TableHead>
                        {hasMetas && (
                          <>
                            <TableHead className="text-center">Meta</TableHead>
                            <TableHead className="text-center">Diferença</TableHead>
                            <TableHead className="text-center">% Atingido</TableHead>
                          </>
                        )}
                        <TableHead className="text-center">Comparativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec2.sellerRanking.map((s, i) => {
                        const prev = sec2.bySellerPrev[s.nome];
                        const meta = metaBySellerName.get(s.nome);
                        const diff = meta ? s.received - meta : 0;
                        const pctAtingido = meta ? (s.received / meta) * 100 : 0;
                        const statusEmoji = !meta ? '' : pctAtingido >= 100 ? '🟢' : pctAtingido >= 70 ? '🟡' : '🔴';
                        return (
                          <TableRow key={s.nome}>
                            <TableCell className="font-bold">{i + 1}º</TableCell>
                            <TableCell className="font-medium">{s.nome}</TableCell>
                            <TableCell className="text-center">{s.count}</TableCell>
                            <TableCell className="text-center">{fmt(s.received)}</TableCell>
                            {hasMetas && (
                              <>
                                <TableCell className="text-center">{meta ? fmt(meta) : '—'}</TableCell>
                                <TableCell className={`text-center font-semibold ${meta ? (diff >= 0 ? 'text-[#07714E]' : 'text-destructive') : ''}`}>
                                  {meta ? `${diff >= 0 ? '+' : ''}${fmt(diff)}` : '—'}
                                </TableCell>
                                <TableCell className="text-center">{meta ? `${pctAtingido.toFixed(1)}%` : '—'}</TableCell>
                              </>
                            )}
                            <TableCell className="text-right">
                              <CompIndicator current={s.received} previous={prev?.received || 0} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Breakdown by payment mode */}
              {Object.keys(sec2.byModeCur).length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Por Modalidade de Pagamento</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modalidade</TableHead>
                        <TableHead className="text-right">Qtd. Vendas</TableHead>
                        <TableHead className="text-right">Valor Recebido</TableHead>
                        <TableHead className="text-right">A Receber</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(sec2.byModeCur).sort((a, b) => b[1].value - a[1].value).map(([mode, d]) => (
                        <TableRow key={mode}>
                          <TableCell className="font-medium">{mode}</TableCell>
                          <TableCell className="text-right">{d.count}</TableCell>
                          <TableCell className="text-right">{fmt(d.value)}</TableCell>
                          <TableCell className="text-right">{fmt(d.toReceive)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ══════ SEÇÃO 3 ══════ */}
          <Card>
            <CardHeader><CardTitle className="text-lg">3. INADIMPLÊNCIA</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Total de Alunos Inadimplentes</p>
                <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{sec3.total}</p>
              </div>

              {sec3.top10.length > 0 ? (
                <>
                  <p className="text-sm font-semibold">Top 10 Maiores Devedores</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Aluno</TableHead>
                        <TableHead className="text-center">Parcelas em Atraso</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec3.top10.map((a, i) => (
                        <TableRow key={a.nome}>
                          <TableCell className="font-bold">{i + 1}</TableCell>
                          <TableCell className="font-medium">{a.nome}</TableCell>
                          <TableCell className="text-center">{a.parcelas}</TableCell>
                          <TableCell className="text-right text-destructive font-semibold">{fmt(a.valor)}</TableCell>
                        </TableRow>
                      ))}
                      {sec3.restCount > 0 && (
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell colSpan={1}></TableCell>
                          <TableCell>+ {sec3.restCount} aluno(s)</TableCell>
                          <TableCell className="text-center">{sec3.restParcelas}</TableCell>
                          <TableCell className="text-right text-destructive">{fmt(sec3.restValor)}</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Não há alunos inadimplentes no momento.</p>
              )}
            </CardContent>
          </Card>

          {/* ══════ SEÇÃO 4 ══════ */}
          <Card>
            <CardHeader><CardTitle className="text-lg">4. TRÁFEGO PAGO DO MÊS</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <MetricBox label="Total Gasto" value={sec4.gastoCur} previous={sec4.gastoPrev} invertColors className="bg-muted/50" />
                <MetricBox label="Leads Captados" value={sec4.leadsCur} previous={sec4.leadsPrev} isCurrency={false} className="bg-muted/50" />
                <MetricBox label="Leads Convertidos" value={sec4.convCur} previous={sec4.convPrev} isCurrency={false} className="bg-[#E7F7F0]" />
                <MetricBox label="CPL Médio" value={sec4.cplCur} previous={sec4.cplPrev} invertColors className="bg-muted/50" />
                <MetricBox label="CPA Médio" value={sec4.cpaCur} previous={sec4.cpaPrev} invertColors className="bg-muted/50" />
                <div className="rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                  <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{sec4.taxaCur.toFixed(1)}%</p>
                  <CompIndicator current={sec4.taxaCur} previous={sec4.taxaPrev} isCurrency={false} />
                </div>
              </div>

              {sec4.activeCampaigns.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Campanhas com Movimentação no Mês</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campanha</TableHead>
                        <TableHead>Plataforma</TableHead>
                        <TableHead className="text-right">Gasto</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Conversões</TableHead>
                        <TableHead className="text-right">CPL</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec4.activeCampaigns.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell><Badge variant="outline">{c.plataforma}</Badge></TableCell>
                          <TableCell className="text-right">{fmt(c.gasto)}</TableCell>
                          <TableCell className="text-right">{c.leads}</TableCell>
                          <TableCell className="text-right">{c.conversoes}</TableCell>
                          <TableCell className="text-right">{c.leads > 0 ? fmt(c.gasto / c.leads) : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ══════ SEÇÃO 5 ══════ */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">5. CONTAS A PAGAR DO MÊS (Regime de Caixa)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Considera apenas a data de pagamento (pagas) e a data de vencimento (pendentes) dentro do mês.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricBox label="Total Pago" value={sec5.paidValCur} previous={sec5.paidValPrev} invertColors className="bg-[#E7F7F0]" />
                <MetricBox label="Contas Pagas" value={sec5.paidCountCur} previous={sec5.paidCountPrev} isCurrency={false} className="bg-muted/50" />
                <div className="rounded-lg p-4 bg-[#FFF1E7]">
                  <p className="text-sm text-muted-foreground">Total Pendente</p>
                  <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{fmt(sec5.pendValCur)}</p>
                </div>
                <div className="rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">Contas Pendentes</p>
                  <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{sec5.pendCountCur}</p>
                </div>
              </div>


              {/* Paid table */}
              {sec5.paidList.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Contas Pagas no Mês</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Credor</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Data Pagamento</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec5.paidList.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.descricao}</TableCell>
                          <TableCell>{c.credorNome}</TableCell>
                          <TableCell><Badge variant="outline">{c.categoria}</Badge></TableCell>
                          <TableCell className="text-right">{fmt(c.valor_total || c.valor_pago || c.valor)}</TableCell>
                          <TableCell className="text-right">{c.data_pagamento ? format(parseISO(c.data_pagamento), 'dd/MM/yyyy') : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pending table */}
              {sec5.pendList.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">Contas Pendentes no Mês</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Credor</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec5.pendList.map(c => {
                        const isOverdue = parseISO(c.data_vencimento) < new Date();
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-medium">{c.descricao}</TableCell>
                            <TableCell>{c.credorNome}</TableCell>
                            <TableCell><Badge variant="outline">{c.categoria}</Badge></TableCell>
                            <TableCell className="text-right">{fmt(c.valor)}</TableCell>
                            <TableCell className="text-right">{format(parseISO(c.data_vencimento), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant={isOverdue ? 'destructive' : 'secondary'}>
                                {isOverdue ? 'Atrasado' : 'Pendente'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ══════ SEÇÃO 6 ══════ */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">6. CUSTO OPERACIONAL (Regime de Competência)</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Considera o mês de referência (competência) das categorias marcadas como custo operacional,
                    independentemente da data de pagamento.
                  </p>
                </div>
                {isAdmin && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch checked={diagnostico} onCheckedChange={setDiagnostico} />
                    Modo diagnóstico
                  </label>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <MetricBox label="Custo Operacional" value={sec6.totalCur} previous={sec6.totalPrev} invertColors className="bg-[#FDECEC]" />
                <div className="rounded-lg p-4 bg-[#E7F7F0]">
                  <p className="text-sm text-muted-foreground">Já Pago (competência)</p>
                  <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{fmt(sec6.pagoCur)}</p>
                </div>
                <div className="rounded-lg p-4 bg-[#FFF1E7]">
                  <p className="text-sm text-muted-foreground">Pendente (competência)</p>
                  <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{fmt(sec6.pendenteCur)}</p>
                </div>
                <div className="rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground">Lançamentos</p>
                  <p className="font-display text-[26px] leading-8 font-bold tabular-nums">{sec6.list.length}</p>
                </div>
              </div>

              {sec6.byCategoria.length > 0 && (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec6.byCategoria.map(c => (
                        <TableRow key={c.categoria}>
                          <TableCell className="font-medium">{c.categoria}</TableCell>
                          <TableCell className="text-right">{c.count}</TableCell>
                          <TableCell className="text-right">{fmt(c.valor)}</TableCell>
                          <TableCell className="text-right">
                            {sec6.totalCur > 0 ? `${((c.valor / sec6.totalCur) * 100).toFixed(1)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {sec6.list.length > 0 && (
                <div className="rounded-lg border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Credor</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Competência</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Data Pagamento</TableHead>
                        {diagnostico && <TableHead>Origem</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sec6.list.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.descricao}</TableCell>
                          <TableCell>{c.credorNome}</TableCell>
                          <TableCell>{c.categoria}</TableCell>
                          <TableCell>{formatCompetencia(c.competencia)}</TableCell>
                          <TableCell>
                            <Badge variant={c.status === 'pago' ? 'default' : 'secondary'}>
                              {c.status === 'pago' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{fmt(c.valorConsiderado)}</TableCell>
                          <TableCell className="text-right">
                            {c.data_pagamento ? format(parseISO(c.data_pagamento), 'dd/MM/yyyy') : '—'}
                          </TableCell>
                          {diagnostico && (
                            <TableCell className="text-xs text-muted-foreground">{ORIGEM_LABEL[c.origem]}</TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {sec6.list.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum custo operacional na competência selecionada.
                </p>
              )}

              {diagnostico && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Diagnóstico — origem da competência</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(sec6.byOrigem).map(([origem, valor]) => (
                      <Badge key={origem} variant="outline">
                        {ORIGEM_LABEL[origem as keyof typeof ORIGEM_LABEL]}: {fmt(valor)}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sec6.foraDaCompetencia.length} lançamento(s) de custo operacional em outras competências.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>

  );
};

export default MonthlyClosingReport;
