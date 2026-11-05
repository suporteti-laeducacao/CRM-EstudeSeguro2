import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, CheckCircle, MessageSquare, Mail, ExternalLink, History, UserX, UserCheck, Ban, ShieldAlert, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useFinancial } from '@/contexts/FinancialContext';
import { Installment } from '@/lib/types';
import ConfirmPaymentDialog from './ConfirmPaymentDialog';
import InstallmentTimeline from './InstallmentTimeline';
import { parseLocalDate } from '@/lib/date';
import { supabase } from '@/integrations/supabase/client';

interface OverdueTabProps {
  onUpdate?: () => void;
  filterDataInicio?: Date;
  filterDataFim?: Date;
  filterVendedorId?: string;
}

const OverdueTab = ({ onUpdate, filterDataInicio, filterDataFim, filterVendedorId }: OverdueTabProps) => {
  const { installments: allInstallments, refreshInstallments } = useFinancial();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
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
        const dueDate = parseLocalDate(i.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        if (dueDate >= today) return false;

        // Vendor filter
        if (filterVendedorId && filterVendedorId !== 'all' && i.vendedorId !== filterVendedorId) return false;

        // Date filter
        if (filterDataInicio && dueDate < filterDataInicio) return false;
        if (filterDataFim && dueDate > filterDataFim) return false;

        return true;
      })
      .map(i => {
        const dueDate = parseLocalDate(i.dueDate);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return { ...i, status: 'overdue' as const, daysOverdue };
      })
      .sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));
  }, [allInstallments, filterDataInicio, filterDataFim, filterVendedorId]);

  const handleConfirmPayment = (installment: Installment) => {
    setSelectedInstallment(installment);
    setIsPaymentDialogOpen(true);
  };

  const handlePaymentConfirmed = async () => {
    await refreshInstallments();
    onUpdate?.();
    setIsPaymentDialogOpen(false);
    setSelectedInstallment(null);
  };

  const handleSendWhatsApp = (installment: Installment) => {
    toast.info('Funcionalidade de WhatsApp em breve');
  };

  const handleSendEmail = (installment: Installment) => {
    toast.info('Funcionalidade de e-mail em breve');
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
              <TableHead className="whitespace-nowrap">Valor Cheio</TableHead>
              <TableHead className="whitespace-nowrap">Valor Empresa</TableHead>
              <TableHead className="whitespace-nowrap">Vencimento</TableHead>
              <TableHead className="whitespace-nowrap">Dias em Atraso</TableHead>
              <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInstallments.map((inst) => {
              const isNegativado = !!negativadosMap[inst.id];
              return (
              <TableRow key={inst.id} className={isNegativado ? 'border-l-[3px] border-l-[#EA580C] hover:bg-brand-tint' : 'border-l-[3px] border-l-[#DC2626] hover:bg-brand-tint'}>
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
                  {inst.isRepasse && inst.fullValue ? (
                    <span className="text-muted-foreground">{formatCurrency(inst.fullValue)}</span>
                  ) : (
                    <span className="font-semibold text-destructive">{formatCurrency(inst.value)}</span>
                  )}
                </TableCell>
                <TableCell>
                  {inst.isRepasse ? (
                    <span className="font-semibold text-destructive">{formatCurrency(inst.companyValue || inst.value)}</span>
                  ) : (
                    <span className="font-semibold text-destructive">{formatCurrency(inst.value)}</span>
                  )}
                </TableCell>
                <TableCell>{parseLocalDate(inst.dueDate).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-[#FDECEC] text-[#B02121] border-transparent text-xs font-semibold">
                    {inst.daysOverdue} dias
                  </Badge>
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
                        <DropdownMenuItem onClick={() => { setSelectedInstallment(inst); setIsTimelineOpen(true); }}>
                          <History className="w-4 h-4 mr-2 text-ink-500" />
                          Histórico de alterações
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => window.open(`/vendas?sale=${inst.saleId}`, '_blank')}>
                          <ExternalLink className="w-4 h-4 mr-2 text-ink-500" />
                          Abrir venda
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendWhatsApp(inst)}>
                          <MessageSquare className="w-4 h-4 mr-2 text-ink-500" />
                          Enviar WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendEmail(inst)}>
                          <Mail className="w-4 h-4 mr-2 text-ink-500" />
                          Enviar E-mail
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );})}
            {filteredInstallments.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma parcela atrasada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {filteredInstallments.length} parcela(s) atrasada(s)
        </p>
        <p className="text-lg font-bold text-foreground">
          Total: <span className="text-destructive">
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

export default OverdueTab;
