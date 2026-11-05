import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Plus } from 'lucide-react';
import { Installment } from '@/lib/types';
import { supabase } from '@/integrations/supabase/client';
import { storage } from '@/lib/storage';
import { toast } from 'sonner';
import { logInstallmentChange } from '@/lib/installment-audit';


interface RecalculateInstallmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  saleAmount: number;
  onSaved: () => void;
}

interface EditableInstallment extends Installment {
  _isNew?: boolean;
  _deleted?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const statusLabel = (status: string) => {
  switch (status) {
    case 'paid': return 'Pago';
    case 'overdue': return 'Vencido';
    case 'due_today': return 'Vence Hoje';
    default: return 'Pendente';
  }
};

const statusVariant = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
  switch (status) {
    case 'paid': return 'default';
    case 'overdue': return 'destructive';
    default: return 'secondary';
  }
};

const getPlanInstallmentsCount = (items: EditableInstallment[]) => {
  const activeItems = items.filter((item) => !item._deleted);
  const hasEntryInstallment = activeItems.some((item) => item.installmentNumber === 0);

  return Math.max(activeItems.length - (hasEntryInstallment ? 1 : 0), 0);
};

export const RecalculateInstallmentsDialog = ({
  open,
  onOpenChange,
  saleId,
  saleAmount,
  onSaved,
}: RecalculateInstallmentsDialogProps) => {
  const [installments, setInstallments] = useState<EditableInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmRemoveIdx, setConfirmRemoveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const all = await storage.getInstallments();
      const saleInst = all
        .filter((i) => i.saleId === saleId)
        .sort((a, b) => a.installmentNumber - b.installmentNumber);
      setInstallments(saleInst.map((i) => ({ ...i })));
      setLoading(false);
    };
    load();
  }, [open, saleId]);

  const visibleInstallments = installments.filter((i) => !i._deleted);
  const planInstallmentsCount = getPlanInstallmentsCount(installments);

  // Original pending sum (before any edits in this session)
  const originalPendingSum = visibleInstallments.reduce((s, i) => {
    if (i.status === 'paid') return s;
    return s + ((i.fullValue ?? i.value) - (i.paidAmount ?? 0));
  }, 0);

  // Current edited pending sum
  const editedPendingSum = visibleInstallments.reduce((s, i) => {
    if (i.status === 'paid') return s;
    return s + i.value;
  }, 0);

  // Paid total (already received)
  const paidTotal = visibleInstallments.reduce((s, i) => s + (i.paidAmount ?? 0), 0);

  // Projected new sale total if saved
  const projectedSaleTotal = paidTotal + editedPendingSum;

  const handleValueChange = (idx: number, val: string) => {
    const updated = [...installments];
    const realIdx = installments.indexOf(visibleInstallments[idx]);
    updated[realIdx] = { ...updated[realIdx], value: parseFloat(val) || 0 };
    setInstallments(updated);
  };

  const handleDueDateChange = (idx: number, val: string) => {
    const updated = [...installments];
    const realIdx = installments.indexOf(visibleInstallments[idx]);
    updated[realIdx] = { ...updated[realIdx], dueDate: val };
    setInstallments(updated);
  };

  const handleRemove = (idx: number) => {
    const inst = visibleInstallments[idx];
    if (inst.status === 'paid') {
      toast.error('Não é possível remover parcelas pagas.');
      return;
    }
    setConfirmRemoveIdx(idx);
  };

  const confirmRemove = () => {
    if (confirmRemoveIdx === null) return;
    const inst = visibleInstallments[confirmRemoveIdx];
    const updated = [...installments];
    const realIdx = installments.indexOf(inst);
    if (inst._isNew) {
      updated.splice(realIdx, 1);
    } else {
      updated[realIdx] = { ...updated[realIdx], _deleted: true };
    }
    setInstallments(updated);
    setConfirmRemoveIdx(null);
  };

  const handleAddInstallment = () => {
    const maxNum = visibleInstallments.reduce((m, i) => Math.max(m, i.installmentNumber), 0);
    const lastInst = visibleInstallments[visibleInstallments.length - 1];
    const newInst: EditableInstallment = {
      id: crypto.randomUUID(),
      saleId,
      studentName: lastInst?.studentName || '',
      course: lastInst?.course || '',
      installmentNumber: maxNum + 1,
      totalInstallments: planInstallmentsCount + 1,
      value: 0,
      dueDate: '',
      status: 'pending',
      isRepasse: lastInst?.isRepasse || false,
      _isNew: true,
    };
    setInstallments([...installments, newInst]);
  };

  const handleSave = async () => {
    // Validate all visible non-paid installments have a due date
    const missingDate = visibleInstallments.find((i) => i.status !== 'paid' && !i.dueDate);
    if (missingDate) {
      toast.error(`Preencha a data de vencimento da parcela ${missingDate.installmentNumber === 0 ? 'Entrada' : missingDate.installmentNumber}.`);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const changeLogs: { field_name: string; old_value: string | null; new_value: string | null }[] = [];
      const instLogs: {
        installment_id: string;
        campo: string;
        valor_anterior: string | null;
        valor_novo: string | null;
        descricao: string;
      }[] = [];

      const originalAll = await storage.getInstallments();
      const originalMap = new Map(originalAll.filter((i) => i.saleId === saleId).map((i) => [i.id, i]));

      // Process deletions
      for (const inst of installments.filter((i) => i._deleted)) {
        await storage.deleteInstallment(inst.id);
        const orig = originalMap.get(inst.id);
        changeLogs.push({
          field_name: 'installment_removed',
          old_value: `Parcela ${orig?.installmentNumber}/${orig?.totalInstallments} - ${formatCurrency(orig?.value || 0)}`,
          new_value: null,
        });
      }

      // Process updates and new
      const toSave: Installment[] = [];
      const visible = installments.filter((i) => !i._deleted);

      for (let idx = 0; idx < visible.length; idx++) {
        const inst = visible[idx];
        const orig = originalMap.get(inst.id);

        // Update numbering and fullValue for partial payment installments
        const newFullValue = inst.status === 'paid' 
          ? (inst.fullValue ?? inst.paidAmount ?? inst.value)
          : (inst.paidAmount ?? 0) + inst.value;
        const updated: Installment = {
          ...inst,
          totalInstallments: planInstallmentsCount,
          fullValue: newFullValue,
        };
        delete (updated as any)._isNew;
        delete (updated as any)._deleted;

        if (inst._isNew) {
          changeLogs.push({
            field_name: 'installment_added',
            old_value: null,
            new_value: `Parcela ${inst.installmentNumber} - ${formatCurrency(inst.value)} venc. ${inst.dueDate}`,
          });
        } else if (orig) {
          if (orig.value !== inst.value) {
            changeLogs.push({
              field_name: 'installment_value',
              old_value: `Parcela ${orig.installmentNumber}: ${formatCurrency(orig.value)}`,
              new_value: `Parcela ${inst.installmentNumber}: ${formatCurrency(inst.value)}`,
            });
            instLogs.push({
              installment_id: inst.id,
              campo: 'value',
              valor_anterior: formatCurrency(orig.value),
              valor_novo: formatCurrency(inst.value),
              descricao: `Alterou o valor da parcela de ${formatCurrency(orig.value)} para ${formatCurrency(inst.value)} (via Recalcular Parcelas)`,
            });
          }
          if (orig.dueDate !== inst.dueDate) {
            changeLogs.push({
              field_name: 'installment_due_date',
              old_value: `Parcela ${orig.installmentNumber}: ${orig.dueDate}`,
              new_value: `Parcela ${inst.installmentNumber}: ${inst.dueDate}`,
            });
            instLogs.push({
              installment_id: inst.id,
              campo: 'due_date',
              valor_anterior: orig.dueDate,
              valor_novo: inst.dueDate,
              descricao: `Alterou a data de vencimento de ${orig.dueDate} para ${inst.dueDate} (via Recalcular Parcelas)`,
            });
          }
        }
        toSave.push(updated);
      }

      if (toSave.length > 0) {
        await storage.saveInstallments(toSave);
      }

      if (instLogs.length > 0) {
        await logInstallmentChange(instLogs, { mirrorToSale: false });
      }


      // Update sale amount if edited pending exceeds original pending
      const paidTotal = visible.reduce((s, i) => i.status === 'paid' ? s + (i.fullValue ?? i.paidAmount ?? i.value) : s, 0);
      const newPending = visible.reduce((s, i) => i.status === 'paid' ? s : s + i.value, 0);
      const origPending = visible.reduce((s, i) => i.status === 'paid' ? s : s + ((i.fullValue ?? i.value) - (i.paidAmount ?? 0)), 0);
      const newTotal = paidTotal + newPending + visible.reduce((s, i) => i.status === 'paid' ? s : s + (i.paidAmount ?? 0), 0);
      if (Math.abs(newTotal - saleAmount) > 0.01) {
        changeLogs.push({
          field_name: 'total_sale_value',
          old_value: formatCurrency(saleAmount),
          new_value: formatCurrency(newTotal),
        });
        // Also update course_values to keep product values in sync
        const { data: saleData } = await supabase.from('sales').select('course_values, course').eq('id', saleId).single();
        const updateData: any = { amount: newTotal };
        if (saleData?.course_values && saleData.course_values.length > 0) {
          const courseNames = (saleData.course || '').split(' | ').filter(Boolean);
          if (courseNames.length === 1) {
            updateData.course_values = [newTotal];
          } else if (courseNames.length > 1) {
            // Distribute proportionally
            const oldSum = (saleData.course_values as number[]).reduce((a, b) => a + b, 0);
            if (oldSum > 0) {
              updateData.course_values = (saleData.course_values as number[]).map(v => Number(((v / oldSum) * newTotal).toFixed(2)));
            }
          }
        }
        await supabase.from('sales').update(updateData).eq('id', saleId);
      }

      // Save change logs
      if (changeLogs.length > 0) {
        await supabase.from('sale_change_logs').insert(
          changeLogs.map((log) => ({
            sale_id: saleId,
            user_id: user.id,
            field_name: log.field_name,
            old_value: log.old_value,
            new_value: log.new_value,
          }))
        );
      }

      toast.success('Parcelas atualizadas com sucesso!');
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar parcelas:', error);
      toast.error('Erro ao salvar parcelas.');
    } finally {
      setSaving(false);
    }
  };

  const hasDivergence = editedPendingSum > originalPendingSum + 0.01;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Recalcular Parcelamento</DialogTitle>
          </DialogHeader>

          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Carregando parcelas...</p>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor (R$)</TableHead>
                      <TableHead>Valor Pendente (R$)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleInstallments.map((inst, idx) => (
                      <TableRow key={inst.id}>
                        <TableCell className="font-medium">
                          {inst.installmentNumber === 0
                            ? 'Entrada'
                            : `${inst.installmentNumber}/${planInstallmentsCount}`}
                        </TableCell>
                        <TableCell>
                          {inst.status === 'paid' ? (
                            inst.dueDate
                          ) : (
                            <Input
                              type="date"
                              value={inst.dueDate}
                              onChange={(e) => handleDueDateChange(idx, e.target.value)}
                              className="w-40 h-8"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatCurrency(
                            inst.status === 'paid'
                              ? (inst.fullValue ?? inst.paidAmount ?? inst.value)
                              : (inst.paidAmount ?? 0) + inst.value
                          )}
                        </TableCell>
                        <TableCell>
                          {inst.status === 'paid' ? (
                            formatCurrency(0)
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              value={inst.value || ''}
                              onChange={(e) => handleValueChange(idx, e.target.value)}
                              className="w-28 h-8"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(inst.status)}>{statusLabel(inst.status)}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button aria-label="Remover parcela"
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleRemove(idx)}
                            disabled={inst.status === 'paid'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button variant="outline" size="sm" className="gap-2 mt-2" onClick={handleAddInstallment}>
                <Plus className="w-4 h-4" /> Adicionar Parcela
              </Button>

              <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-1 text-sm">
                <p>Valor Total da Venda: <strong>{formatCurrency(saleAmount)}</strong></p>
                <p>Valor Pendente: <strong>{formatCurrency(originalPendingSum)}</strong></p>
                <p className={hasDivergence ? 'text-destructive font-semibold' : ''}>
                  Soma Pendente (editada): <strong>{formatCurrency(editedPendingSum)}</strong>
                  {hasDivergence && ' ⚠️ Excede o valor pendente — o total da venda será atualizado'}
                </p>
                {Math.abs(projectedSaleTotal - saleAmount) > 0.01 && (
                  <p className="font-semibold text-foreground border-t pt-1 mt-1">
                    Novo valor da venda após salvar: <strong>{formatCurrency(projectedSaleTotal)}</strong>
                  </p>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemoveIdx !== null} onOpenChange={() => setConfirmRemoveIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover parcela?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemoveIdx !== null && (
                <>
                  Tem certeza que deseja remover a parcela{' '}
                  {visibleInstallments[confirmRemoveIdx]?.installmentNumber}/
                   {planInstallmentsCount}?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
