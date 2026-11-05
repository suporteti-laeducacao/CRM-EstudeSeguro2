import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Stethoscope } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
  Certificacao,
  CertificacaoStatus,
  STATUS_LABELS,
  isAtrasada,
  todayISO,
} from '@/lib/certificacoes-storage';

interface Props {
  certs: Certificacao[];
}

const diff = (a?: string | null, b?: string | null) => {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000));
};

const media = (v: number[]) => (v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(1).replace('.', ',') : '—');

/** Diagnóstico do módulo de Certificação (Parte D) — visível apenas para administradores. */
export const CertificacaoDiagnostics = ({ certs }: Props) => {
  const { hasRole } = useAuth();
  const [open, setOpen] = useState(false);

  const porStatus = useMemo(() => {
    const map = new Map<CertificacaoStatus, number>();
    certs.forEach((c) => map.set(c.status, (map.get(c.status) || 0) + 1));
    return (Object.keys(STATUS_LABELS) as CertificacaoStatus[]).map((s) => ({
      status: s,
      qtd: map.get(s) || 0,
    }));
  }, [certs]);

  const etapas = useMemo(() => {
    const ativos = certs.filter((c) => c.status !== 'cancelada');
    return [
      {
        nome: 'Solicitação → Envio à certificadora',
        dias: ativos.map((c) => diff(c.data_solicitacao, c.data_envio_certificadora)).filter((v): v is number => v !== null),
      },
      {
        nome: 'Envio → Emissão',
        dias: ativos.map((c) => diff(c.data_envio_certificadora, c.data_emissao)).filter((v): v is number => v !== null),
      },
      {
        nome: 'Emissão → Entrega',
        dias: ativos.map((c) => diff(c.data_emissao, c.data_entrega)).filter((v): v is number => v !== null),
      },
      {
        nome: 'Solicitação → Entrega (total)',
        dias: ativos.map((c) => diff(c.data_solicitacao, c.data_entrega)).filter((v): v is number => v !== null),
      },
    ];
  }, [certs]);

  const inconsistencias = useMemo(() => {
    const out: { cert: Certificacao; motivo: string }[] = [];
    certs.forEach((c) => {
      if (!c.aluno_id) out.push({ cert: c, motivo: 'Sem aluno vinculado' });
      if (!c.prazo_previsto && c.status !== 'entregue' && c.status !== 'cancelada')
        out.push({ cert: c, motivo: 'Sem prazo previsto' });
      if (c.status === 'entregue' && (!c.data_entrega || !c.canal_entrega))
        out.push({ cert: c, motivo: 'Entregue sem data/canal de entrega' });
      if (c.data_emissao && c.data_envio_certificadora && c.data_emissao < c.data_envio_certificadora)
        out.push({ cert: c, motivo: 'Emissão anterior ao envio' });
      if (isAtrasada(c)) out.push({ cert: c, motivo: `Atrasada (prazo ${c.prazo_previsto})` });
    });
    return out;
  }, [certs]);

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push('Diagnostico;Valor');
    lines.push(`Hoje (SP);${todayISO()}`);
    lines.push(`Registros analisados;${certs.length}`);
    lines.push('');
    lines.push('Status;Quantidade');
    porStatus.forEach((s) => lines.push(`${STATUS_LABELS[s.status]};${s.qtd}`));
    lines.push('');
    lines.push('Etapa;Amostra;Media (dias)');
    etapas.forEach((e) => lines.push(`${e.nome};${e.dias.length};${media(e.dias)}`));
    lines.push('');
    lines.push('Aluno;Curso;Status;Inconsistencia');
    inconsistencias.forEach((i) =>
      lines.push(`${i.cert.nome};${i.cert.curso || ''};${STATUS_LABELS[i.cert.status]};${i.motivo}`)
    );
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `diagnostico-certificacao_${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!hasRole('admin')) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Diagnóstico da certificação" title="Diagnóstico da certificação">
          <Stethoscope className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-8">
            <span>Diagnóstico — Certificação</span>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div>
          <p className="mb-2 text-sm font-medium">Distribuição por etapa</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-sm">
            {porStatus.map((s) => (
              <div key={s.status} className="rounded-md border p-2">
                <p className="text-muted-foreground text-xs">{STATUS_LABELS[s.status]}</p>
                <p className="font-semibold">{s.qtd}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Tempo médio por etapa</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Etapa</TableHead>
                <TableHead className="text-right">Amostra</TableHead>
                <TableHead className="text-right">Média (dias)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {etapas.map((e) => (
                <TableRow key={e.nome}>
                  <TableCell>{e.nome}</TableCell>
                  <TableCell className="text-right">{e.dias.length}</TableCell>
                  <TableCell className="text-right">{media(e.dias)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">
            Inconsistências encontradas ({inconsistencias.length})
          </p>
          {inconsistencias.length === 0 ? (
            <p className="text-sm text-success">Nenhuma inconsistência nos registros filtrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ocorrência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inconsistencias.slice(0, 200).map((i, idx) => (
                  <TableRow key={`${i.cert.id}-${idx}`}>
                    <TableCell>{i.cert.nome}</TableCell>
                    <TableCell>{i.cert.curso || '—'}</TableCell>
                    <TableCell>{STATUS_LABELS[i.cert.status]}</TableCell>
                    <TableCell>{i.motivo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CertificacaoDiagnostics;
