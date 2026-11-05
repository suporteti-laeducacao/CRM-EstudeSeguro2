import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Installment } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { logInstallmentChange } from '@/lib/installment-audit';

interface RefundDialogProps {
  installment: Installment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefunded: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const RefundDialog = ({ installment, open, onOpenChange, onRefunded }: RefundDialogProps) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRefund = async () => {
    if (!installment) return;

    try {
      setLoading(true);

      const refundNote = `[ESTORNO - ${format(new Date(), 'dd/MM/yyyy HH:mm')}] ${reason || 'Sem motivo informado'}${installment.notes ? '\n---\n' + installment.notes : ''}`;

      const { error } = await supabase
        .from('installments')
        .update({
          status: 'refunded',
          notes: refundNote,
        })
        .eq('id', installment.id);

      if (error) throw error;

      await logInstallmentChange({
        installment_id: installment.id,
        campo: 'status',
        valor_anterior: installment.status,
        valor_novo: 'refunded',
        descricao: `Estorno realizado. ${reason || 'Sem motivo informado'}`,
      });

      toast.success('Estorno realizado com sucesso');
      setReason('');
      onOpenChange(false);
      onRefunded();
    } catch (error) {
      console.error('Erro ao estornar:', error);
      toast.error('Erro ao realizar estorno');
    } finally {
      setLoading(false);
    }
  };

  if (!installment) return null;

  const amount = installment.paidAmount ?? installment.fullValue ?? installment.value;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Estorno</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Tem certeza que deseja estornar esta parcela? O valor deixará de ser contabilizado como venda para o vendedor.
              </p>
              <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                <p><strong>Aluno:</strong> {installment.studentName}</p>
                <p><strong>Curso:</strong> {installment.course}</p>
                <p><strong>Parcela:</strong> {installment.installmentNumber}/{installment.totalInstallments}</p>
                <p><strong>Valor:</strong> <span className="text-destructive font-semibold">{formatCurrency(amount)}</span></p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refund-reason">Motivo do estorno (opcional)</Label>
                <Textarea
                  id="refund-reason"
                  placeholder="Ex: Aluno cancelou matrícula, devolução de valor..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleRefund(); }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar Estorno
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RefundDialog;
