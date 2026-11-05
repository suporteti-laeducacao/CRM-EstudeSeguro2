import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Award, Clock, AlertTriangle, CheckCircle2, Timer, UserPlus } from 'lucide-react';
import { Certificacao, isAtrasada } from '@/lib/certificacoes-storage';

interface Props {
  certs: Certificacao[];
}

const days = (a?: string | null, b?: string | null) => {
  if (!a || !b) return null;
  const d = (new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000;
  return Math.max(0, Math.round(d));
};

const avg = (values: number[]) =>
  values.length ? (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1).replace('.', ',') : '—';

/** Painel de indicadores da Certificação (Parte C) — acompanha os filtros da tela. */
export const CertificacaoKPIs = ({ certs }: Props) => {
  const kpis = useMemo(() => {
    const ativos = certs.filter((c) => c.status !== 'cancelada');
    const emAndamento = ativos.filter((c) => c.status !== 'entregue');
    const atrasadas = ativos.filter(isAtrasada);
    const entregues = ativos.filter((c) => c.status === 'entregue');

    const tempoEmissao = ativos
      .map((c) => days(c.data_solicitacao, c.data_emissao))
      .filter((v): v is number => v !== null);
    const tempoEntrega = entregues
      .map((c) => days(c.data_solicitacao, c.data_entrega))
      .filter((v): v is number => v !== null);

    const aptos = ativos.filter((c) => c.apto_nova_oferta);
    const matriculados = aptos.filter((c) => c.resultado_contato === 'matriculado').length;
    const conversao = aptos.length ? `${Math.round((matriculados / aptos.length) * 100)}%` : '—';

    return [
      { label: 'Total de certificações', value: ativos.length, icon: Award, color: 'text-primary' },
      { label: 'Em andamento', value: emAndamento.length, icon: Clock, color: 'text-ink-700' },
      { label: 'Atrasadas', value: atrasadas.length, icon: AlertTriangle, color: 'text-destructive' },
      { label: 'Entregues', value: entregues.length, icon: CheckCircle2, color: 'text-success' },
      {
        label: 'Tempo médio até emissão',
        value: `${avg(tempoEmissao)} d`,
        icon: Timer,
        color: 'text-warning',
      },
      {
        label: 'Aptos a nova oferta',
        value: `${aptos.length} (${conversao})`,
        icon: UserPlus,
        color: 'text-ink-700',
        subtitle: `Tempo médio até entrega: ${avg(tempoEntrega)} d`,
      },
    ] as const;
  }, [certs]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => (
        <Card key={k.label} className="rounded-[14px] border-ink-200 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium text-ink-500">{k.label}</p>
                <p className="font-display text-[26px] leading-8 font-extrabold text-ink-950 tabular-nums">{k.value}</p>
                {'subtitle' in k && k.subtitle && (
                  <p className="mt-1 text-[11px] text-ink-500 tabular-nums">{k.subtitle}</p>
                )}
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ink-100 ${k.color}`}>
                <k.icon className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CertificacaoKPIs;
