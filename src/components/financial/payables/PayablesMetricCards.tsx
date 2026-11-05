import { useMemo } from 'react';
import MetricCard from '@/components/dashboard/MetricCard';
import { AlertCircle, Calendar, CheckCircle, Clock, TrendingUp, Wallet } from 'lucide-react';
import { ContaPagar } from '@/lib/payables-types';
import { parseISO, isToday, isBefore, addDays, startOfDay, startOfYear, endOfYear } from 'date-fns';

interface PayablesMetricCardsProps {
  contasPagar: ContaPagar[];
}

const PayablesMetricCards = ({ contasPagar }: PayablesMetricCardsProps) => {
  const metrics = useMemo(() => {
    const hoje = startOfDay(new Date());
    const em7Dias = addDays(hoje, 7);
    const em30Dias = addDays(hoje, 30);
    const inicioAno = startOfYear(hoje);
    const fimAno = endOfYear(hoje);

    // Vencendo hoje
    const vencendoHoje = contasPagar.filter(c => {
      if (c.status === 'pago') return false;
      const vencimento = parseISO(c.data_vencimento);
      return isToday(vencimento);
    });
    const valorVencendoHoje = vencendoHoje.reduce((sum, c) => sum + c.valor, 0);

    // Vencidas (atrasadas)
    const vencidas = contasPagar.filter(c => {
      if (c.status === 'pago') return false;
      const vencimento = parseISO(c.data_vencimento);
      return isBefore(vencimento, hoje);
    });
    const valorVencidas = vencidas.reduce((sum, c) => sum + c.valor, 0);

    // Pagas no mês atual
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const pagasNoMes = contasPagar.filter(c => {
      if (c.status !== 'pago' || !c.data_pagamento) return false;
      const pagamento = parseISO(c.data_pagamento);
      return pagamento.getMonth() === mesAtual && pagamento.getFullYear() === anoAtual;
    });
    const valorPagoMes = pagasNoMes.reduce((sum, c) => sum + (c.valor_pago || c.valor_total || 0), 0);

    // Próximos 7 dias
    const proximos7Dias = contasPagar.filter(c => {
      if (c.status === 'pago') return false;
      const vencimento = parseISO(c.data_vencimento);
      return vencimento >= hoje && vencimento <= em7Dias;
    });
    const valorProximos7Dias = proximos7Dias.reduce((sum, c) => sum + c.valor, 0);

    // Próximos 30 dias
    const proximos30Dias = contasPagar.filter(c => {
      if (c.status === 'pago') return false;
      const vencimento = parseISO(c.data_vencimento);
      return vencimento >= hoje && vencimento <= em30Dias;
    });
    const valorProximos30Dias = proximos30Dias.reduce((sum, c) => sum + c.valor, 0);

    // Total pago no ano
    const totalPagoAno = contasPagar.filter(c => {
      if (c.status !== 'pago' || !c.data_pagamento) return false;
      const pagamento = parseISO(c.data_pagamento);
      return pagamento >= inicioAno && pagamento <= fimAno;
    }).reduce((sum, c) => sum + (c.valor_pago || c.valor_total || 0), 0);

    return {
      vencendoHoje: { valor: valorVencendoHoje, count: vencendoHoje.length },
      vencidas: { valor: valorVencidas, count: vencidas.length },
      pagasNoMes: { valor: valorPagoMes, count: pagasNoMes.length },
      proximos7Dias: { valor: valorProximos7Dias, count: proximos7Dias.length },
      proximos30Dias: { valor: valorProximos30Dias, count: proximos30Dias.length },
      totalPagoAno,
    };
  }, [contasPagar]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
      <MetricCard
        size="compact"
        title="Vencendo Hoje"
        value={formatCurrency(metrics.vencendoHoje.valor)}
        icon={Clock}
        iconColor="text-warning"
        subtitle={`${metrics.vencendoHoje.count} conta(s)`}
      />
      <MetricCard
        size="compact"
        title="Vencidas"
        value={formatCurrency(metrics.vencidas.valor)}
        icon={AlertCircle}
        iconColor="text-destructive"
        subtitle={`${metrics.vencidas.count} conta(s)`}
      />
      <MetricCard
        size="compact"
        title="Pagas no Mês"
        value={formatCurrency(metrics.pagasNoMes.valor)}
        icon={CheckCircle}
        iconColor="text-success"
        subtitle={`${metrics.pagasNoMes.count} conta(s)`}
      />
      <MetricCard
        size="compact"
        title="Próximos 7 Dias"
        value={formatCurrency(metrics.proximos7Dias.valor)}
        icon={Calendar}
        iconColor="text-primary"
        subtitle={`${metrics.proximos7Dias.count} conta(s)`}
      />
      <MetricCard
        size="compact"
        title="Próximos 30 Dias"
        value={formatCurrency(metrics.proximos30Dias.valor)}
        icon={TrendingUp}
        iconColor="text-secondary"
        subtitle={`${metrics.proximos30Dias.count} conta(s)`}
      />
      <MetricCard
        size="compact"
        title="Total Pago (Ano)"
        value={formatCurrency(metrics.totalPagoAno)}
        icon={Wallet}
        iconColor="text-muted-foreground"
        subtitle="Ano atual"
      />
    </div>
  );
};

export default PayablesMetricCards;
