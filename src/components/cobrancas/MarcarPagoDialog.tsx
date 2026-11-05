import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import ConfirmPaymentDialog from '@/components/financial/ConfirmPaymentDialog';
import type { Installment } from '@/lib/types';
import type { CobrancaItem } from '@/hooks/useCobrancas';
import { fmtData, fmtMoeda } from './CobrancaCard';

/**
 * Baixa pela Gestão de Cobranças: usa exatamente a mesma janela/lógica do Financeiro
 * (ConfirmPaymentDialog). A cobrança é recalculada no banco pela trigger das parcelas.
 */
export const MarcarPagoDialog = ({ alvo, titulo, onClose, onPaid }: {
  alvo: CobrancaItem | null; titulo?: string; onClose: () => void; onPaid: (installmentId: string) => void | Promise<void>;
}) => {
  const [parcelas, setParcelas] = useState<Installment[] | null>(null);
  const [sel, setSel] = useState('');
  const [pagar, setPagar] = useState<Installment | null>(null);

  useEffect(() => {
    if (!alvo) return;
    setParcelas(null); setSel(''); setPagar(null);
    (async () => {
      const [{ data, error }, { data: sale }] = await Promise.all([
        supabase.from('installments').select('*').eq('sale_id', alvo.saleId).in('status', ['pending', 'due_today', 'overdue']).order('due_date').order('installment_number'),
        supabase.from('sales').select('observation, payment_mode, tipo_boleto, vendedor_id').eq('id', alvo.saleId).maybeSingle(),
      ]);
      if (error) { toast.error('Erro ao carregar parcelas'); setParcelas([]); return; }
      const lista: Installment[] = (data || []).map((r: any) => ({
        id: r.id, saleId: r.sale_id, vendedorId: sale?.vendedor_id || undefined, studentName: r.student_name, course: r.course,
        installmentNumber: r.installment_number, totalInstallments: r.total_installments, value: Number(r.value), dueDate: r.due_date,
        status: r.status, paidDate: r.paid_date || undefined, paidAmount: r.paid_amount != null ? Number(r.paid_amount) : undefined,
        paidMethod: r.paid_method || undefined, receipt: r.receipt || undefined, notes: r.notes || undefined,
        fullValue: r.full_value != null ? Number(r.full_value) : undefined, companyValue: r.company_value != null ? Number(r.company_value) : undefined,
        isRepasse: r.is_repasse || false, saleObservation: sale?.observation || undefined, salePaymentMode: sale?.payment_mode,
        saleTipoBoleto: (sale?.tipo_boleto as any) || undefined,
      }));
      setParcelas(lista);
      if (lista.length === 1) setSel(lista[0].id);
    })();
  }, [alvo]);

  const confirmado = async () => {
    const inst = pagar; setPagar(null);
    if (!inst) return;
    const { data } = await supabase.from('installments').select('status').eq('id', inst.id).maybeSingle();
    if (data?.status !== 'paid') { toast.info('Pagamento parcial registrado — a parcela continua em aberto.'); onClose(); await onPaid(''); return; }
    await onPaid(inst.id);
    onClose();
  };

  return (
    <>
      <Dialog open={!!alvo && !pagar} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{titulo || 'Marcar como Pago'} — {alvo?.alunoNome}</DialogTitle></DialogHeader>
          <p className="text-[13px] text-ink-500">Selecione a parcela paga. A baixa é feita no Financeiro, pela mesma janela de lá.</p>
          {parcelas === null ? <p className="text-muted-foreground">Carregando...</p> : parcelas.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center">Nenhuma parcela em aberto.</p>
          ) : (
            <RadioGroup value={sel} onValueChange={setSel} className="grid gap-2">
              {parcelas.map((p) => (
                <label key={p.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-ink-200 p-3 text-[13.5px] cursor-pointer">
                  <span className="flex items-center gap-2"><RadioGroupItem value={p.id} /> Parcela {p.installmentNumber}</span>
                  <span className="text-ink-600">{fmtData(p.dueDate)}</span>
                  <span className="font-medium tabular-nums">{fmtMoeda(p.value)}</span>
                </label>
              ))}
            </RadioGroup>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={!sel} onClick={() => setPagar(parcelas?.find((p) => p.id === sel) || null)}>Continuar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {pagar && (
        <ConfirmPaymentDialog installment={pagar} open={!!pagar} onOpenChange={(o) => { if (!o) setPagar(null); }} onConfirm={confirmado} />
      )}
    </>
  );
};
