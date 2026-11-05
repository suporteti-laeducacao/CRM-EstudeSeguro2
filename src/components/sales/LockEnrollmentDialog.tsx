import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseLocalDate } from '@/lib/date';
import { Lock } from 'lucide-react';
import { logInstallmentChange } from '@/lib/installment-audit';

interface LockEnrollmentDialogProps {
  saleId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface PendingInstallment {
  id: string;
  installment_number: number;
  total_installments: number;
  value: number;
  due_date: string;
  status: string;
}

export const LockEnrollmentDialog = ({
  saleId, studentName, open, onOpenChange, onSuccess
}: LockEnrollmentDialogProps) => {
  const [installments, setInstallments] = useState<PendingInstallment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && saleId) {
      loadPendingInstallments();
    }
  }, [open, saleId]);

  const loadPendingInstallments = async () => {
    const { data, error } = await supabase
      .from('installments')
      .select('id, installment_number, total_installments, value, due_date, status')
      .eq('sale_id', saleId)
      .in('status', ['pending', 'overdue', 'due_today'])
      .order('installment_number');

    if (error) {
      toast.error('Erro ao carregar parcelas');
      return;
    }
    setInstallments(data || []);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('installments')
        .update({ status: 'locked' })
        .eq('sale_id', saleId)
        .in('status', ['pending', 'overdue', 'due_today']);

      if (error) throw error;

      await logInstallmentChange(
        installments.map(inst => ({
          installment_id: inst.id,
          campo: 'status',
          valor_anterior: inst.status,
          valor_novo: 'locked',
          descricao: `Matrícula trancada`,
        }))
      );

      toast.success('Matrícula trancada com sucesso');
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao trancar matrícula');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'A Receber';
      case 'overdue': return 'Atrasada';
      case 'due_today': return 'Vence Hoje';
      default: return status;
    }
  };

  const total = installments.reduce((sum, i) => sum + i.value, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-ink-700" />
            Trancar Matrícula — {studentName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          As seguintes parcelas serão trancadas e movidas para a aba "Trancados" no financeiro:
        </p>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status Atual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell>{inst.installment_number}/{inst.total_installments}</TableCell>
                  <TableCell>{formatCurrency(inst.value)}</TableCell>
                  <TableCell>{parseLocalDate(inst.due_date).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      inst.status === 'overdue'
                        ? 'bg-destructive/10 text-destructive border-destructive/20'
                        : 'bg-[#FFF1E7] text-[#B44309] border-[#FFD3B0]'
                    }>
                      {getStatusLabel(inst.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {installments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    Nenhuma parcela pendente encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <p className="text-sm font-semibold">
            Total a trancar: <span className="text-ink-700">{formatCurrency(total)}</span> ({installments.length} parcela{installments.length !== 1 ? 's' : ''})
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || installments.length === 0}
            className="bg-ink-950 hover:bg-ink-800 text-white"
          >
            {loading ? 'Trancando...' : 'Confirmar Trancamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
