import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Installment, PAYMENT_MODES } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import { logInstallmentChange } from '@/lib/installment-audit';

interface ConfirmPaymentDialogProps {
  installment: Installment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const ConfirmPaymentDialog = ({
  installment,
  open,
  onOpenChange,
  onConfirm,
}: ConfirmPaymentDialogProps) => {
  const [formData, setFormData] = useState({
    paidDate: new Date().toISOString().split('T')[0],
    paidMethod: '',
    paidAmount: installment.value.toString(),
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [partialAction, setPartialAction] = useState<'pending' | 'discount'>('pending');
  const [showPartialChoice, setShowPartialChoice] = useState(false);

  const originalFullValue = installment.fullValue || installment.value;
  const alreadyPaid = installment.paidAmount || 0;
  const remainingValue = installment.value;

  const typedAmount = parseFloat((formData.paidAmount || '0').replace(',', '.'));
  const jurosAmount = !isNaN(typedAmount) ? Math.max(0, Number((typedAmount - remainingValue).toFixed(2))) : 0;
  const paymentAmount = !isNaN(typedAmount) ? Math.min(typedAmount, remainingValue) : typedAmount;
  const isPartialPayment = !isNaN(paymentAmount) && paymentAmount > 0 && paymentAmount < remainingValue - 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.paidMethod || !formData.paidAmount) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Valor pago deve ser maior que zero');
      return;
    }

    setLoading(true);

    try {
      const newTotalPaid = alreadyPaid + paymentAmount;
      const newRemainingValue = originalFullValue - newTotalPaid;
      const isFullyPaid = newRemainingValue <= 0.01;

      if (jurosAmount > 0) {
        const { data: { user: u } } = await supabase.auth.getUser();
        if (u) {
          let diasAtraso: number | null = null;
          if (installment.dueDate) {
            const [vy, vm, vd] = String(installment.dueDate).slice(0, 10).split('-').map(Number);
            const [py, pm, pd] = formData.paidDate.split('-').map(Number);
            const diff = Math.round((new Date(py, pm - 1, pd).getTime() - new Date(vy, vm - 1, vd).getTime()) / 86400000);
            diasAtraso = diff > 0 ? diff : 0;
          }
          const { error: jErr } = await supabase.from('installment_juros').insert({
            user_id: u.id,
            installment_id: installment.id,
            sale_id: installment.saleId || null,
            student_name: installment.studentName,
            valor_parcela: remainingValue,
            valor_recebido: typedAmount,
            valor_juros: jurosAmount,
            data_vencimento: installment.dueDate ? String(installment.dueDate).slice(0, 10) : null,
            data_pagamento: formData.paidDate,
            dias_atraso: diasAtraso,
            metodo: formData.paidMethod,
            observacoes: formData.notes || null,
          });
          if (jErr) throw jErr;
          await logInstallmentChange({
            installment_id: installment.id,
            campo: 'juros',
            valor_anterior: null as any,
            valor_novo: `R$ ${jurosAmount.toFixed(2).replace('.', ',')}`,
            descricao: `Juros/multa recebidos: R$ ${jurosAmount.toFixed(2).replace('.', ',')} (total recebido R$ ${typedAmount.toFixed(2).replace('.', ',')})`,
          });
        }
      }

      // Get current user for payment log
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const userId = currentUser?.id;

      if (isFullyPaid || (isPartialPayment && partialAction === 'discount')) {
        // Full payment OR discount — mark as paid
        const discountAmount = isPartialPayment ? newRemainingValue : 0;
        const discountNote = discountAmount > 0 
          ? `Desconto concedido: R$ ${discountAmount.toFixed(2).replace('.', ',')}` 
          : '';
        
        const allNotes = [
          formData.notes,
          discountNote,
        ].filter(Boolean).join(' | ');

        const { error } = await supabase
          .from('installments')
          .update({
            status: 'paid',
            paid_date: formData.paidDate,
            paid_method: formData.paidMethod,
            paid_amount: newTotalPaid,
            full_value: originalFullValue,
            notes: allNotes || null,
            value: 0,
          })
          .eq('id', installment.id);

        if (error) throw error;

        // Log payment entry
        if (userId) {
          await supabase.from('installment_payments').insert({
            installment_id: installment.id,
            user_id: userId,
            valor: paymentAmount,
            data_pagamento: formData.paidDate,
            metodo: formData.paidMethod,
            observacoes: discountAmount > 0
              ? `Quitação com desconto de R$ ${discountAmount.toFixed(2).replace('.', ',')}`
              : formData.notes || null,
          });
        }

        await logInstallmentChange({
          installment_id: installment.id,
          campo: 'status',
          valor_anterior: installment.status,
          valor_novo: 'paid',
          descricao: discountAmount > 0
            ? `Pagamento com desconto: R$ ${paymentAmount.toFixed(2).replace('.', ',')} via ${formData.paidMethod}. Desconto: R$ ${discountAmount.toFixed(2).replace('.', ',')}`
            : `Pagamento integral: R$ ${paymentAmount.toFixed(2).replace('.', ',')} via ${formData.paidMethod}`,
        });

        if (discountAmount > 0) {
          toast.success(`Parcela quitada com desconto de R$ ${discountAmount.toFixed(2).replace('.', ',')}. Valor recebido: R$ ${paymentAmount.toFixed(2).replace('.', ',')}`);
        } else {
          toast.success('Pagamento integral confirmado com sucesso!');
        }
      } else {
        // Partial payment - keep installment open with remaining balance
        const { error } = await supabase
          .from('installments')
          .update({
            paid_amount: newTotalPaid,
            full_value: originalFullValue,
            value: newRemainingValue,
            notes: formData.notes
              ? `${installment.notes ? installment.notes + ' | ' : ''}Pagamento parcial em ${formData.paidDate}: R$ ${paymentAmount.toFixed(2).replace('.', ',')} via ${formData.paidMethod}. ${formData.notes}`
              : `${installment.notes ? installment.notes + ' | ' : ''}Pagamento parcial em ${formData.paidDate}: R$ ${paymentAmount.toFixed(2).replace('.', ',')} via ${formData.paidMethod}`,
          })
          .eq('id', installment.id);

        if (error) throw error;

        // Log payment entry
        if (userId) {
          await supabase.from('installment_payments').insert({
            installment_id: installment.id,
            user_id: userId,
            valor: paymentAmount,
            data_pagamento: formData.paidDate,
            metodo: formData.paidMethod,
            observacoes: formData.notes || null,
          });
        }

        await logInstallmentChange({
          installment_id: installment.id,
          campo: 'paid_amount',
          valor_anterior: `R$ ${alreadyPaid.toFixed(2).replace('.', ',')}`,
          valor_novo: `R$ ${newTotalPaid.toFixed(2).replace('.', ',')}`,
          descricao: `Pagamento parcial: R$ ${paymentAmount.toFixed(2).replace('.', ',')} via ${formData.paidMethod}. Restante: R$ ${newRemainingValue.toFixed(2).replace('.', ',')}`,
        });

        toast.success(`Pagamento parcial de R$ ${paymentAmount.toFixed(2).replace('.', ',')} registrado. Restam R$ ${newRemainingValue.toFixed(2).replace('.', ',')} a receber.`);
      }

      onConfirm();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Erro ao confirmar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const differenceValue = remainingValue - (isNaN(paymentAmount) ? 0 : paymentAmount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Aluno</Label>
            <p className="text-sm font-medium mt-1">{installment.studentName}</p>
            {installment.saleObservation && (
              <p className="text-xs text-muted-foreground mt-1 italic">{installment.saleObservation}</p>
            )}
          </div>
          <div>
            <Label>Parcela</Label>
            <p className="text-sm font-medium mt-1">
              {installment.installmentNumber}/{installment.totalInstallments} - {installment.course}
            </p>
          </div>

          {alreadyPaid > 0 && (
            <div className="bg-muted/50 p-3 rounded-lg space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor total:</span>
                <span className="font-medium">{formatCurrency(originalFullValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Já pago:</span>
                <span className="font-medium text-success">{formatCurrency(alreadyPaid)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-1">
                <span className="text-muted-foreground">Restante:</span>
                <span className="font-bold">{formatCurrency(remainingValue)}</span>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="paidDate">Data do Pagamento *</Label>
            <Input
              id="paidDate"
              type="date"
              value={formData.paidDate}
              onChange={(e) => setFormData({ ...formData, paidDate: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="paidMethod">Forma de Pagamento *</Label>
            <Select value={formData.paidMethod} onValueChange={(value) => setFormData({ ...formData, paidMethod: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="paidAmount">Valor Pago (R$) *</Label>
            <Input
              id="paidAmount"
              type="number"
              step="0.01"
              value={formData.paidAmount}
              onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
            />
            {jurosAmount > 0 ? (
              <p className="text-xs font-medium text-warning mt-1">
                Juros/multa: {formatCurrency(jurosAmount)} acima da parcela de {formatCurrency(remainingValue)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Valor da parcela: {formatCurrency(remainingValue)} · informe um valor maior para registrar juros
              </p>
            )}
          </div>

          {/* Partial payment choice */}
          {isPartialPayment && (
            <div className="border border-[#FFD3B0] bg-[#FFF1E7] rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-[#B44309] mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#B44309]">
                    Valor inferior à parcela
                  </p>
                  <p className="text-xs text-[#B44309]">
                    Diferença de {formatCurrency(differenceValue)}. O que deseja fazer com o saldo restante?
                  </p>
                </div>
              </div>
              <RadioGroup
                value={partialAction}
                onValueChange={(v) => setPartialAction(v as 'pending' | 'discount')}
                className="space-y-2"
              >
                <div className="flex items-start space-x-3 p-2 rounded-md hover:bg-[#FFE6D3] cursor-pointer">
                  <RadioGroupItem value="pending" id="partial-pending" className="mt-0.5" />
                  <Label htmlFor="partial-pending" className="cursor-pointer space-y-0.5">
                    <span className="text-sm font-medium">Manter saldo pendente</span>
                    <p className="text-xs text-muted-foreground">
                      A parcela continua aberta com {formatCurrency(differenceValue)} a receber
                    </p>
                  </Label>
                </div>
                <div className="flex items-start space-x-3 p-2 rounded-md hover:bg-[#FFE6D3] cursor-pointer">
                  <RadioGroupItem value="discount" id="partial-discount" className="mt-0.5" />
                  <Label htmlFor="partial-discount" className="cursor-pointer space-y-0.5">
                    <span className="text-sm font-medium">Quitar com desconto</span>
                    <p className="text-xs text-muted-foreground">
                      Parcela quitada — desconto de {formatCurrency(differenceValue)} registrado
                    </p>
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div>
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas sobre o pagamento..."
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPaymentDialog;
