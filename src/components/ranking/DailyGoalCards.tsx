import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CalendarClock, Gauge, Target, TrendingUp, Sunrise } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBRL, formatWeighted, GoalIndicators, STATUS_LABELS } from '@/lib/business-days';
import { PeriodStats } from '@/hooks/useBusinessDays';
import GoalDiagnosticsDialog from './GoalDiagnosticsDialog';

interface Props {
  indicators: GoalIndicators;
  stats: PeriodStats;
  isFullscreen?: boolean;
}

const statusClass: Record<string, string> = {
  adiantado: 'text-success',
  no_ritmo: 'text-ink-700',
  atencao: 'text-warning',
  atrasado: 'text-destructive',
  sem_meta: 'text-ink-500',
  inicio: 'text-ink-500',
};

const pesoLabel = (peso: number) => {
  if (peso >= 1) return '1,0 (integral)';
  if (peso > 0) return `${formatWeighted(peso)} (meio expediente — ${Math.round(peso * 8)}h)`;
  return '0 (não útil)';
};

const DailyGoalCards = ({ indicators, stats, isFullscreen }: Props) => {
  if (indicators.metaTotal <= 0) return null;

  const diaNaoUtilTexto = stats.feriadoHoje ? `Feriado — ${stats.feriadoHoje}` : 'Fim de semana ou fora do período';
  const percentDoDia = indicators.percentualDoDia * 100;

  const cards = [
    {
      title: 'Meta de hoje',
      icon: Target,
      value: indicators.periodoEncerrado
        ? 'Período encerrado'
        : stats.pesoHoje > 0
          ? formatBRL(indicators.metaDoDia)
          : 'Hoje não é dia útil',
      hint:
        stats.pesoHoje > 0
          ? `Ideal: ${formatBRL(indicators.metaDoDiaIdeal)} · peso do dia: ${pesoLabel(stats.pesoHoje)}`
          : diaNaoUtilTexto,
      className: 'text-primary',
    },
    {
      title: 'Realizado hoje',
      icon: Sunrise,
      value: formatBRL(indicators.realizadoHoje),
      hint:
        indicators.metaDoDia > 0
          ? `${formatBRL(indicators.realizadoHoje)} de ${formatBRL(indicators.metaDoDia)} (${percentDoDia.toFixed(1)}%)`
          : 'Sem meta definida para hoje',
      className: percentDoDia >= 100 ? 'text-success' : 'text-foreground',
      progress: indicators.metaDoDia > 0 ? Math.min(percentDoDia, 100) : undefined,
    },
    {
      title: 'Dias úteis restantes (inclui hoje)',
      icon: CalendarClock,
      value: formatWeighted(stats.diasPonderadosRestantes),
      hint: `${formatWeighted(stats.diasPonderadosDecorridos)} de ${formatWeighted(stats.diasPonderadosTotais)} decorridos · hoje vale ${formatWeighted(stats.pesoHoje)}`,
      hint2: `Invariante: ${formatWeighted(stats.diasPonderadosDecorridos)} + ${formatWeighted(stats.diasPonderadosRestantes)} = ${formatWeighted(stats.diasPonderadosDecorridos + stats.diasPonderadosRestantes)}`,
      className: 'text-foreground',
    },
    {
      title: 'Ritmo necessário',
      icon: Gauge,
      value: indicators.periodoEncerrado ? 'Período encerrado' : `${formatBRL(indicators.ritmoNecessario)}/dia`,
      hint: indicators.periodoEncerrado
        ? '—'
        : `por dia útil integral · sábado: ${formatBRL(indicators.ritmoNecessario / 2)}`,
      className: 'text-foreground',
    },
    {
      title: 'Saldo x esperado',
      icon: TrendingUp,
      value: indicators.semDiasDecorridos
        ? '—'
        : `${indicators.saldo >= 0 ? '+' : '−'}${formatBRL(Math.abs(indicators.saldo))}`,
      hint: indicators.semDiasDecorridos
        ? 'Aguardando 1º dia útil'
        : `Realizado até ontem: ${formatBRL(indicators.realizadoAteOntem)} · esperado: ${formatBRL(indicators.metaAcumuladaEsperada)}`,
      hint2:
        indicators.metaDoDia > 0
          ? `Hoje: ${formatBRL(indicators.realizadoHoje)} de ${formatBRL(indicators.metaDoDia)} (${percentDoDia.toFixed(1)}%)`
          : `Ao final de hoje: ${formatBRL(indicators.esperadoFimDoDia)}`,
      className: statusClass[indicators.status],
      badge: STATUS_LABELS[indicators.status],
    },
  ];

  return (
    <div className={cn('grid gap-4 grid-cols-1 sm:grid-cols-2', isFullscreen ? 'lg:grid-cols-5 max-w-7xl mx-auto' : 'lg:grid-cols-5')}>
      {cards.map((c, idx) => (
        <Card key={c.title} className={cn(isFullscreen && 'bg-card/80 backdrop-blur-sm')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={cn('text-sm font-medium', isFullscreen && 'text-base')}>{c.title}</CardTitle>
            <div className="flex items-center gap-1">
              {idx === 2 && !isFullscreen && <GoalDiagnosticsDialog stats={stats} indicators={indicators} />}
              <c.icon className={cn('h-4 w-4 text-muted-foreground', isFullscreen && 'h-5 w-5')} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn('font-display text-[26px] leading-8 tabular-nums', isFullscreen && 'text-3xl', c.className)}>{c.value}</div>
            {c.progress !== undefined && <Progress value={c.progress} className="h-2 mt-2" />}
            <p className="text-xs text-muted-foreground mt-1">{c.hint}</p>
            {c.hint2 && <p className="text-xs text-muted-foreground">{c.hint2}</p>}
            {c.badge && (
              <Badge variant="outline" className={cn('mt-2', c.className)}>{c.badge}</Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DailyGoalCards;
