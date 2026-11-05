import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Installment } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logInstallmentChange } from '@/lib/installment-audit';

interface EditDueDateDialogProps {
  installment: Installment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const EditDueDateDialog = ({ installment, open, onOpenChange, onConfirm }: EditDueDateDialogProps) => {
  const [newDueDate, setNewDueDate] = useState(installment.dueDate);
  const [loading, setLoading] = useState(false);
  const [sellerName, setSellerName] = useState<string>('');

  useEffect(() => {
    if (open && installment.saleId) {
      supabase
        .from('sales')
        .select('seller')
        .eq('id', installment.saleId)
        .single()
        .then(({ data }) => {
          setSellerName(data?.seller || '');
        });
    }
  }, [open, installment.saleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newDueDate) {
      toast.error('Por favor, selecione uma data');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('installments')
        .update({ due_date: newDueDate })
        .eq('id', installment.id);

      if (error) throw error;

      await logInstallmentChange({
        installment_id: installment.id,
        campo: 'due_date',
        valor_anterior: installment.dueDate,
        valor_novo: newDueDate,
        descricao: `Alterou a data de vencimento de ${new Date(installment.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')} para ${new Date(newDueDate + 'T12:00:00').toLocaleDateString('pt-BR')}`,
      });

      toast.success('Data de vencimento atualizada com sucesso');
      onConfirm();
    } catch (error) {
      console.error('Error updating due date:', error);
      toast.error('Erro ao atualizar data de vencimento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Data de Vencimento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Aluno:</strong> {installment.studentName}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Parcela:</strong> {installment.installmentNumber}/{installment.totalInstallments}
            </p>
            {sellerName && (
              <p className="text-sm text-muted-foreground">
                <strong>Vendedor:</strong> {sellerName}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="dueDate">Nova Data de Vencimento</Label>
            <Input
              id="dueDate"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditDueDateDialog;
