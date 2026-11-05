import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Stethoscope } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBusinessDays, PeriodStats } from '@/hooks/useBusinessDays';
import { formatWeighted, GoalIndicators } from '@/lib/business-days';

interface Props {
  stats: PeriodStats;
  indicators?: GoalIndicators;
}

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const n2 = (v: number) => v.toFixed(2).replace('.', ',');
const n1 = (v: number) => formatWeighted(v);

/** Painel de diagnóstico do cálculo de dias úteis — visível apenas para administradores. */
const GoalDiagnosticsDialog = ({ stats, indicators }: Props) => {
  const { hasRole } = useAuth();
  const { engine } = useBusinessDays();
  const [open, setOpen] = useState(false);

  const days = useMemo(
    () => (open ? engine.listDays(stats.start, stats.end) : []),
    [open, engine, stats.start, stats.end]
  );

  const soma = stats.diasPonderadosDecorridos + stats.diasPonderadosRestantes;
  const invarianteOk = Math.abs(soma - stats.diasPonderadosTotais) < 0.001;

  const motivoDe = (d: (typeof days)[number]) => {
    const weekday = new Date(`${d.key}T12:00:00`).getDay();
    if (d.exception) return `Exceção: ${d.exception.description}`;
    if (d.holiday) return `Feriado: ${d.holiday.name}`;
    if (weekday === 0) return 'Domingo';
    if (weekday === 6) return d.weight > 0 ? 'Sábado meio expediente' : 'Sábado não útil';
    if (d.weight < 1) return 'Jornada reduzida';
    return 'Dia útil integral';
  };

  const formulas = useMemo(() => {
    if (!indicators) return [] as string[];
    const i = indicators;
    return [
      `meta_diaria_ideal = ${n2(i.metaTotal)} / ${n1(i.diasPonderadosTotais)} = ${n2(i.metaDiariaIdeal)}`,
      `esperado_ate_ontem = ${n2(i.metaDiariaIdeal)} × ${n1(i.diasPonderadosDecorridos)} = ${n2(i.metaAcumuladaEsperada)}`,
      `esperado_fim_do_dia = ${n2(i.metaDiariaIdeal)} × (${n1(i.diasPonderadosDecorridos)} + ${n1(i.pesoHoje)}) = ${n2(i.esperadoFimDoDia)}`,
      `ritmo_necessario = (${n2(i.metaTotal)} − ${n2(i.realizado)}) / ${n1(i.diasPonderadosRestantes)} = ${n2(i.ritmoNecessario)}`,
      `meta_de_hoje_ajustada = ${n2(i.ritmoNecessario)} × ${n1(i.pesoHoje)} = ${n2(i.metaDoDia)}`,
      `saldo = ${n2(i.realizadoAteOntem)} − ${n2(i.metaAcumuladaEsperada)} = ${n2(i.saldo)}`,
      `ritmo_atual = ${n2(i.realizadoAteOntem)} / ${n1(i.diasPonderadosDecorridos)} = ${n2(i.ritmoAtual)}`,
      `projecao = ${n2(i.ritmoAtual)} × ${n1(i.diasPonderadosTotais)} = ${n2(i.projecaoFechamento)}`,
      `percentual_tempo = ${n1(i.diasPonderadosDecorridos)} / ${n1(i.diasPonderadosTotais)} = ${(i.percentualTempo * 100).toFixed(1)}%`,
    ];
  }, [indicators]);

  const exportCsv = () => {
    const lines: string[] = [];
    lines.push('Diagnostico;Valor');
    lines.push(`Periodo;${stats.start} a ${stats.end}`);
    lines.push(`Hoje (SP);${stats.today}`);
    lines.push(`dias_totais;${n1(stats.diasPonderadosTotais)}`);
    lines.push(`dias_decorridos;${n1(stats.diasPonderadosDecorridos)}`);
    lines.push(`peso_hoje;${n1(stats.pesoHoje)}`);
    lines.push(`dias_restantes;${n1(stats.diasPonderadosRestantes)}`);
    lines.push(`decorridos + restantes = totais;${n1(soma)} ${invarianteOk ? 'OK' : 'DIVERGENTE'}`);
    if (indicators) {
      lines.push(`realizado_ate_ontem;${n2(indicators.realizadoAteOntem)}`);
      lines.push(`realizado_hoje;${n2(indicators.realizadoHoje)}`);
      lines.push(`realizado_total;${n2(indicators.realizado)}`);
      lines.push('');
      lines.push('Formula');
      formulas.forEach((f) => lines.push(f.replace(/;/g, ',')));
    }
    lines.push('');
    lines.push('Data;Dia da semana;Peso;Motivo;Posicao');
    engine.listDays(stats.start, stats.end).forEach((d) => {
      const weekday = WEEKDAYS[new Date(`${d.key}T12:00:00`).getDay()];
      const posicao = d.key < stats.today ? 'Decorrido' : d.key === stats.today ? 'Hoje' : 'Restante';
      lines.push(`${d.key};${weekday};${n1(d.weight)};${motivoDe(d)};${posicao}`);
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `diagnostico-meta_${stats.start}_a_${stats.end}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (!hasRole('admin')) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Diagnóstico do cálculo" className="h-7 w-7 text-muted-foreground" title="Diagnóstico do cálculo">
          <Stethoscope className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4 pr-8">
            <span>Diagnóstico — dias úteis ponderados</span>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p className="text-muted-foreground">Período</p><p className="font-medium">{stats.start} → {stats.end}</p></div>
          <div><p className="text-muted-foreground">Hoje (SP)</p><p className="font-medium">{stats.today}</p></div>
          <div><p className="text-muted-foreground">Dias totais</p><p className="font-medium">{n1(stats.diasPonderadosTotais)}</p></div>
          <div><p className="text-muted-foreground">Peso de hoje</p><p className="font-medium">{n1(stats.pesoHoje)}</p></div>
          <div><p className="text-muted-foreground">Decorridos (antes de hoje)</p><p className="font-medium">{n1(stats.diasPonderadosDecorridos)}</p></div>
          <div><p className="text-muted-foreground">Restantes (inclui hoje)</p><p className="font-medium">{n1(stats.diasPonderadosRestantes)}</p></div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Invariante decorridos + restantes = totais</p>
            <p className={invarianteOk ? 'font-medium text-success' : 'font-medium text-destructive'}>
              {n1(soma)} {invarianteOk ? '✓ OK' : '✗ divergente'}
            </p>
          </div>
        </div>

        {indicators && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm rounded-md border p-3">
              <div><p className="text-muted-foreground">realizado_ate_ontem</p><p className="font-medium">{n2(indicators.realizadoAteOntem)}</p></div>
              <div><p className="text-muted-foreground">realizado_hoje</p><p className="font-medium">{n2(indicators.realizadoHoje)}</p></div>
              <div><p className="text-muted-foreground">realizado_total</p><p className="font-medium">{n2(indicators.realizado)}</p></div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-medium mb-2">Fórmulas com valores substituídos</p>
              <ul className="space-y-1 font-mono text-xs text-muted-foreground">
                {formulas.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          </>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Dia da semana</TableHead>
              <TableHead className="text-right">Peso</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Posição</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((d) => {
              const weekday = WEEKDAYS[new Date(`${d.key}T12:00:00`).getDay()];
              const posicao = d.key < stats.today ? 'Decorrido' : d.key === stats.today ? 'Hoje' : 'Restante';
              return (
                <TableRow key={d.key} className={d.key === stats.today ? 'bg-muted/60' : undefined}>
                  <TableCell>{d.key}</TableCell>
                  <TableCell>{weekday}</TableCell>
                  <TableCell className="text-right">{n1(d.weight)}</TableCell>
                  <TableCell>{motivoDe(d)}</TableCell>
                  <TableCell>{posicao}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};

export default GoalDiagnosticsDialog;
