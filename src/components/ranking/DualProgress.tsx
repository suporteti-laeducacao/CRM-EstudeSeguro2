import { cn } from '@/lib/utils';

interface Props {
  /** percentual realizado (0-100) */
  value: number;
  /** percentual de tempo decorrido / esperado (0-100) */
  expected: number;
  className?: string;
  /** exibe rótulo "Realizado X% · Esperado Y%" */
  showLabel?: boolean;
  labelClassName?: string;
  barClassName?: string;
}

/**
 * Barra dupla: barra sólida do realizado + barra fina tracejada (cinza) do
 * percentual de tempo decorrido (onde deveríamos estar).
 */
const fmt = (p: number) => `${(Math.floor(Math.max(p, 0) * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const DualProgress = ({ value, expected, className, showLabel, labelClassName, barClassName }: Props) => {
  const v = Math.min(Math.max(value, 0), 100);
  const e = Math.min(Math.max(expected, 0), 100);

  return (
    <div className={cn('space-y-1', className)}>
      <div className={cn('relative h-3 w-full overflow-hidden rounded-full bg-ink-100', barClassName)}>
        <div
          className={cn('h-full transition-all', v >= 100 ? 'bg-brand' : 'bg-ink-950')}
          style={{ width: `${v}%` }}
        />
      </div>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-ink-100"
        title={`Esperado até ontem: ${e.toFixed(1)}% do período`}
      >
        <div
          className="h-full border-y border-dashed border-muted-foreground/60 bg-muted-foreground/40 transition-all"
          style={{
            width: `${e}%`,
            backgroundImage:
              'repeating-linear-gradient(45deg, hsl(var(--muted-foreground)/0.55) 0 4px, transparent 4px 8px)',
          }}
        />
      </div>
      {showLabel && (
        <p className={cn('text-[11px] text-muted-foreground', labelClassName)}>
          Realizado {fmt(value)} · Esperado {fmt(expected)}
        </p>
      )}
    </div>
  );
};

export default DualProgress;
