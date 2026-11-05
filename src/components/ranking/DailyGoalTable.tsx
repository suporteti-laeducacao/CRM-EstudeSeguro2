import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Download } from 'lucide-react';
import { computeIndicators, formatBRL, formatWeighted, GoalIndicators, STATUS_LABELS } from '@/lib/business-days';
import { PeriodStats } from '@/hooks/useBusinessDays';
import { cn } from '@/lib/utils';
import DualProgress from './DualProgress';

interface SellerRow {
  name: string;
  totalAmount: number;
  /** realizado do dia corrente */
  todayAmount?: number;
  /** realizado por dia (yyyy-MM-dd → valor) */
  daily?: Record<string, number>;
}

interface Props {
  sellers: SellerRow[];
  metaBySellerName: Map<string, number>;
  stats: PeriodStats;
  /** dias úteis já decorridos (anteriores a hoje), usados na faixa de projeção */
  elapsedDayKeys?: string[];
  /** Indicadores da meta geral, usados para conferir a soma das colunas. */
  geralIndicators?: GoalIndicators;
}

const statusClass: Record<string, string> = {
  adiantado: 'bg-[#E7F7F0] text-[#07714E] border-transparent',
  no_ritmo: 'bg-ink-100 text-ink-700 border-transparent',
  atencao: 'bg-[#FFF1E7] text-[#B44309] border-transparent',
  atrasado: 'bg-[#FDECEC] text-[#B02121] border-transparent',
  sem_meta: 'bg-ink-100 text-ink-500 border-transparent',
  inicio: 'bg-ink-100 text-ink-500 border-transparent',
};

const DailyGoalTable = ({ sellers, metaBySellerName, stats, elapsedDayKeys, geralIndicators }: Props) => {
  const rows = useMemo(
    () =>
      sellers
        .map((s) => {
          const meta = metaBySellerName.get(s.name) || 0;
          let melhor: number | undefined;
          let pior: number | undefined;
          if (s.daily && elapsedDayKeys && elapsedDayKeys.length > 0) {
            const vals = elapsedDayKeys.map((k) => s.daily?.[k] || 0);
            melhor = Math.max(...vals);
            pior = Math.min(...vals);
          }
          const ind = computeIndicators({
            metaTotal: meta,
            realizado: s.totalAmount,
            realizadoHoje: s.todayAmount || 0,
            melhorDiaRealizado: melhor,
            piorDiaRealizado: pior,
            diasPonderadosTotais: stats.diasPonderadosTotais,
            diasPonderadosDecorridos: stats.diasPonderadosDecorridos,
            diasPonderadosRestantes: stats.diasPonderadosRestantes,
            pesoHoje: stats.pesoHoje,
          });
          return { name: s.name, meta, ind };
        })
        .sort((a, b) => b.ind.realizado - a.ind.realizado || b.ind.saldo - a.ind.saldo),
    [sellers, metaBySellerName, stats, elapsedDayKeys]
  );

  const totals = useMemo(() => {
    const acc = rows.reduce(
      (t, r) => ({
        meta: t.meta + r.meta,
        realizado: t.realizado + r.ind.realizado,
        hoje: t.hoje + r.ind.realizadoHoje,
        metaDiariaIdeal: t.metaDiariaIdeal + r.ind.metaDiariaIdeal,
        metaDoDia: t.metaDoDia + r.ind.metaDoDia,
        ritmoNecessario: t.ritmoNecessario + r.ind.ritmoNecessario,
        saldo: t.saldo + r.ind.saldo,
        projecao: t.projecao + r.ind.projecaoFechamento,
      }),
      { meta: 0, realizado: 0, hoje: 0, metaDiariaIdeal: 0, metaDoDia: 0, ritmoNecessario: 0, saldo: 0, projecao: 0 }
    );
    return acc;
  }, [rows]);

  const divergencia = geralIndicators
    ? Math.abs(totals.meta - geralIndicators.metaTotal) > 0.05 ||
      Math.abs(totals.realizado - geralIndicators.realizado) > 0.05
    : false;

  const percentTempo = (stats.diasPonderadosTotais > 0
    ? stats.diasPonderadosDecorridos / stats.diasPonderadosTotais
    : 0) * 100;

  const exportCsv = () => {
    const header = [
      'Vendedor', 'Meta do periodo', 'Realizado', 'Realizado hoje', '% atingido', '% tempo decorrido',
      'Meta diaria ideal', 'Meta de hoje', 'Ritmo necessario/dia', 'Esperado ate ontem',
      'Realizado ate ontem', 'Saldo', 'Projecao fechamento', 'Projecao min', 'Projecao max', 'Status',
    ];
    const lines = rows.map((r) => [
      r.name,
      r.meta.toFixed(2),
      r.ind.realizado.toFixed(2),
      r.ind.realizadoHoje.toFixed(2),
      (r.ind.percentualAtingido * 100).toFixed(1),
      (r.ind.percentualTempo * 100).toFixed(1),
      r.ind.metaDiariaIdeal.toFixed(2),
      r.ind.metaDoDia.toFixed(2),
      r.ind.ritmoNecessario.toFixed(2),
      r.ind.metaAcumuladaEsperada.toFixed(2),
      r.ind.realizadoAteOntem.toFixed(2),
      r.ind.saldo.toFixed(2),
      r.ind.projecaoFechamento.toFixed(2),
      r.ind.projecaoMin.toFixed(2),
      r.ind.projecaoMax.toFixed(2),
      STATUS_LABELS[r.ind.status],
    ].join(';'));
    const csv = [header.join(';'), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `meta-diaria_${stats.start}_a_${stats.end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const renderProjecao = (ind: GoalIndicators, _hasMeta: boolean) => {
    if (ind.semBaseProjecao) {
      return (
        <div className="text-right">
          <span className="text-muted-foreground">—</span>
          <p className="text-[11px] text-muted-foreground">sem base de cálculo ainda</p>
        </div>
      );
    }
    if (ind.amostraInsuficiente) {
      const tip = `Projeção baseada em apenas ${formatWeighted(ind.diasPonderadosDecorridos)} dias úteis — tende a variar bastante no início do período.`;
      return (
        <div className="text-right text-muted-foreground" title={tip}>
          <div className="flex items-center justify-end gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            <span>{formatBRL(ind.projecaoFechamento)}</span>
          </div>
          <p className="text-[11px]">
            faixa {formatBRL(ind.projecaoMin)} – {formatBRL(ind.projecaoMax)}
          </p>
        </div>
      );
    }
    return formatBRL(ind.projecaoFechamento);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Dias úteis ponderados do período: <strong>{formatWeighted(stats.diasPonderadosTotais)}</strong> ·
          decorridos <strong>{formatWeighted(stats.diasPonderadosDecorridos)}</strong> ·
          restantes (inclui hoje) <strong>{formatWeighted(stats.diasPonderadosRestantes)}</strong>
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      {divergencia && (
        <div className="flex items-center gap-2 rounded-[10px] border border-warning/40 bg-[#FFF1E7] p-3 text-sm text-[#B44309]">
          <AlertTriangle className="h-4 w-4" />
          A soma das colunas dos colaboradores não confere com os cards da meta geral.
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Meta</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead className="w-44">Progresso</TableHead>
              <TableHead className="text-right">Meta Diária Inicial</TableHead>
              <TableHead className="text-right">Meta de hoje</TableHead>
              <TableHead className="text-right">Hoje</TableHead>
              <TableHead className="text-right">Ritmo necessário</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead className="text-right">Projeção</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhum vendedor no período</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.name}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right">{r.meta > 0 ? formatBRL(r.meta) : <span className="text-muted-foreground">Sem meta</span>}</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(r.ind.realizado)}</TableCell>
                <TableCell>
                  {r.meta > 0 ? (
                    <DualProgress
                      value={r.ind.percentualAtingido * 100}
                      expected={percentTempo}
                      showLabel
                      barClassName="h-2"
                    />
                  ) : '—'}
                </TableCell>
                <TableCell className="text-right">{r.meta > 0 ? formatBRL(r.ind.metaDiariaIdeal) : '—'}</TableCell>
                <TableCell className="text-right">
                  {r.meta > 0 && stats.pesoHoje > 0 && !r.ind.periodoEncerrado ? formatBRL(r.ind.metaDoDia) : '—'}
                </TableCell>
                <TableCell className={cn('text-right tabular-nums', r.ind.realizadoHoje > 0 && 'font-semibold text-success')}>
                  {formatBRL(r.ind.realizadoHoje)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {r.meta > 0 && !r.ind.periodoEncerrado ? `${formatBRL(r.ind.ritmoNecessario)}/dia` : '—'}
                </TableCell>
                <TableCell className={cn('text-right font-semibold tabular-nums', r.ind.saldo >= 0 ? 'text-success' : 'text-destructive')}>
                  {r.meta > 0 && !r.ind.semDiasDecorridos ? `${r.ind.saldo >= 0 ? '+' : '−'}${formatBRL(Math.abs(r.ind.saldo))}` : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {renderProjecao(r.ind, r.meta > 0)}
                </TableCell>

                <TableCell>
                  <Badge variant="outline" className={statusClass[r.meta > 0 ? r.ind.status : 'sem_meta']}>
                    {STATUS_LABELS[r.meta > 0 ? r.ind.status : 'sem_meta']}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Totais</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(totals.meta)}</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(totals.realizado)}</TableCell>
                <TableCell />
                <TableCell className="text-right font-semibold">{formatBRL(totals.metaDiariaIdeal)}</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(totals.metaDoDia)}</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(totals.hoje)}</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(totals.ritmoNecessario)}</TableCell>
                <TableCell className="text-right font-semibold">{`${totals.saldo >= 0 ? '+' : '−'}${formatBRL(Math.abs(totals.saldo))}`}</TableCell>
                <TableCell className="text-right font-semibold">{formatBRL(totals.projecao)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
};

export default DailyGoalTable;
