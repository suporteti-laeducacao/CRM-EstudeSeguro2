import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, History, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LogEntry {
  id: string;
  campo: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  descricao: string;
  created_at: string;
  user_id: string;
  user_name?: string;
}

interface InstallmentTimelineProps {
  installmentId: string;
  studentName: string;
  installmentLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InstallmentTimeline = ({
  installmentId,
  studentName,
  installmentLabel,
  open,
  onOpenChange,
}: InstallmentTimelineProps) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && installmentId) {
      loadLogs();
    }
  }, [open, installmentId]);

  const loadLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('installment_change_logs')
      .select('id, campo, valor_anterior, valor_novo, descricao, created_at, user_id')
      .eq('installment_id', installmentId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Fetch user names from vendedores
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: vendedores } = await supabase
        .from('vendedores')
        .select('user_id, nome')
        .in('user_id', userIds);

      const nameMap = new Map(vendedores?.map(v => [v.user_id, v.nome]) || []);

      setLogs(data.map(d => ({
        ...d,
        user_name: nameMap.get(d.user_id) || 'Usuário desconhecido',
      })));
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico — {studentName} ({installmentLabel})
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma alteração registrada</p>
          ) : (
            <div className="relative pl-6 space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-[2px] bg-ink-200" />

              {logs.map((log) => (
                <div key={log.id} className="relative pb-5 last:pb-0">
                  {/* Timeline dot */}
                  <div className="absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full bg-ink-950 border-2 border-background" />

                    <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      <span>{log.user_name}</span>
                    </div>
                    <p className="text-sm font-medium">{log.descricao}</p>
                    {(log.valor_anterior || log.valor_novo) && (
                      <p className="text-xs text-muted-foreground">
                        {log.valor_anterior && <span className="line-through text-destructive">{log.valor_anterior}</span>}
                        {log.valor_anterior && log.valor_novo && ' → '}
                        {log.valor_novo && <span className="text-success font-medium">{log.valor_novo}</span>}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default InstallmentTimeline;
