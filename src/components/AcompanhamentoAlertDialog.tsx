import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { carregarRegua } from '@/lib/acompanhamento-storage';
import { getMyVendedorId } from '@/lib/vendedores-storage';
import { AlertaAcompanhamento } from '@/lib/acompanhamento';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PhoneCall } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/date';
import { useNavigate } from 'react-router-dom';

const SESSION_KEY = 'acompanhamento_alert_shown';

const AcompanhamentoAlertDialog = () => {
  const { user, hasRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pendentes, setPendentes] = useState<AlertaAcompanhamento[]>([]);
  const [visaoCompleta, setVisaoCompleta] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;

    const podeVerTodos = hasRole('admin') || hasRole('gerente') || hasRole('supervisor');
    const isVendedor = hasRole('vendedor');
    if (!podeVerTodos && !isVendedor) return;

    const check = async () => {
      try {
        const [regua, meuVendedorId] = await Promise.all([carregarRegua(), getMyVendedorId()]);
        let lista = regua.alertas.filter((a) => a.pendente);
        if (!podeVerTodos) {
          lista = lista.filter((a) => a.vendedorId && a.vendedorId === meuVendedorId);
        }
        if (lista.length === 0) return;
        setPendentes(lista);
        setVisaoCompleta(podeVerTodos);
        setOpen(true);
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        // silencioso: popup é informativo
      }
    };
    check();
  }, [user, authLoading, hasRole]);

  const vencidos = pendentes.filter((a) => a.marcoAtual === 'VENCIDO').length;
  const hoje = pendentes.length - vencidos;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-warning" />
            Contatos de acompanhamento pendentes
          </DialogTitle>
          <DialogDescription>
            {visaoCompleta ? (
              <>
                Existem {pendentes.length}{' '}
                {pendentes.length === 1 ? 'contato pendente' : 'contatos pendentes'} na equipe
                {vencidos > 0 && ` (${vencidos} ${vencidos === 1 ? 'vencido' : 'vencidos'}`}
                {vencidos > 0 && hoje > 0 && ` e ${hoje} para hoje`}
                {vencidos > 0 && ')'}. Cobre os colaboradores responsáveis para realizar esses
                contatos.
              </>
            ) : (
              <>
                Você tem {pendentes.length}{' '}
                {pendentes.length === 1 ? 'contato pendente' : 'contatos pendentes'}
                {vencidos > 0 && ` (${vencidos} ${vencidos === 1 ? 'vencido' : 'vencidos'}`}
                {vencidos > 0 && hoje > 0 && ` e ${hoje} para hoje`}
                {vencidos > 0 && ')'}. Entre em contato com os alunos abaixo.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-2">
          {pendentes.map((a) => {
            const vencido = a.marcoAtual === 'VENCIDO';
            return (
              <div
                key={a.saleId}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                  vencido
                    ? 'bg-[#FDECEC] border-[#F5C2C2]'
                    : 'bg-warning/10 border-warning/30'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.alunoNome}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.curso} · Previsão de conclusão em{' '}
                    {format(parseLocalDate(a.previsaoConclusao), 'dd/MM/yyyy', { locale: ptBR })}
                    {visaoCompleta && a.vendedorNome && <> · Vendedor: {a.vendedorNome}</>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      vencido
                        ? 'bg-[#FDECEC] text-[#B02121]'
                        : 'bg-warning/15 text-warning'
                    }`}
                  >
                    {vencido ? `Vencido há ${Math.abs(a.diasRestantes)} dia(s)` : `Marco ${a.marcoAtual ?? ''} hoje`}
                  </span>
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
              navigate('/acompanhamento');
            }}
          >
            Ir para Fila de Contatos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AcompanhamentoAlertDialog;
