import { useState, useMemo } from 'react';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import MetricCard from '@/components/dashboard/MetricCard';
import { DollarSign, TrendingDown, TrendingUp, Calendar, Lock } from 'lucide-react';
import { FinancialProvider, useFinancial } from '@/contexts/FinancialContext';
import ReceivablesTab from '@/components/financial/ReceivablesTab';
import ReceivedTab from '@/components/financial/ReceivedTab';
import OverdueTab from '@/components/financial/OverdueTab';
import LockedTab from '@/components/financial/LockedTab';
import CashFlowTab from '@/components/financial/CashFlowTab';
import PayablesTab from '@/components/financial/PayablesTab';
import DateVendorFilters from '@/components/filters/DateVendorFilters';
import { parseLocalDate } from '@/lib/date';

const FinancialContent = () => {
  const { installments, refreshInstallments } = useFinancial();
  const [activeTab, setActiveTab] = useState('receivables');
  const [filterDataInicio, setFilterDataInicio] = useState<Date | undefined>();
  const [filterDataFim, setFilterDataFim] = useState<Date | undefined>();
  const [filterVendedorId, setFilterVendedorId] = useState<string>('');

  const handleClearFilters = () => {
    setFilterDataInicio(undefined);
    setFilterDataFim(undefined);
    setFilterVendedorId('');
  };

  const metrics = useMemo(() => {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const next30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Total to receive (pending + overdue)
    const totalReceivable = installments
      .filter(i => i.status !== 'paid' && i.status !== 'refunded' && i.status !== 'locked')
      .reduce((sum, i) => sum + i.value, 0);

    // Received this month
    const receivedThisMonth = installments
      .filter(i => {
        if (i.status !== 'paid' || !i.paidDate) return false;
        const paidDate = parseLocalDate(i.paidDate);
        return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
      })
      .reduce((sum, i) => sum + (i.paidAmount || i.value), 0);

    // Overdue accounts
    const overdueInstallments = installments.filter(i => {
      if (i.status === 'paid' || i.status === 'refunded' || i.status === 'locked') return false;
      const dueDate = parseLocalDate(i.dueDate);
      return dueDate < todayStart;
    });
    const overdueAccounts = overdueInstallments.reduce((sum, i) => sum + i.value, 0);
    const overdueCount = overdueInstallments.length;

    // 30-day forecast
    const forecast30Days = installments
      .filter(i => {
        if (i.status === 'paid' || i.status === 'refunded' || i.status === 'locked') return false;
        const dueDate = parseLocalDate(i.dueDate);
        return dueDate >= today && dueDate <= next30Days;
      })
      .reduce((sum, i) => sum + i.value, 0);

    // Locked installments
    const lockedInstallments = installments.filter(i => i.status === 'locked');
    const lockedTotal = lockedInstallments.reduce((sum, i) => sum + i.value, 0);
    const lockedCount = lockedInstallments.length;

    return {
      totalReceivable,
      receivedThisMonth,
      overdueAccounts,
      overdueCount,
      forecast30Days,
      lockedTotal,
      lockedCount,
    };
  }, [installments]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Controle Financeiro"
          subtitle="Gestão completa de recebimentos e cobranças"
          className="mb-0"
        />

        {/* Financial Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <MetricCard
            title="Total a Receber"
            value={formatCurrency(metrics.totalReceivable)}
            icon={DollarSign}
            iconColor="text-primary"
            size="compact"
          />
          <MetricCard
            title="Recebido no Mês"
            value={formatCurrency(metrics.receivedThisMonth)}
            icon={TrendingUp}
            iconColor="text-success"
            size="compact"
          />
           <MetricCard
             title="Parcelas Inadimplentes"
             value={formatCurrency(metrics.overdueAccounts)}
             icon={TrendingDown}
             iconColor="text-destructive"
             size="compact"
             subtitle={`${metrics.overdueCount} parcela(s) inadimplente(s)`}
           />
          <MetricCard
            title="Parcelas Trancadas"
            value={formatCurrency(metrics.lockedTotal)}
            icon={Lock}
            iconColor="text-ink-700"
            size="compact"
            subtitle={`${metrics.lockedCount} parcela(s) trancada(s)`}
          />
          <MetricCard
            title="Previsão 30 Dias"
            value={formatCurrency(metrics.forecast30Days)}
            icon={Calendar}
            iconColor="text-warning"
            size="compact"
          />
        </div>

        {/* Financial Tabs */}
        <Card className="p-6">
          <div className="mb-6">
            <DateVendorFilters
              dataInicio={filterDataInicio}
              setDataInicio={setFilterDataInicio}
              dataFim={filterDataFim}
              setDataFim={setFilterDataFim}
              vendedorId={filterVendedorId}
              setVendedorId={setFilterVendedorId}
              onClearFilters={handleClearFilters}
            />
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="receivables">A Receber</TabsTrigger>
              <TabsTrigger value="received">Recebidos</TabsTrigger>
              <TabsTrigger value="overdue">Atrasados</TabsTrigger>
              <TabsTrigger value="locked">Trancados</TabsTrigger>
              <TabsTrigger value="payables">Contas a Pagar</TabsTrigger>
              <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            </TabsList>

            <TabsContent value="receivables">
              {activeTab === 'receivables' && (
                <ReceivablesTab
                  onUpdate={refreshInstallments}
                  filterDataInicio={filterDataInicio}
                  filterDataFim={filterDataFim}
                  filterVendedorId={filterVendedorId}
                />
              )}
            </TabsContent>

            <TabsContent value="received">
              {activeTab === 'received' && (
                <ReceivedTab
                  filterDataInicio={filterDataInicio}
                  filterDataFim={filterDataFim}
                  filterVendedorId={filterVendedorId}
                />
              )}
            </TabsContent>

            <TabsContent value="overdue">
              {activeTab === 'overdue' && (
                <OverdueTab
                  onUpdate={refreshInstallments}
                  filterDataInicio={filterDataInicio}
                  filterDataFim={filterDataFim}
                  filterVendedorId={filterVendedorId}
                />
              )}
            </TabsContent>

            <TabsContent value="locked">
              {activeTab === 'locked' && (
                <LockedTab filterVendedorId={filterVendedorId} />
              )}
            </TabsContent>

            <TabsContent value="payables">
              {activeTab === 'payables' && <PayablesTab />}
            </TabsContent>

            <TabsContent value="cashflow">
              {activeTab === 'cashflow' && <CashFlowTab />}
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </Layout>
  );
};

const Financial = () => {
  return (
    <FinancialProvider>
      <FinancialContent />
    </FinancialProvider>
  );
};

export default Financial;
