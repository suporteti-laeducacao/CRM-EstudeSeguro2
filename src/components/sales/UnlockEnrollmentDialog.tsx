import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Installment } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseLocalDate } from '@/lib/date';
import { logInstallmentChange } from '@/lib/installment-audit';

interface UnlockEnrollmentDialogProps {
  saleId: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface EditableInstallment {
  id: string;
  installmentNumber: number;
  totalInstallments: number;
  originalValue: number;
  newValue: string;
  originalDueDate: string;
  newDueDate: string;
}

export const UnlockEnrollmentDialog = ({
  saleId, studentName, open, onOpenChange, onSuccess
}: UnlockEnrollmentDialogProps) => {
  const [installments, setInstallments] = useState<EditableInstallment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && saleId) {
      loadLockedInstallments();
    }
  }, [open, saleId]);

  const loadLockedInstallments = async () => {
    const { data, error } = await supabase
      .from('installments')
      .select('*')
      .eq('sale_id', saleId)
      .eq('status', 'locked')
      .order('installment_number');

    if (error) {
      toast.error('Erro ao carregar parcelas trancadas');
      return;
    }

    setInstallments((data || []).map(inst => ({
      id: inst.id,
      installmentNumber: inst.installment_number,
      totalInstallments: inst.total_installments,
      originalValue: inst.value,
      newValue: String(inst.value),
      originalDueDate: inst.due_date,
      newDueDate: inst.due_date,
    })));
  };

  const handleSave = async () => {
    // Validate
    for (const inst of installments) {
      const val = parseFloat(inst.newValue);
      if (isNaN(val) || val <= 0) {
        toast.error(`Valor inválido na parcela ${inst.installmentNumber}`);
        return;
      }
      if (!inst.newDueDate) {
        toast.error(`Data inválida na parcela ${inst.installmentNumber}`);
        return;
      }
    }

    setLoading(true);
    try {
      for (const inst of installments) {
        const { error } = await supabase
          .from('installments')
          .update({
            status: 'pending',
            value: parseFloat(inst.newValue),
            due_date: inst.newDueDate,
            notes: `Destrancamento: valor anterior R$${inst.originalValue.toFixed(2)}, vencimento anterior ${parseLocalDate(inst.originalDueDate).toLocaleDateString('pt-BR')}. ${inst.originalValue !== parseFloat(inst.newValue) || inst.originalDueDate !== inst.newDueDate ? 'Renegociado no destrancamento.' : ''}`,
          })
          .eq('id', inst.id);

        if (error) throw error;
      }

      await logInstallmentChange(
        installments.map(inst => ({
          installment_id: inst.id,
          campo: 'status',
          valor_anterior: 'locked',
          valor_novo: 'pending',
          descricao: inst.originalValue !== parseFloat(inst.newValue) || inst.originalDueDate !== inst.newDueDate
            ? `Matrícula destrancada com renegociação. Valor: R$${parseFloat(inst.newValue).toFixed(2)}, Vencimento: ${parseLocalDate(inst.newDueDate).toLocaleDateString('pt-BR')}`
            : `Matrícula destrancada`,
        }))
      );

      toast.success('Matrícula destrancada com sucesso! Parcelas retornaram para A Receber.');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error unlocking:', error);
      toast.error('Erro ao destrancar matrícula');
    } finally {
      setLoading(false);
    }
  };

  const updateInstallment = (id: string, field: 'newValue' | 'newDueDate', value: string) => {
    setInstallments(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Destrancar Matrícula — {studentName}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground mb-4">
          Ajuste os valores e datas de vencimento das parcelas trancadas antes de retorná-las para "A Receber".
        </p>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parcela</TableHead>
                <TableHead>Valor Original</TableHead>
                <TableHead>Novo Valor</TableHead>
                <TableHead>Venc. Original</TableHead>
                <TableHead>Novo Vencimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {installments.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell>{inst.installmentNumber}/{inst.totalInstallments}</TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(inst.originalValue)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={inst.newValue}
                      onChange={(e) => updateInstallment(inst.id, 'newValue', e.target.value)}
                      className="w-28"
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {parseLocalDate(inst.originalDueDate).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={inst.newDueDate}
                      onChange={(e) => updateInstallment(inst.id, 'newDueDate', e.target.value)}
                      className="w-36"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {installments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                    Nenhuma parcela trancada encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || installments.length === 0}>
            {loading ? 'Salvando...' : 'Destrancar e Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
