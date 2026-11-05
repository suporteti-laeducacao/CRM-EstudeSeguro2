import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';
import { FileDown, Eye, Loader2 } from 'lucide-react';
import FinancialReportFiltersComponent, { type FinancialReportFilters } from './FinancialReportFilters';
import FinancialReportPreview from './FinancialReportPreview';
import { generateFinancialReportPDF } from './FinancialReportPDF';
import ContasPagarReport from './ContasPagarReport';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Vendedor {
  id: string;
  nome: string;
}

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
  companyValue?: number;
}

const defaultFilters: FinancialReportFilters = {
  dataInicio: undefined,
  dataFim: undefined,
  vendedoresSelecionados: [],
  todosVendedores: true,
  valoresRecebidos: true,
  valoresAReceber: true,
  notificacoesEmAndamento: true,
  incluirAvisoBloqueio: true,
};

const FinancialReportTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const podeContasPagar = hasRole('admin') || hasRole('gerente') || hasRole('financeiro');
  const tipo = podeContasPagar && searchParams.get('tipo') === 'contas-a-pagar' ? 'contas-a-pagar' : 'recebimentos';
  const setTipo = (t: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('aba', 'financeiro');
    next.set('tipo', t);
    setSearchParams(next, { replace: true });
  };
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [filters, setFilters] = useState<FinancialReportFilters>(() => {
    const saved = localStorage.getItem('financialReportFilters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          dataInicio: parsed.dataInicio ? new Date(parsed.dataInicio) : undefined,
          dataFim: parsed.dataFim ? new Date(parsed.dataFim) : undefined,
        };
      } catch {
        return defaultFilters;
      }
    }
    return defaultFilters;
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar vendedores com paginação
      const PAGE_SIZE = 1000;
      let allVendedores: Vendedor[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from('vendedores')
          .select('id, nome')
          .eq('ativo', true)
          .order('nome')
          .range(from, from + PAGE_SIZE - 1);
        if (data) allVendedores = [...allVendedores, ...data];
        if (!data || data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      setVendedores(allVendedores);

      // Carregar vendas
      const salesData = await storage.getSales();
      setSales(salesData as Sale[]);

      // Carregar parcelas
      const installmentsData = await storage.getInstallments();
      setInstallments(installmentsData as Installment[]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const validateFilters = (): boolean => {
    if (!filters.dataInicio || !filters.dataFim) {
      toast.error('Selecione o período inicial e final');
      return false;
    }

    if (filters.dataFim < filters.dataInicio) {
      toast.error('A data final deve ser maior que a data inicial');
      return false;
    }

    if (!filters.todosVendedores && filters.vendedoresSelecionados.length === 0) {
      toast.error('Selecione pelo menos um vendedor ou marque "Todos"');
      return false;
    }

    if (!filters.valoresRecebidos && !filters.valoresAReceber) {
      toast.error('Selecione pelo menos um tipo de valor');
      return false;
    }

    return true;
  };

  const handleGeneratePreview = () => {
    if (!validateFilters()) return;
    setShowPreview(true);
  };

  const handleDownloadPDF = async () => {
    if (!validateFilters()) return;

    try {
      setGenerating(true);
      await generateFinancialReportPDF(filters, sales, installments, vendedores);
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-[22px] leading-7 text-ink-950 mb-2">Relatórios Financeiros</h2>
          {podeContasPagar && (
            <div className="flex flex-wrap gap-2 mb-3 print:hidden">
              {[['recebimentos', 'Recebimentos'], ['contas-a-pagar', 'Contas a Pagar']].map(([v, l]) => (
                <Button key={v} size="sm" variant={tipo === v ? 'default' : 'outline'} onClick={() => setTipo(v)} className={cn(tipo === v && 'pointer-events-none')}>
                  {l}
                </Button>
              ))}
            </div>
          )}
          <p className="text-muted-foreground">
            {tipo === 'contas-a-pagar'
              ? 'Saídas efetivamente pagas no período, em ordem de pagamento, para conciliação bancária'
              : 'Gere relatórios personalizados de fechamento comercial'}
          </p>
        </div>
      </div>

      {tipo === 'contas-a-pagar' ? <ContasPagarReport /> : (<>

      <FinancialReportFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        vendedores={vendedores}
      />

      {/* Botões de Ação */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleGeneratePreview} variant="outline" className="gap-2">
          <Eye className="h-4 w-4" />
          Gerar Visualização
        </Button>
        <Button onClick={handleDownloadPDF} disabled={generating} className="gap-2">
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
          Download PDF
        </Button>
      </div>

      {/* Preview do Relatório */}
      {showPreview && (
        <FinancialReportPreview
          filters={filters}
          sales={sales}
          installments={installments}
          vendedores={vendedores}
        />
      )}
      </>)}
    </div>
  );
};

export default FinancialReportTab;
