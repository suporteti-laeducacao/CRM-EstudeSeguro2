import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Credor, ContaPagar, CATEGORIAS_CONTA } from '@/lib/payables-types';
import { format, parseISO, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CredorHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credor: Credor | null;
  contasPagar: ContaPagar[];
}

const CredorHistoryDialog = ({ open, onOpenChange, credor, contasPagar }: CredorHistoryDialogProps) => {
  const historico = useMemo(() => {
    if (!credor) return { contasCredor: [], totalPagoAno: 0, totalPendente: 0 };

    const hoje = new Date();
    const inicioAno = startOfYear(hoje);
    const fimAno = endOfYear(hoje);

    const contasCredor = contasPagar
      .filter(c => c.credor_id === credor.id)
      .sort((a, b) => new Date(b.data_vencimento).getTime() - new Date(a.data_vencimento).getTime());

    const totalPagoAno = contasCredor
      .filter(c => {
        if (c.status !== 'pago' || !c.data_pagamento) return false;
        const pagamento = parseISO(c.data_pagamento);
        return pagamento >= inicioAno && pagamento <= fimAno;
      })
      .reduce((sum, c) => sum + c.valor, 0);

    const totalPendente = contasCredor
      .filter(c => c.status !== 'pago')
      .reduce((sum, c) => sum + c.valor, 0);

    return { contasCredor, totalPagoAno, totalPendente };
  }, [credor, contasPagar]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">✓ Pago</Badge>;
      case 'pendente':
        return <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent">Pendente</Badge>;
      case 'atrasado':
        return <Badge className="bg-[#FDECEC] text-[#B02121] border-transparent">Atrasado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    return CATEGORIAS_CONTA.find(c => c.value === categoria)?.label || categoria;
  };

  if (!credor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Histórico - {credor.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#E7F7F0] p-4 rounded-lg border border-[#BFE7D6]">
              <p className="text-sm text-muted-foreground">Total pago (ano)</p>
              <p className="text-xl font-bold text-success">
                {formatCurrency(historico.totalPagoAno)}
              </p>
            </div>
            <div className="bg-[#FFF1E7] p-4 rounded-lg border border-[#FFD3B0]">
              <p className="text-sm text-muted-foreground">Total pendente</p>
              <p className="text-xl font-bold tabular-nums text-[#B44309]">
                {formatCurrency(historico.totalPendente)}
              </p>
            </div>
          </div>

          <ScrollArea className="h-[350px] pr-4">
            <div className="space-y-2">
              {historico.contasCredor.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma conta encontrada para este credor.
                </p>
              ) : (
                historico.contasCredor.map((conta) => (
                  <div
                    key={conta.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {format(parseISO(conta.data_vencimento), 'MMM/yy', { locale: ptBR })}
                        </span>
                        <span className="font-medium">{conta.descricao}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {getCategoriaLabel(conta.categoria)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{formatCurrency(conta.valor)}</span>
                      {getStatusBadge(conta.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CredorHistoryDialog;
