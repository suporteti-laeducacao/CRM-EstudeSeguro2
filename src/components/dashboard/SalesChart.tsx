import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';

export const SalesLineChart = () => {
  const [salesData, setSalesData] = useState<{ month: string; recebido: number; aReceber: number }[]>([]);

  useEffect(() => {
    const loadSalesData = async () => {
      const currentYear = new Date().getFullYear();
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

      const recebidoByMonth: number[] = Array(12).fill(0);
      const aReceberByMonth: number[] = Array(12).fill(0);

      // Recursive pagination to bypass 1000-row limit
      const fetchAllPayments = async () => {
        const PAGE = 1000;
        let all: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('installment_payments')
            .select('installment_id, valor, data_pagamento')
            .range(from, from + PAGE - 1);
          if (error) throw error;
          if (data) all = all.concat(data);
          if (!data || data.length < PAGE) break;
          from += PAGE;
        }
        return all;
      };

      const [installments, paymentLogs] = await Promise.all([
        storage.getInstallments(),
        fetchAllPayments(),
      ]);

      // Track which installments have ledger entries (to avoid double-counting)
      const installmentsWithLedger = new Set<string>();

      // RECEBIDO: ledger-first
      paymentLogs.forEach((log: any) => {
        if (!log.data_pagamento) return;
        installmentsWithLedger.add(log.installment_id);
        const [y, m] = String(log.data_pagamento).split('-');
        if (parseInt(y) === currentYear) {
          recebidoByMonth[parseInt(m) - 1] += Number(log.valor) || 0;
        }
      });

      // FALLBACK + A RECEBER
      installments.forEach((inst: any) => {
        // Exclude refunded and locked from all calculations
        if (inst.status === 'refunded' || inst.status === 'locked') return;

        // Fallback: paid installments without any ledger entry
        if (inst.status === 'paid' && inst.paidDate && !installmentsWithLedger.has(inst.id)) {
          const [y, m] = inst.paidDate.split('-');
          if (parseInt(y) === currentYear) {
            const amount = inst.paidAmount ?? inst.fullValue ?? inst.value ?? 0;
            recebidoByMonth[parseInt(m) - 1] += Number(amount);
          }
        }

        // A Receber: pending/due_today/overdue grouped by due date
        if (inst.status !== 'paid' && inst.dueDate) {
          const [y, m] = inst.dueDate.split('-');
          if (parseInt(y) === currentYear) {
            aReceberByMonth[parseInt(m) - 1] += Number(inst.value) || 0;
          }
        }
      });

      const chartData = monthNames.map((month, idx) => ({
        month,
        recebido: recebidoByMonth[idx],
        aReceber: aReceberByMonth[idx],
      }));

      setSalesData(chartData);
    };

    loadSalesData();
  }, []);

  const fmtCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Card className="rounded-[14px] border-ink-200 shadow-card">
      <CardHeader>
        <CardTitle>Evolução de Vendas</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={salesData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F4" />
            <XAxis dataKey="month" stroke="#9A9AA3" tick={{ fontSize: 12, fill: "#9A9AA3" }} />
            <YAxis stroke="#9A9AA3" tick={{ fontSize: 12, fill: "#9A9AA3" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--ink-200, 0 0% 90%))',
                borderRadius: '12px',
                boxShadow: '0 12px 32px -12px rgba(16,16,20,0.28)',
              }}
              formatter={(value: number, name: string) => [fmtCurrency(value), name]}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="recebido"
              name="Valor Recebido"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            />
            <Line
              isAnimationActive={false}
              type="monotone"
              dataKey="aReceber"
              name="Valor a Receber"
              stroke="hsl(var(--warning, 38 92% 50%))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: 'hsl(var(--warning, 38 92% 50%))', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export const CourseBarChart = () => {
  const [courseData, setCourseData] = useState<{ curso: string; vendas: number }[]>([]);

  useEffect(() => {
    const loadCourseData = async () => {
      const sales = await storage.getSales();
      
      // Group sales by course
      const courseSales: { [key: string]: number } = {};
      
      sales.forEach(sale => {
        if (!courseSales[sale.course]) {
          courseSales[sale.course] = 0;
        }
        courseSales[sale.course] += sale.quantity;
      });
      
      const chartData = Object.entries(courseSales)
        .map(([curso, vendas]) => ({ curso, vendas }))
        .sort((a, b) => b.vendas - a.vendas)
        .slice(0, 6); // Top 6 courses
      
      setCourseData(chartData);
    };
    
    loadCourseData();
  }, []);

  return (
    <Card className="rounded-[14px] border-ink-200 shadow-card">
      <CardHeader>
        <CardTitle>Vendas por Curso</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={courseData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F1F4" />
            <XAxis dataKey="curso" stroke="#9A9AA3" tick={{ fontSize: 12, fill: "#9A9AA3" }} />
            <YAxis stroke="#9A9AA3" tick={{ fontSize: 12, fill: "#9A9AA3" }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--ink-200, 0 0% 90%))',
                borderRadius: '12px',
                boxShadow: '0 12px 32px -12px rgba(16,16,20,0.28)',
              }}
            />
            <Bar isAnimationActive={false} dataKey="vendas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export const PaymentPieChart = () => {
  const [paymentData, setPaymentData] = useState<{ name: string; value: number; color: string }[]>([]);

  useEffect(() => {
    const loadPaymentData = async () => {
      const sales = await storage.getSales();
      
      if (sales.length === 0) {
        setPaymentData([]);
        return;
      }
      
      // Group sales by payment mode
      const paymentSales: { [key: string]: number } = {};
      
      sales.forEach(sale => {
        if (!paymentSales[sale.paymentMode]) {
          paymentSales[sale.paymentMode] = 0;
        }
        paymentSales[sale.paymentMode] += 1;
      });
      
      const total = Object.values(paymentSales).reduce((sum, count) => sum + count, 0);
      
      const colors = [
        'hsl(var(--chart-1))',
        'hsl(var(--chart-2))',
        'hsl(var(--chart-3))',
        'hsl(var(--chart-4))',
        'hsl(var(--chart-5))',
      ];
      
      const chartData = Object.entries(paymentSales)
        .map(([name, count], index) => ({
          name,
          value: Math.round((count / total) * 100),
          color: colors[index % colors.length],
        }))
        .sort((a, b) => b.value - a.value);
      
      setPaymentData(chartData);
    };
    
    loadPaymentData();
  }, []);

  return (
    <Card className="rounded-[14px] border-ink-200 shadow-card">
      <CardHeader>
        <CardTitle>Distribuição por Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={paymentData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}%`}
              outerRadius={100}
              fill="hsl(var(--card))"
              dataKey="value"
            >
              {paymentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `${value}%`} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};