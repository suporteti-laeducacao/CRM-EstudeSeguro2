import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { getHistorico, CertificacaoHistorico, STATUS_LABELS, CertificacaoStatus } from '@/lib/certificacoes-storage';

interface Props {
  certificacaoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export const CertificacaoHistoryDialog = ({ certificacaoId, open, onOpenChange }: Props) => {
  const [logs, setLogs] = useState<CertificacaoHistorico[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !certificacaoId) return;
    setLoading(true);
    getHistorico(certificacaoId)
      .then(setLogs)
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, certificacaoId]);

  const label = (s: string | null) => (s ? STATUS_LABELS[s as CertificacaoStatus] || s : '—');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Histórico da certificação</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map((l) => (
              <div key={l.id} className="text-sm border-b pb-2 last:border-0">
                <span className="text-muted-foreground">
                  {format(new Date(l.created_at), "dd/MM/yyyy 'às' HH:mm")}
                </span>
                <span className="ml-2">
                  {label(l.status_anterior)} → <strong>{label(l.status_novo)}</strong>
                </span>
                {l.observacao && <p className="text-xs text-muted-foreground">{l.observacao}</p>}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
