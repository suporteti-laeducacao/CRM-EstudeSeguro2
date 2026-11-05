import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ContaPagar, Credor, FORMAS_PAGAMENTO } from '@/lib/payables-types';
import { confirmarPagamento, registrarJuros } from '@/lib/payables-storage';
import { toast } from 'sonner';

interface ConfirmPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: ContaPagar | null;
  credor: Credor | undefined;
  onSuccess: () => void;
}

const ConfirmPaymentDialog = ({ open, onOpenChange, conta, credor, onSuccess }: ConfirmPaymentDialogProps) => {
  const [dataPagamento, setDataPagamento] = useState<Date>(new Date());
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [valorPago, setValorPago] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  // Calculate values for partial payment tracking
  const valorTotal = conta?.valor_total || conta?.valor || 0;
  const valorJaPago = conta?.valor_pago || 0;
  const valorRestante = conta?.valor || 0;
  const valorDigitado = parseFloat((valorPago || '').replace(',', '.'));
  const jurosPreview = !isNaN(valorDigitado)
    ? Math.max(0, Number((valorDigitado - valorRestante).toFixed(2)))
    : 0;

  useEffect(() => {
    if (conta && open) {
      // Set default paid amount to remaining value
      setValorPago(valorRestante.toString());
    }
  }, [conta, open, valorRestante]);

  const handleConfirm = async () => {
    if (!conta) return;

    if (!formaPagamento) {
      toast.error('Selecione a forma de pagamento');
      return;
    }

    const valorPagoNum = parseFloat(valorPago.replace(',', '.'));
    
    if (isNaN(valorPagoNum) || valorPagoNum <= 0) {
      toast.error('Valor pago deve ser maior que zero');
      return;
    }

    const valorPrincipal = Math.min(valorPagoNum, valorRestante);
    const juros = Math.max(0, Number((valorPagoNum - valorRestante).toFixed(2)));

    setLoading(true);
    try {
      const dataStr = format(dataPagamento, 'yyyy-MM-dd');
      await confirmarPagamento(
        conta.id,
        dataStr,
        formaPagamento,
        valorPrincipal,
        valorTotal,
        observacoes || undefined
      );

      if (juros > 0) {
        await registrarJuros({
          conta,
          valorJuros: juros,
          valorPago: valorPagoNum,
          dataPagamento: dataStr,
          observacoes: observacoes || undefined,
        });
      }
      
      const novoTotalPago = valorJaPago + valorPrincipal;
      const novoRestante = valorTotal - novoTotalPago;
      
      if (novoRestante <= 0.01) {
        toast.success(
          juros > 0
            ? `Pagamento confirmado com ${formatCurrency(juros)} de juros/multa registrados.`
            : 'Pagamento integral confirmado com sucesso!'
        );
      } else {
        toast.success(`Pagamento parcial de ${formatCurrency(valorPrincipal)} registrado. Restam ${formatCurrency(novoRestante)} a pagar.`);
      }
      
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Erro ao confirmar pagamento');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDataPagamento(new Date());
    setFormaPagamento('pix');
    setValorPago('');
    setObservacoes('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (!conta) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Fornecedor/Prestador:</span>
              <span className="font-medium">{credor?.nome || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Descrição:</span>
              <span className="font-medium">{conta.descricao}</span>
            </div>
            
            {/* Show payment progress if there are partial payments */}
            {valorJaPago > 0 ? (
              <>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Valor Total:</span>
                  <span className="font-medium">{formatCurrency(valorTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Já Pago:</span>
                  <span className="font-medium text-success">{formatCurrency(valorJaPago)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">Restante:</span>
                  <span className="font-bold text-lg">{formatCurrency(valorRestante)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor:</span>
                <span className="font-bold text-lg">{formatCurrency(valorRestante)}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data do Pagamento *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dataPagamento, 'dd/MM/yyyy', { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dataPagamento}
                  onSelect={(date) => date && setDataPagamento(date)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Forma de Pagamento *</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valorPago">Valor Pago (R$) *</Label>
            <Input
              id="valorPago"
              type="number"
              step="0.01"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
              placeholder="0,00"
            />
            {jurosPreview > 0 ? (
              <p className="text-xs font-medium text-warning">
                Juros/multa: {formatCurrency(jurosPreview)} acima do valor de {formatCurrency(valorRestante)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Valor da conta: {formatCurrency(valorRestante)} · informe um valor maior para registrar juros
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações do pagamento..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? 'Confirmando...' : 'Confirmar Pagamento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmPaymentDialog;
