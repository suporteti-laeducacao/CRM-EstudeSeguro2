import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Search, Eye, FileText, Undo2, RotateCcw, ExternalLink, History, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Installment } from '@/lib/types';
import { useFinancial } from '@/contexts/FinancialContext';
import { parseLocalDate } from '@/lib/date';
import { supabase } from '@/integrations/supabase/client';
import RefundDialog from './RefundDialog';
import InstallmentTimeline from './InstallmentTimeline';
import { toast } from '@/components/ui/sonner';
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

interface ReceivedTabProps {
  filterDataInicio?: Date;
  filterDataFim?: Date;
  filterVendedorId?: string;
}

const ReceivedTab = ({ filterDataInicio, filterDataFim, filterVendedorId }: ReceivedTabProps) => {
  const { installments: allInstallments, refreshInstallments } = useFinancial();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [receiptUrls, setReceiptUrls] = useState<string[]>([]);
  const [refundInstallment, setRefundInstallment] = useState<Installment | null>(null);
  const [revertInstallment, setRevertInstallment] = useState<Installment | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [timelineInstallment, setTimelineInstallment] = useState<Installment | null>(null);

  const handleRevertPayment = async () => {
    if (!revertInstallment) return;
    setIsReverting(true);
    try {
      const restoredValue = revertInstallment.isRepasse
        ? (revertInstallment.companyValue ?? revertInstallment.value)
        : (revertInstallment.fullValue ?? revertInstallment.value);

      const { error } = await supabase
        .from('installments')
        .update({
          status: 'pending',
          value: restoredValue,
          paid_date: null,
          paid_amount: null,
          paid_method: null,
          notes: null,
        })
        .eq('id', revertInstallment.id);
      if (error) throw error;

      // Estorna o razão de pagamentos (ledger) para não duplicar no ranking/relatórios
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      const { data: ledger } = await supabase
        .from('installment_payments')
        .select('id, valor, data_pagamento')
        .eq('installment_id', revertInstallment.id);

      const positivos = (ledger || []).filter((p: any) => Number(p.valor) > 0);
      const totalNegativo = (ledger || []).reduce((s: number, p: any) => s + Number(p.valor), 0);

      if (userId && positivos.length > 0 && totalNegativo > 0.001) {
        // Lança contrapartidas negativas nas mesmas datas dos pagamentos originais
        const estornos = positivos.map((p: any) => ({
          installment_id: revertInstallment.id,
          user_id: userId,
          valor: -Number(p.valor),
          data_pagamento: p.data_pagamento,
          metodo: 'estorno',
          observacoes: 'Reversão de pagamento (estorno de razão)',
        }));
        const { error: ledgerError } = await supabase.from('installment_payments').insert(estornos);
        if (ledgerError) throw ledgerError;
      }

      const { logInstallmentChange } = await import('@/lib/installment-audit');
      await logInstallmentChange({
        installment_id: revertInstallment.id,
        campo: 'status',
        valor_anterior: 'paid',
        valor_novo: 'pending',
        descricao: `Pagamento revertido. Valor restaurado: R$ ${restoredValue.toFixed(2).replace('.', ',')}`,
      });


      toast.success('Pagamento revertido com sucesso! Parcela voltou para "A Receber".');
      refreshInstallments();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao reverter pagamento.');
    } finally {
      setIsReverting(false);
      setRevertInstallment(null);
    }
  };

  const handleViewDetails = async (inst: Installment) => {
    setSelectedInstallment(inst);
    setReceiptUrls([]);
    if (inst.receipt) {
      const paths = inst.receipt.split('\n').filter(Boolean);
      const urls: string[] = [];
      for (const p of paths) {
        const { data } = await supabase.storage.from('comprovantes').createSignedUrl(p, 3600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setReceiptUrls(urls);
    }
  };

  const installments = useMemo(() => {
    return allInstallments
      .filter(i => {
        if (i.status !== 'paid' && i.status !== 'refunded') return false;

        // Vendor filter
        if (filterVendedorId && filterVendedorId !== 'all' && i.vendedorId !== filterVendedorId) return false;

        if (filterDataInicio || filterDataFim) {
          if (!i.paidDate) return false;
          const paidDate = parseLocalDate(i.paidDate);
          paidDate.setHours(0, 0, 0, 0);
          if (filterDataInicio && paidDate < filterDataInicio) return false;
          if (filterDataFim && paidDate > filterDataFim) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (!a.paidDate || !b.paidDate) return 0;
        return parseLocalDate(b.paidDate).getTime() - parseLocalDate(a.paidDate).getTime();
      });
  }, [allInstallments, filterDataInicio, filterDataFim, filterVendedorId]);

  const filteredInstallments = useMemo(() => {
    return installments.filter((inst) =>
      inst.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.course.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [installments, searchTerm]);

  const paidOnly = filteredInstallments.filter(i => i.status === 'paid');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por aluno ou curso..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aluno</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>N° Parcela</TableHead>
              <TableHead>Valor Cheio</TableHead>
              <TableHead>Valor Empresa</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Data Pagamento</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInstallments.map((inst) => {
              const isRefunded = inst.status === 'refunded';
              return (
                <TableRow key={inst.id} className={isRefunded ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{inst.studentName}</TableCell>
                  <TableCell>{inst.course}</TableCell>
                  <TableCell>{inst.installmentNumber}/{inst.totalInstallments}</TableCell>
                  <TableCell>
                    {inst.isRepasse && inst.fullValue ? (
                      <span className={`text-muted-foreground ${isRefunded ? 'line-through' : ''}`}>{formatCurrency(inst.fullValue)}</span>
                    ) : (
                      <span className={isRefunded ? 'line-through' : ''}>{formatCurrency(inst.paidAmount || inst.value)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {inst.isRepasse ? (
                      <span className={`font-semibold ${isRefunded ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                        {formatCurrency(inst.companyValue || inst.paidAmount || inst.value)}
                      </span>
                    ) : (
                      <span className={isRefunded ? 'line-through' : ''}>{formatCurrency(inst.paidAmount || inst.value)}</span>
                    )}
                  </TableCell>
                  <TableCell>{parseLocalDate(inst.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>{inst.paidDate ? parseLocalDate(inst.paidDate).toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell>{inst.paidMethod || '-'}</TableCell>
                  <TableCell>
                    {isRefunded ? (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        Estornado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                        Pago
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Mais ações" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64">
                          <DropdownMenuItem onClick={() => window.open(`/vendas?sale=${inst.saleId}`, '_blank')}>
                            <ExternalLink className="h-4 w-4 mr-2 text-ink-500" />
                            Abrir venda
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setTimelineInstallment(inst); setIsTimelineOpen(true); }}>
                            <History className="h-4 w-4 mr-2 text-ink-500" />
                            Histórico de alterações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewDetails(inst)}>
                            <Eye className="h-4 w-4 mr-2 text-ink-500" />
                            Ver detalhes
                          </DropdownMenuItem>
                          {!isRefunded && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setRevertInstallment(inst)}
                                className="text-warning focus:text-warning"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reverter pagamento (voltar para A Receber)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setRefundInstallment(inst)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Undo2 className="h-4 w-4 mr-2" />
                                Estornar parcela
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredInstallments.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nenhum pagamento recebido
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {paidOnly.length} pagamento(s) recebido(s)
          {filteredInstallments.length - paidOnly.length > 0 && (
            <span className="text-destructive ml-1">
              • {filteredInstallments.length - paidOnly.length} estornado(s)
            </span>
          )}
        </p>
        <p className="text-lg font-bold text-foreground">
          Total: <span className="text-success">
            {formatCurrency(paidOnly.reduce((sum, inst) => sum + (inst.paidAmount || inst.value), 0))}
          </span>
        </p>
      </div>

      {/* Refund Dialog */}
      <RefundDialog
        installment={refundInstallment}
        open={!!refundInstallment}
        onOpenChange={(open) => !open && setRefundInstallment(null)}
        onRefunded={refreshInstallments}
      />

      {/* Detail Dialog */}
      <Dialog open={!!selectedInstallment} onOpenChange={(open) => !open && setSelectedInstallment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
          </DialogHeader>
          {selectedInstallment && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Aluno</p>
                <p className="font-medium">{selectedInstallment.studentName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Parcela</p>
                <p className="font-medium">
                  {selectedInstallment.installmentNumber}/{selectedInstallment.totalInstallments} - {selectedInstallment.course}
                </p>
              </div>
              {selectedInstallment.status === 'refunded' && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="text-sm font-semibold text-destructive">⚠ Esta parcela foi estornada</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data do Pagamento</p>
                  <p className="font-medium">
                    {selectedInstallment.paidDate ? parseLocalDate(selectedInstallment.paidDate).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Forma de Pagamento</p>
                  <p className="font-medium">{selectedInstallment.paidMethod || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Pago</p>
                  <p className={`font-medium ${selectedInstallment.status === 'refunded' ? 'line-through text-muted-foreground' : 'text-success'}`}>
                    {formatCurrency(selectedInstallment.paidAmount || selectedInstallment.value)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{parseLocalDate(selectedInstallment.dueDate).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              {selectedInstallment.isRepasse && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Cheio</p>
                    <p className="font-medium">{formatCurrency(selectedInstallment.fullValue || 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Empresa</p>
                    <p className="font-medium text-primary">{formatCurrency(selectedInstallment.companyValue || 0)}</p>
                  </div>
                </div>
              )}
              {selectedInstallment.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">{selectedInstallment.notes}</p>
                </div>
              )}
              {receiptUrls.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {receiptUrls.length > 1 ? `Comprovantes (${receiptUrls.length})` : 'Comprovante'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {receiptUrls.map((url, idx) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-2">
                          <FileText className="h-4 w-4" />
                          {receiptUrls.length > 1 ? `Comprovante ${idx + 1}` : 'Ver Comprovante'}
                        </Button>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Revert Payment Dialog */}
      <AlertDialog open={!!revertInstallment} onOpenChange={(open) => !open && setRevertInstallment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter Pagamento</AlertDialogTitle>
            <AlertDialogDescription>
              {revertInstallment && (
                <>
                  Tem certeza que deseja reverter o pagamento da parcela{' '}
                  <strong>{revertInstallment.installmentNumber}/{revertInstallment.totalInstallments}</strong> de{' '}
                  <strong>{revertInstallment.studentName}</strong> no valor de{' '}
                  <strong>{formatCurrency(revertInstallment.paidAmount || revertInstallment.value)}</strong>?
                  <br /><br />
                  A parcela voltará para o status <strong>"A Receber"</strong> e os dados de pagamento serão removidos.
                  Isso será refletido em todos os dashboards e relatórios.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isReverting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevertPayment} disabled={isReverting}>
              {isReverting ? 'Revertendo...' : 'Sim, reverter pagamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {timelineInstallment && (
        <InstallmentTimeline
          installmentId={timelineInstallment.id}
          studentName={timelineInstallment.studentName}
          installmentLabel={`${timelineInstallment.installmentNumber}/${timelineInstallment.totalInstallments}`}
          open={isTimelineOpen}
          onOpenChange={setIsTimelineOpen}
        />
      )}
    </div>
  );
};

export default ReceivedTab;
