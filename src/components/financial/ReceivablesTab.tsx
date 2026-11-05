import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Search, CheckCircle, Trash2, Pencil, FileText, ExternalLink, History, UserX, UserCheck, Ban, ShieldAlert, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { storage } from '@/lib/storage';
import { Installment } from '@/lib/types';
import { toast } from 'sonner';
import { useFinancial } from '@/contexts/FinancialContext';
import ConfirmPaymentDialog from './ConfirmPaymentDialog';
import EditDueDateDialog from './EditDueDateDialog';
import InstallmentTimeline from './InstallmentTimeline';
import { parseLocalDate } from '@/lib/date';
import { supabase } from '@/integrations/supabase/client';

interface ReceivablesTabProps {
  onUpdate?: () => void;
  filterDataInicio?: Date;
  filterDataFim?: Date;
  filterVendedorId?: string;
}

const ReceivablesTab = ({ onUpdate, filterDataInicio, filterDataFim, filterVendedorId }: ReceivablesTabProps) => {
  const { installments: allInstallments, refreshInstallments } = useFinancial();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isEditDueDateDialogOpen, setIsEditDueDateDialogOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [inativadosMap, setInativadosMap] = useState<Record<string, boolean>>({});
  const [negativadosMap, setNegativadosMap] = useState<Record<string, boolean>>({});

  const loadInativados = useCallback(async () => {
    const { data } = await supabase.from('sales').select('id, aluno_inativado_inadimplencia');
    if (data) {
      const map: Record<string, boolean> = {};
      data.forEach((s: any) => { map[s.id] = !!s.aluno_inativado_inadimplencia; });
      setInativadosMap(map);
    }
  }, []);

  const loadNegativados = useCallback(async () => {
    const { data } = await supabase.from('installments').select('id, negativado_spc' as any);
    if (data) {
      const map: Record<string, boolean> = {};
      (data as any[]).forEach((i) => { map[i.id] = !!i.negativado_spc; });
      setNegativadosMap(map);
    }
  }, []);

  useEffect(() => { loadInativados(); loadNegativados(); }, [loadInativados, loadNegativados]);

  const handleToggleNegativado = async (installmentId: string, studentName: string) => {
    const current = negativadosMap[installmentId] || false;
    const next = !current;
    const { error } = await supabase
      .from('installments')
      .update({ negativado_spc: next, negativado_spc_at: next ? new Date().toISOString() : null } as any)
      .eq('id', installmentId);
    if (error) {
      toast.error('Erro ao atualizar negativação');
      return;
    }
    setNegativadosMap(prev => ({ ...prev, [installmentId]: next }));
    toast.success(next
      ? `Parcela de ${studentName} marcada como negativada no SPC/Serasa`
      : `Negativação removida da parcela de ${studentName}`);
  };

  const handleToggleInativado = async (saleId: string, studentName: string) => {
    const current = inativadosMap[saleId] || false;
    const next = !current;
    const { error } = await supabase
      .from('sales')
      .update({ aluno_inativado_inadimplencia: next } as any)
      .eq('id', saleId);
    if (error) {
      toast.error('Erro ao atualizar status do aluno');
      return;
    }
    setInativadosMap(prev => ({ ...prev, [saleId]: next }));
    toast.success(next
      ? `${studentName} marcado como inativado por inadimplência`
      : `${studentName} reativado`);
  };


  const installments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return allInstallments
      .filter(i => {
        if (i.status === 'paid' || i.status === 'refunded' || i.status === 'locked') return false;

        // Vendor filter
        if (filterVendedorId && filterVendedorId !== 'all' && i.vendedorId !== filterVendedorId) return false;

        // Date filter on due date
        if (filterDataInicio || filterDataFim) {
          const dueDate = parseLocalDate(i.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          if (filterDataInicio && dueDate < filterDataInicio) return false;
          if (filterDataFim && dueDate > filterDataFim) return false;
        }

        return true;
      })
      .map(i => {
        const dueDate = parseLocalDate(i.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        let status: Installment['status'] = 'pending';
        let daysOverdue = 0;

        if (dueDate < today) {
          status = 'overdue';
          daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        } else if (dueDate.getTime() === today.getTime()) {
          status = 'due_today';
        }

        return { ...i, status, daysOverdue };
      })
      .sort((a, b) => parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime());
  }, [allInstallments, filterDataInicio, filterDataFim, filterVendedorId]);

  const handleConfirmPayment = (installment: Installment) => {
    setSelectedInstallment(installment);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentConfirmed = async () => {
    await refreshInstallments();
    onUpdate?.();
    setIsPaymentDialogOpen(false);
    setIsEditDueDateDialogOpen(false);
    setSelectedInstallment(null);
  };

  const handleEditDueDate = (installment: Installment) => {
    setSelectedInstallment(installment);
    setIsEditDueDateDialogOpen(true);
  };

  const handleDeleteInstallment = async (installment: Installment) => {
    if (window.confirm(`Deseja realmente excluir a parcela ${installment.installmentNumber}/${installment.totalInstallments} de ${installment.studentName}?`)) {
      try {
        await storage.deleteInstallment(installment.id);
        toast.success('Parcela excluída com sucesso');
        await refreshInstallments();
        onUpdate?.();
      } catch (error) {
        console.error('Error deleting installment:', error);
        toast.error('Erro ao excluir parcela');
      }
    }
  };

  const handleViewReceipt = async (receiptPath: string) => {
    try {
      const { data } = await supabase.storage.from('comprovantes').createSignedUrl(receiptPath, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      toast.error('Erro ao abrir comprovante');
    }
  };

  const filteredInstallments = useMemo(() => {
    return installments.filter((inst) =>
      inst.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.course.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [installments, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: Installment['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-ink-100 text-ink-700 border-transparent text-xs">Pendente</Badge>;
      case 'due_today':
        return <Badge variant="outline" className="bg-[#FFF1E7] text-[#B44309] border-transparent text-xs">Vence Hoje</Badge>;
      case 'overdue':
        return <Badge variant="outline" className="bg-[#FDECEC] text-[#B02121] border-transparent text-xs">Atrasado</Badge>;
      default:
        return null;
    }
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
              <TableHead className="whitespace-nowrap">Aluno</TableHead>
              <TableHead className="whitespace-nowrap">Produto</TableHead>
              <TableHead className="whitespace-nowrap">N° Parcela</TableHead>
              <TableHead className="whitespace-nowrap">Pagamento</TableHead>
              <TableHead className="whitespace-nowrap">Valor Aluno</TableHead>
              <TableHead className="whitespace-nowrap">Repasse a Receber</TableHead>
              <TableHead className="whitespace-nowrap">Já Pago</TableHead>
              <TableHead className="whitespace-nowrap">Restante</TableHead>
              <TableHead className="whitespace-nowrap">Vencimento</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Dias em Atraso</TableHead>
              <TableHead className="whitespace-nowrap">Comprovante</TableHead>
              <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInstallments.map((inst) => {
              const originalFullValue = inst.fullValue || inst.value;
              const alreadyPaid = inst.paidAmount || 0;
              const remainingValue = inst.value;
              const hasPartialPayment = alreadyPaid > 0;
              const isRepasse = inst.isRepasse;

              // For repasse: fullValue = student value, value = company commission
              // For non-repasse: value = student value (same thing)
              const valorAluno = isRepasse ? (inst.fullValue || inst.value) : (hasPartialPayment ? originalFullValue : inst.value);
              const valorEmpresa = isRepasse ? inst.value : null;

              const isNegativado = !!negativadosMap[inst.id];
              return (
                <TableRow key={inst.id} className={
                  isNegativado
                    ? 'border-l-[3px] border-l-[#EA580C] hover:bg-brand-tint'
                    : inst.status === 'overdue' ? 'border-l-[3px] border-l-[#DC2626] hover:bg-brand-tint' : 'hover:bg-brand-tint'
                }>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{inst.studentName}</span>
                      {inativadosMap[inst.saleId] && (
                        <Badge variant="outline" className="bg-[#FDECEC] text-[#B02121] border-transparent text-[11px] leading-4 py-0.5 w-fit">
                          Inativado por inadimplência
                        </Badge>
                      )}
                      {isNegativado && (
                        <Badge variant="outline" className="bg-[#FFF1E7] text-[#B44309] border-transparent text-[11px] leading-4 py-0.5 w-fit gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          Negativado SPC/Serasa
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{inst.course}</TableCell>
                  <TableCell>{inst.installmentNumber}/{inst.totalInstallments}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant="outline" className="w-fit text-xs">
                        {inst.salePaymentMode || '-'}
                      </Badge>
                      {inst.salePaymentMode === 'Boleto' && inst.saleTipoBoleto && (
                        <span className="text-xs text-muted-foreground">
                          {inst.saleTipoBoleto === 'repasse' ? 'Repasse' : 'Próprio'}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {isRepasse ? (
                      <span>{formatCurrency(valorAluno)}</span>
                    ) : hasPartialPayment ? (
                      <span className="text-muted-foreground">{formatCurrency(originalFullValue)}</span>
                    ) : (
                      formatCurrency(inst.value)
                    )}
                  </TableCell>
                  <TableCell>
                    {isRepasse ? (
                      <span className="font-semibold text-primary">{formatCurrency(valorEmpresa!)}</span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {hasPartialPayment ? (
                      <span className="font-semibold text-success">{formatCurrency(alreadyPaid)}</span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={hasPartialPayment ? 'font-bold text-primary' : ''}>
                      {formatCurrency(remainingValue)}
                    </span>
                  </TableCell>
                  <TableCell>{parseLocalDate(inst.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(inst.status)}
                      {hasPartialPayment && (
                        <Badge variant="outline" className="bg-[#FFF1E7] text-[#B44309] border-transparent text-xs">
                          Pagto Parcial
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {inst.daysOverdue && inst.daysOverdue > 0 ? (
                      <span className="text-destructive font-semibold">{inst.daysOverdue} dias</span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {inst.receipt ? (
                      <div className="flex flex-wrap gap-1">
                        {inst.receipt.split('\n').filter(Boolean).map((path, idx, arr) => (
                          <Button
                            key={path}
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewReceipt(path)}
                            title={`Ver comprovante ${idx + 1}`}
                            className="gap-1 h-7 px-2"
                          >
                            <FileText className="w-4 h-4 text-primary" />
                            {arr.length > 1 && <span className="text-xs">{idx + 1}</span>}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        onClick={() => handleConfirmPayment(inst)}
                        className="gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marcar como Pago
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Mais ações">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-72">
                          <DropdownMenuItem onClick={() => window.open(`/vendas?sale=${inst.saleId}`, '_blank')}>
                            <ExternalLink className="w-4 h-4 mr-2 text-ink-500" />
                            Abrir venda
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditDueDate(inst)}>
                            <Pencil className="w-4 h-4 mr-2 text-ink-500" />
                            Editar vencimento
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedInstallment(inst); setIsTimelineOpen(true); }}>
                            <History className="w-4 h-4 mr-2 text-ink-500" />
                            Histórico de alterações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleNegativado(inst.id, inst.studentName)}>
                            <Ban className="w-4 h-4 mr-2 text-ink-500" />
                            {isNegativado ? 'Remover negativação no SPC/Serasa' : 'Marcar parcela como negativada no SPC/Serasa'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleInativado(inst.saleId, inst.studentName)}>
                            {inativadosMap[inst.saleId]
                              ? <UserCheck className="w-4 h-4 mr-2 text-ink-500" />
                              : <UserX className="w-4 h-4 mr-2 text-ink-500" />}
                            {inativadosMap[inst.saleId] ? 'Reativar aluno na plataforma de estudos' : 'Marcar aluno como inativado por inadimplência'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDeleteInstallment(inst)} className="text-destructive focus:text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir parcela
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredInstallments.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-8 text-muted-foreground">
                  Nenhuma parcela a receber
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {filteredInstallments.length} parcela(s) pendente(s)
        </p>
        <p className="text-lg font-bold text-foreground">
          Total: <span className="text-primary">
            {formatCurrency(filteredInstallments.reduce((sum, inst) => sum + inst.value, 0))}
          </span>
        </p>
      </div>

      {selectedInstallment && (
        <>
          <ConfirmPaymentDialog
            installment={selectedInstallment}
            open={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
            onConfirm={handlePaymentConfirmed}
          />
          <EditDueDateDialog
            installment={selectedInstallment}
            open={isEditDueDateDialogOpen}
            onOpenChange={setIsEditDueDateDialogOpen}
            onConfirm={handlePaymentConfirmed}
          />
          <InstallmentTimeline
            installmentId={selectedInstallment.id}
            studentName={selectedInstallment.studentName}
            installmentLabel={`${selectedInstallment.installmentNumber}/${selectedInstallment.totalInstallments}`}
            open={isTimelineOpen}
            onOpenChange={setIsTimelineOpen}
          />
        </>
      )}
    </div>
  );
};

export default ReceivablesTab;
