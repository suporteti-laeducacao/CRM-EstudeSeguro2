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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sale } from '@/lib/types';
import { storage } from '@/lib/storage';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface DeleteSaleDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  due_today: 'Vence hoje',
  overdue: 'Atrasada',
  paid: 'Paga',
  refunded: 'Estornada',
  locked: 'Trancada',
};

interface InstallmentRow {
  id: string;
  installment_number: number;
  total_installments: number;
  value: number;
  due_date: string;
  status: string;
  paid_date: string | null;
  paid_amount: number | null;
}

export const DeleteSaleDialog = ({ sale, open, onOpenChange, onSuccess }: DeleteSaleDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [installments, setInstallments] = useState<InstallmentRow[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);

  useEffect(() => {
    if (open && sale) {
      loadInstallments();
    }
  }, [open, sale?.id]);

  const loadInstallments = async () => {
    if (!sale) return;
    setLoadingInstallments(true);
    try {
      const { data, error } = await supabase
        .from('installments')
        .select('id, installment_number, total_installments, value, due_date, status, paid_date, paid_amount')
        .eq('sale_id', sale.id)
        .order('installment_number', { ascending: true });

      if (error) throw error;
      setInstallments((data || []).map(i => ({ ...i, value: Number(i.value), paid_amount: i.paid_amount ? Number(i.paid_amount) : null })));
    } catch (error) {
      console.error('Erro ao carregar parcelas:', error);
    } finally {
      setLoadingInstallments(false);
    }
  };

  const handleDelete = async () => {
    if (!sale) return;
    setIsLoading(true);
    try {
      await storage.deleteSale(sale.id);
      toast.success('Venda e parcelas excluídas com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      toast.error('Erro ao excluir venda. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Venda</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Deseja realmente excluir a venda de <strong>{sale?.studentName}</strong> — {sale?.course}?
              </p>
              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-destructive text-sm">
                <p className="font-semibold mb-1">⚠️ Esta ação é irreversível</p>
                <p>A venda e todas as parcelas listadas abaixo serão permanentemente removidas.</p>
              </div>

              {loadingInstallments ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : installments.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    Parcelas que serão excluídas ({installments.length}):
                  </p>
                  <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                    {installments.map(inst => (
                      <div key={inst.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex-1">
                          <span>
                            {inst.installment_number === 0
                              ? 'Entrada'
                              : `Parcela ${inst.installment_number}/${inst.total_installments}`}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            {format(new Date(inst.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            inst.status === 'paid' ? 'bg-[#E7F7F0] text-[#07714E]' :
                            inst.status === 'overdue' ? 'bg-[#FDECEC] text-[#B02121]' :
                            inst.status === 'locked' ? 'bg-ink-100 text-ink-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {statusLabels[inst.status] || inst.status}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(inst.paid_amount ?? inst.value)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhuma parcela vinculada a esta venda.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); handleDelete(); }}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Excluindo...</> : 'Confirmar Exclusão'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
