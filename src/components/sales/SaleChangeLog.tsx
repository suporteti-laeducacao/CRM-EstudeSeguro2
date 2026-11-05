import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { History } from 'lucide-react';

interface ChangeLogEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  user_id: string;
  user_name?: string;
}


interface SaleChangeLogProps {
  saleId: string;
}

const fieldLabels: Record<string, string> = {
  studentName: 'Nome do Aluno',
  course: 'Curso',
  paymentMode: 'Meio de Pagamento',
  amount: 'Valor',
  quantity: 'Quantidade',
  date: 'Data da Venda',
  seller: 'Vendedor',
  observation: 'Observação',
  tipoBoleto: 'Tipo de Boleto',
  grupoRepasseId: 'Grupo de Repasse',
  valorTotalBoleto: 'Valor Total Boleto',
  downPayment: 'Entrada',
  numberOfInstallments: 'Nº de Parcelas',
  firstDueDate: '1ª Parcela Vencimento',
  installment_added: 'Parcela Adicionada',
  installment_removed: 'Parcela Removida',
  installment_value: 'Valor da Parcela',
  installment_due_date: 'Vencimento da Parcela',
  total_sale_value: 'Valor Total da Venda',
};

export const SaleChangeLog = ({ saleId }: SaleChangeLogProps) => {
  const [logs, setLogs] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('sale_change_logs')
        .select('*')
        .eq('sale_id', saleId)
        .order('changed_at', { ascending: false });

      if (!error && data) {
        const userIds = [...new Set(data.map((d: ChangeLogEntry) => d.user_id).filter(Boolean))];
        let nameMap = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: vendedores } = await supabase
            .from('vendedores')
            .select('user_id, nome')
            .in('user_id', userIds);
          nameMap = new Map((vendedores || []).map(v => [v.user_id, v.nome]));
        }
        setLogs((data as ChangeLogEntry[]).map(d => ({
          ...d,
          user_name: nameMap.get(d.user_id) || 'Usuário desconhecido',
        })));
      }
      setLoading(false);
    };
    loadLogs();
  }, [saleId]);


  if (loading) return <p className="text-sm text-muted-foreground">Carregando histórico...</p>;
  if (logs.length === 0) return null;

  return (
    <div className="border rounded-lg p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-semibold text-sm">Histórico de Alterações</h4>
      </div>
      <ScrollArea className="max-h-48">
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="text-xs border-b pb-2 last:border-0">
              <span className="text-muted-foreground">
                {format(new Date(log.changed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
              <span className="ml-2 font-medium text-foreground">{log.user_name}</span>
              <span className="ml-2">
                alterou <strong>{fieldLabels[log.field_name] || log.field_name}</strong>
                {log.old_value && <> de <em className="text-destructive">"{log.old_value}"</em></>}
                {log.new_value && <> para <em className="text-primary">"{log.new_value}"</em></>}
              </span>
            </div>

          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
