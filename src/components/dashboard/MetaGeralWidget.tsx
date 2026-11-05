import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';
import { getMetaGeralAtiva, MetaGeral } from '@/lib/metas-storage';
import { storage } from '@/lib/storage';
import { supabase } from '@/integrations/supabase/client';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const MetaGeralWidget = () => {
  const [metaGeral, setMetaGeral] = useState<MetaGeral | null>(null);
  const [totalRealizado, setTotalRealizado] = useState(0);

  useEffect(() => {
    const load = async () => {
      const meta = await getMetaGeralAtiva();
      setMetaGeral(meta);
      if (!meta) return;

      const [sales, installments, logsResult] = await Promise.all([
        storage.getSales(),
        storage.getInstallments(),
        supabase.from('installment_payments').select('installment_id, valor, data_pagamento'),
      ]);
      const paymentLogs = (logsResult.data || []) as { installment_id: string; valor: number; data_pagamento: string }[];

      const startDate = meta.data_inicio;
      const endDate = meta.data_fim;
      let realizado = 0;

      sales.forEach(sale => {
        const isBoleto = sale.paymentMode?.toLowerCase().includes('boleto');

        const saleInstallments = installments.filter(
          inst => inst.saleId === sale.id
            && inst.status !== 'refunded'
            && (!isBoleto || inst.installmentNumber === 0)
            && (inst.status === 'paid' || (inst.paidAmount || 0) > 0)
        );

        saleInstallments.forEach(inst => {
          const instLogs = paymentLogs.filter(log => log.installment_id === inst.id);

          if (instLogs.length > 0) {
            const logsInPeriod = instLogs.filter(
              log => log.data_pagamento >= startDate && log.data_pagamento <= endDate
            );
            realizado += logsInPeriod.reduce((sum, log) => sum + Number(log.valor), 0);
          } else if (inst.status === 'paid' && inst.paidDate) {
            if (inst.paidDate >= startDate && inst.paidDate <= endDate) {
              const amount = inst.paidAmount ?? inst.fullValue ?? inst.value;
              if (sale.tipoBoleto === 'repasse' && inst.isRepasse) {
                realizado += inst.companyValue || amount;
              } else {
                realizado += amount;
              }
            }
          }
        });
      });

      setTotalRealizado(realizado);
    };
    load();
  }, []);

  if (!metaGeral) return null;

  const percent = Math.min((totalRealizado / metaGeral.valor) * 100, 100);

  return (
    <Card className="rounded-[14px] border-ink-200 shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-medium text-ink-500 flex items-center gap-2">
          <Target className="h-4 w-4 text-ink-950" />
          Meta Geral do Período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="font-display text-[28px] leading-8 font-extrabold text-ink-950 tabular-nums">{formatCurrency(totalRealizado)}</span>
          <span className="text-[12.5px] text-ink-500 tabular-nums">/ {formatCurrency(metaGeral.valor)}</span>
        </div>
        <Progress
          value={percent}
          className={`h-2.5 bg-ink-100 ${percent >= 100 ? '[&>div]:bg-brand' : '[&>div]:bg-ink-950'}`}
        />
        <p className="text-[12px] text-ink-500 text-right tabular-nums">{percent.toFixed(1)}% atingido</p>
      </CardContent>
    </Card>
  );
};

export default MetaGeralWidget;
