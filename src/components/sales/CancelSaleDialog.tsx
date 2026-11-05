import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sale, Installment } from '@/lib/types';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { cancelarCertificacaoDaVenda } from '@/lib/certificacoes-storage';

interface CancelSaleDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const CancelSaleDialog = ({ sale, open, onOpenChange, onSuccess }: CancelSaleDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [paidInstallments, setPaidInstallments] = useState<Installment[]>([]);
  const [openInstallments, setOpenInstallments] = useState<Installment[]>([]);
  const [selectedRefunds, setSelectedRefunds] = useState<Set<string>>(new Set());
  const [selectedDeletions, setSelectedDeletions] = useState<Set<string>>(new Set());
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  useEffect(() => {
    if (open && sale) {
      setSelectedRefunds(new Set());
      setSelectedDeletions(new Set());
      loadInstallments();
    }
  }, [open, sale?.id]);

  const mapInstallment = (inst: any): Installment => ({
    id: inst.id,
    saleId: inst.sale_id,
    studentName: inst.student_name,
    course: inst.course,
    installmentNumber: inst.installment_number,
    totalInstallments: inst.total_installments,
    value: Number(inst.value),
    dueDate: inst.due_date,
    status: inst.status as any,
    paidDate: inst.paid_date || undefined,
    paidAmount: inst.paid_amount ? Number(inst.paid_amount) : undefined,
    paidMethod: inst.paid_method || undefined,
    notes: inst.notes || undefined,
    fullValue: inst.full_value ? Number(inst.full_value) : undefined,
    companyValue: inst.company_value ? Number(inst.company_value) : undefined,
    isRepasse: inst.is_repasse || false,
  });

  const loadInstallments = async () => {
    if (!sale) return;
    setLoadingInstallments(true);
    try {
      const { data, error } = await supabase
        .from('installments')
        .select('*')
        .eq('sale_id', sale.id)
        .order('installment_number', { ascending: true });

      if (error) throw error;

      const all = (data || []).map(mapInstallment);
      setPaidInstallments(all.filter(i => i.status === 'paid'));
      const open = all.filter(i => i.status !== 'paid' && i.status !== 'refunded');
      setOpenInstallments(open);
      // Por padrão, marcar todas as parcelas em aberto para remoção
      setSelectedDeletions(new Set(open.map(i => i.id)));
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error);
    } finally {
      setLoadingInstallments(false);
    }
  };

  const toggleIn = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const handleCancel = async () => {
    if (!sale) return;

    setIsLoading(true);
    try {
      const { error: saleError } = await supabase
        .from('sales')
        .update({ status: 'cancelada' })
        .eq('id', sale.id);

      if (saleError) throw saleError;

      try {
        await cancelarCertificacaoDaVenda(sale.id, 'Venda cancelada');
      } catch (e) {
        console.error('Erro ao cancelar certificação vinculada:', e);
      }

      // Remover apenas as parcelas em aberto selecionadas
      if (selectedDeletions.size > 0) {
        const { error: installmentsError } = await supabase
          .from('installments')
          .delete()
          .in('id', Array.from(selectedDeletions));

        if (installmentsError) throw installmentsError;
      }

      // Estornar parcelas pagas selecionadas
      if (selectedRefunds.size > 0) {
        const refundNote = `[ESTORNO - Cancelamento de venda - ${format(new Date(), 'dd/MM/yyyy HH:mm')}]`;

        for (const instId of selectedRefunds) {
          const inst = paidInstallments.find(i => i.id === instId);
          const existingNotes = inst?.notes || '';
          const fullNote = existingNotes ? `${refundNote}\n---\n${existingNotes}` : refundNote;

          const { error } = await supabase
            .from('installments')
            .update({ status: 'refunded', notes: fullNote })
            .eq('id', instId);

          if (error) throw error;
        }
      }

      const kept = openInstallments.length - selectedDeletions.size;
      const parts = [
        selectedDeletions.size > 0 ? `${selectedDeletions.size} parcela(s) removida(s).` : '',
        kept > 0 ? `${kept} parcela(s) mantida(s) em cobrança.` : '',
        selectedRefunds.size > 0 ? `${selectedRefunds.size} parcela(s) estornada(s).` : '',
      ].filter(Boolean).join(' ');

      toast.success(`Venda cancelada com sucesso! ${parts}`.trim());
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao cancelar venda:', error);
      toast.error('Erro ao cancelar venda. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const getInstallmentAmount = (inst: Installment) =>
    inst.paidAmount ?? inst.fullValue ?? inst.value;

  const statusLabel: Record<string, string> = {
    pending: 'Pendente',
    due_today: 'Vence hoje',
    overdue: 'Atrasada',
    locked: 'Trancada',
  };

  const label = (inst: Installment) =>
    inst.installmentNumber === 0 ? 'Entrada' : `${inst.installmentNumber}/${inst.totalInstallments}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar Venda</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Você está prestes a cancelar a venda de <strong>{sale?.studentName}</strong> - {sale?.course}.
              </p>
              <div className="bg-[#FFF1E7] border border-[#FFD3B0] rounded-md p-3 text-[#B44309] text-sm">
                <p className="font-semibold mb-2">⚠️ Atenção:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Somente as parcelas <strong>marcadas</strong> serão removidas</li>
                  <li>As parcelas <strong>desmarcadas</strong> continuam em aberto para cobrança</li>
                  <li><strong>Esta ação é irreversível</strong></li>
                </ul>
              </div>

              {loadingInstallments ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {openInstallments.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Parcelas em aberto — marque as que deseja remover:
                      </p>
                      <div className="border rounded-md divide-y">
                        <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm font-medium">
                          <Checkbox
                            checked={selectedDeletions.size === openInstallments.length && openInstallments.length > 0}
                            onCheckedChange={() =>
                              setSelectedDeletions(
                                selectedDeletions.size === openInstallments.length
                                  ? new Set()
                                  : new Set(openInstallments.map(i => i.id))
                              )
                            }
                          />
                          Selecionar todas
                        </label>
                        {openInstallments.map(inst => {
                          const todayStr = new Date().toISOString().slice(0, 10);
                          const isOverdue = inst.status === 'overdue' || (!!inst.dueDate && inst.dueDate < todayStr);
                          return (
                            <label
                              key={inst.id}
                              className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 ${isOverdue ? 'bg-destructive/5' : ''}`}
                            >
                              <Checkbox
                                checked={selectedDeletions.has(inst.id)}
                                onCheckedChange={() => toggleIn(selectedDeletions, setSelectedDeletions, inst.id)}
                              />
                              <div className="flex-1 text-sm">
                                <span className={isOverdue ? 'text-destructive font-semibold' : ''}>
                                  Parcela {label(inst)}
                                </span>
                                <span className={`ml-2 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                  venc. {inst.dueDate ? format(new Date(inst.dueDate + 'T12:00:00'), 'dd/MM/yyyy') : ''}
                                </span>
                                <span className={`ml-2 text-xs font-semibold ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {isOverdue ? '⚠️ Atrasada' : (statusLabel[inst.status] || inst.status)}
                                </span>
                              </div>
                              <span className={`font-medium text-sm ${isOverdue ? 'text-destructive' : ''}`}>
                                {formatCurrency(getInstallmentAmount(inst))}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      {openInstallments.length - selectedDeletions.size > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {openInstallments.length - selectedDeletions.size} parcela(s) permanecerá(ão) em aberto para cobrança.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma parcela em aberto nesta venda.
                    </p>
                  )}

                  {paidInstallments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Parcelas já pagas — marque as que deseja estornar:
                      </p>
                      <div className="border rounded-md divide-y">
                        <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50 text-sm font-medium">
                          <Checkbox
                            checked={selectedRefunds.size === paidInstallments.length && paidInstallments.length > 0}
                            onCheckedChange={() =>
                              setSelectedRefunds(
                                selectedRefunds.size === paidInstallments.length
                                  ? new Set()
                                  : new Set(paidInstallments.map(i => i.id))
                              )
                            }
                          />
                          Selecionar todas
                        </label>
                        {paidInstallments.map(inst => (
                          <label
                            key={inst.id}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={selectedRefunds.has(inst.id)}
                              onCheckedChange={() => toggleIn(selectedRefunds, setSelectedRefunds, inst.id)}
                            />
                            <div className="flex-1 text-sm">
                              <span>Parcela {label(inst)}</span>
                              <span className="text-muted-foreground ml-2">
                                {inst.paidDate ? format(new Date(inst.paidDate + 'T12:00:00'), 'dd/MM/yyyy') : ''}
                              </span>
                            </div>
                            <span className="font-medium text-sm">
                              {formatCurrency(getInstallmentAmount(inst))}
                            </span>
                          </label>
                        ))}
                      </div>
                      {selectedRefunds.size > 0 && (
                        <p className="text-xs text-destructive">
                          {selectedRefunds.size} parcela(s) será(ão) estornada(s) — total: {formatCurrency(
                            paidInstallments
                              .filter(i => selectedRefunds.has(i.id))
                              .reduce((sum, i) => sum + getInstallmentAmount(i), 0)
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleCancel(); }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Cancelando...</> : 'Confirmar Cancelamento'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
