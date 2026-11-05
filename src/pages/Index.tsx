import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import MetricCard from '@/components/dashboard/MetricCard';
import PageHeader from '@/components/PageHeader';
import { SalesLineChart, CourseBarChart, PaymentPieChart } from '@/components/dashboard/SalesChart';
import RecentSales from '@/components/dashboard/RecentSales';
import MetaGeralWidget from '@/components/dashboard/MetaGeralWidget';
import { DollarSign, Users, TrendingUp, Target } from 'lucide-react';
import { storage } from '@/lib/storage';
import { getNegocios } from '@/lib/crm-storage';

const Index = () => {
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalReceived: 0,
    totalPending: 0,
    totalEnrollments: 0,
    activeEnrollments: 0,
    cancelledEnrollments: 0,
    monthSales: 0,
    monthReceived: 0,
    monthPending: 0,
    previousMonthSales: 0,
    salesForecast: 0,
  });

  useEffect(() => {
    const loadMetrics = async () => {
      const [sales, negocios, installments] = await Promise.all([
        storage.getSales(),
        getNegocios(),
        storage.getInstallments()
      ]);
      
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

      const totalEnrollments = sales.reduce((sum, sale) => sum + sale.quantity, 0);
      const activeEnrollments = sales.filter(s => s.status !== 'cancelada').reduce((sum, sale) => sum + sale.quantity, 0);
      const cancelledEnrollments = sales.filter(s => s.status === 'cancelada').reduce((sum, sale) => sum + sale.quantity, 0);
      
      // Calculate received and pending from ALL installments (including from cancelled sales)
      const totalReceived = installments
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (i.paidAmount ?? i.value), 0);
      const totalPending = installments
        .filter(i => i.status !== 'paid' && i.status !== 'refunded')
        .reduce((sum, i) => sum + i.value, 0);
      const totalSales = totalReceived + totalPending;

      // Get sale IDs for current month (all sales, not just active)
      const monthSaleIds = new Set(
        sales
          .filter(sale => {
            const [year, month] = sale.date.split('-');
            return parseInt(month) - 1 === currentMonth && parseInt(year) === currentYear;
          })
          .map(s => s.id)
      );

      const monthInstallments = installments.filter(i => monthSaleIds.has(i.saleId));
      const monthReceived = monthInstallments
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (i.paidAmount ?? i.value), 0);
      const monthPending = monthInstallments
        .filter(i => i.status !== 'paid' && i.status !== 'refunded')
        .reduce((sum, i) => sum + i.value, 0);
      const monthSales = monthReceived + monthPending;

      const previousMonthSales = sales
        .filter(sale => {
          const [year, month] = sale.date.split('-');
          return parseInt(month) - 1 === prevMonth && parseInt(year) === prevYear;
        })
        .reduce((sum, sale) => sum + sale.amount, 0);

      const salesForecast = negocios
        .filter(n => n.status !== 'perdido' && n.status !== 'fechado')
        .reduce((sum, n) => sum + (n.valor || 0), 0);

      setMetrics({
        totalSales,
        totalReceived,
        totalPending,
        totalEnrollments,
        activeEnrollments,
        cancelledEnrollments,
        monthSales,
        monthReceived,
        monthPending,
        previousMonthSales,
        salesForecast,
      });
    };
    
    loadMetrics();
  }, []);

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
          title="Dashboard"
          subtitle="Visão geral das suas vendas e matrículas"
        />

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricCard
            highlight
            title="Total de Vendas"
            value={formatCurrency(metrics.totalSales)}
            icon={DollarSign}
            iconColor="text-primary"
            subtitle={`Recebido: ${formatCurrency(metrics.totalReceived)} · A receber: ${formatCurrency(metrics.totalPending)}`}
          />
          <MetricCard
            title="Matrículas"
            value={metrics.totalEnrollments}
            icon={Users}
            iconColor="text-success"
            subtitle={`Ativas: ${metrics.activeEnrollments} · Canceladas: ${metrics.cancelledEnrollments}`}
          />
          <MetricCard
            title="Vendas do Mês"
            value={formatCurrency(metrics.monthSales)}
            icon={TrendingUp}
            iconColor="text-warning"
            subtitle={`Recebido: ${formatCurrency(metrics.monthReceived)} · A receber: ${formatCurrency(metrics.monthPending)}`}
            trend={metrics.previousMonthSales > 0 ? {
              value: `${((metrics.monthSales - metrics.previousMonthSales) / metrics.previousMonthSales * 100).toFixed(1)}% vs mês anterior`,
              positive: metrics.monthSales >= metrics.previousMonthSales
            } : undefined}
          />
          <MetricCard
            title="Previsão de Vendas"
            value={formatCurrency(metrics.salesForecast)}
            icon={Target}
            iconColor="text-chart-4"
          />
        </div>

        {/* Meta Geral Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MetaGeralWidget />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesLineChart />
          <CourseBarChart />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PaymentPieChart />
          <div className="bg-card rounded-[14px] shadow-card p-5 border border-ink-200">
            <h3 className="font-display text-[17px] mb-4 text-ink-950">Atividades Recentes</h3>
            <RecentSales formatCurrency={formatCurrency} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
