import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/date';
import { useNavigate } from 'react-router-dom';

const TARGET_EMAIL = 'suporte.ti@facla.edu.br';
const SESSION_KEY = 'payables_alert_shown';

interface ContaPendente {
  id: string;
  descricao: string;
  valor: number;
  valor_pago: number | null;
  data_vencimento: string;
  categoria: string;
}

const PayablesAlertDialog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [contas, setContas] = useState<ContaPendente[]>([]);

  useEffect(() => {
    if (!user || user.email !== TARGET_EMAIL) return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;

    const check = async () => {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('id, descricao, valor, valor_pago, data_vencimento, categoria, status')
        .lte('data_vencimento', todayStr)
        .neq('status', 'pago')
        .order('data_vencimento', { ascending: true });
      if (error || !data || data.length === 0) return;
      setContas(data as any);
      setOpen(true);
      sessionStorage.setItem(SESSION_KEY, '1');
    };
    check();
  }, [user]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Contas a pagar pendentes
          </DialogTitle>
          <DialogDescription>
            Existem {contas.length} {contas.length === 1 ? 'conta' : 'contas'} com vencimento hoje ou em atraso.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {contas.map((c) => {
            const due = parseLocalDate(c.data_vencimento);
            const isOverdue = due.getTime() < today.getTime();
            const restante = Number(c.valor) - Number(c.valor_pago || 0);
            return (
              <div
                key={c.id}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                  isOverdue
                    ? 'bg-[#FDECEC] border-[#F5C2C2]'
                    : 'bg-warning/10 border-warning/30'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{c.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.categoria} · Vence em {format(due, 'dd/MM/yyyy', { locale: ptBR })}
                    {isOverdue && <span className="ml-1 text-destructive font-semibold">(atrasada)</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatCurrency(restante)}</p>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              navigate('/financeiro');
            }}
          >
            Ir para Financeiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PayablesAlertDialog;
