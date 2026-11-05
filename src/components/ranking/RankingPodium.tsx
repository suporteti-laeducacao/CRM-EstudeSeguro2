import { Trophy, Crown, Medal, Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import DualProgress from './DualProgress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface SellerStats {
  name: string;
  totalSales: number;
  totalAmount: number;
  salesCount: number;
  averageTicket: number;
  fotoUrl?: string;
}

interface RankingPodiumProps {
  sellers: SellerStats[];
  formatCurrency: (value: number) => string;
  isFullscreen?: boolean;
  metaBySellerName?: Map<string, number>;
  /** percentual de tempo decorrido do período (0-100) — barra de esperado */
  expectedPercent?: number;
  /** realizado de hoje por vendedor */
  todayBySellerName?: Map<string, number>;
}

export const formatPercent = (p: number) => {
  const t = Math.floor(p * 10) / 10;
  return `${t.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

const podiumStyles = {
  1: {
    gradient: 'from-ink-900 to-ink-950',
    glow: 'shadow-[0_12px_32px_-12px_hsl(var(--brand)/0.45)]',
    border: 'border border-brand/70',
    icon: Crown,
    iconColor: 'text-brand',
    label: '1º Lugar',
    size: 'scale-100',
    zIndex: 'z-30',
  },
  2: {
    gradient: 'from-ink-100 to-ink-200',
    glow: 'shadow-card',
    border: 'border-ink-200',
    icon: Medal,
    iconColor: 'text-ink-700',
    label: '2º Lugar',
    size: 'scale-100',
    zIndex: 'z-20',
  },
  3: {
    gradient: 'from-ink-100 to-ink-200',
    glow: 'shadow-card',
    border: 'border-ink-200',
    icon: Trophy,
    iconColor: 'text-ink-700',
    label: '3º Lugar',
    size: 'scale-100',
    zIndex: 'z-10',
  },
};

const RankingPodium = ({ sellers, formatCurrency, isFullscreen, metaBySellerName, expectedPercent = 0, todayBySellerName }: RankingPodiumProps) => {
  const top3 = sellers.slice(0, 3);
  
  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 3 
    ? [top3[1], top3[0], top3[2]] 
    : top3.length === 2 
    ? [top3[1], top3[0]] 
    : top3;

  const getPosition = (index: number): 1 | 2 | 3 => {
    if (top3.length >= 3) {
      return [2, 1, 3][index] as 1 | 2 | 3;
    }
    if (top3.length === 2) {
      return [2, 1][index] as 1 | 2;
    }
    return 1;
  };

  if (top3.length === 0) return null;

  return (
    <div className={cn(
      "grid gap-4 mb-8",
      isFullscreen ? "grid-cols-3 max-w-6xl mx-auto" : "grid-cols-1 md:grid-cols-3",
    )}>
      {podiumOrder.map((seller, index) => {
        const position = getPosition(index);
        const style = podiumStyles[position];
        const Icon = style.icon;
        
        return (
          <div
            key={seller.name}
            className={cn(
              "relative group transition-all duration-500 ease-out",
              style.size,
              style.zIndex,
              position === 1 && "md:-mt-4",
              position !== 1 && "md:mt-4",
            )}
          >
            {/* Card */}
            <div className={cn(
              "relative overflow-hidden rounded-[14px] border p-6 transition-colors duration-150",
              style.border,
              style.glow,
              position === 1 ? "bg-gradient-to-b from-brand-tint via-card to-card px-7 py-7" : "bg-card",
              isFullscreen && "p-8",
            )}>
              {/* Sparkle for 1st place */}
              {position === 1 && (
                <Star className="absolute top-3 right-3 w-4 h-4 text-brand fill-brand/30" />
              )}

              {/* Content */}
              <div className="relative z-10 text-center">
                {/* Avatar with position badge */}
                <div className={cn("relative inline-block", position === 1 ? "mb-5" : "mb-4")}>
                  {position === 1 && (
                    <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 shadow-[0_6px_18px_-6px_hsl(var(--brand)/0.6)]" />
                  )}
                  <Avatar className={cn(
                    "relative",
                    isFullscreen ? "h-24 w-24" : position === 1 ? "h-16 w-16" : "h-10 w-10",
                    position === 1 ? "ring-[3px] ring-card" : "ring-1 ring-ink-200",
                  )}>
                    <AvatarImage src={seller.fotoUrl} alt={seller.name} />
                    <AvatarFallback className={cn(
                      "font-bold",
                      isFullscreen ? "text-2xl" : position === 1 ? "text-lg" : "text-sm",
                      position === 1 ? "bg-brand text-ink-950" : "bg-ink-100 text-ink-700",
                    )}>
                      {seller.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className={cn(
                    "absolute -bottom-1 -right-1 flex items-center justify-center rounded-full",
                    isFullscreen ? "w-8 h-8" : position === 1 ? "w-7 h-7 ring-2 ring-card" : "w-6 h-6",
                    position === 1 ? "bg-ink-950" : "bg-ink-100",
                  )}>
                    <Icon className={cn(
                      style.iconColor,
                      isFullscreen ? "w-4 h-4" : position === 1 ? "w-3.5 h-3.5" : "w-3 h-3",
                    )} />
                  </div>
                </div>

                {/* Position label */}
                {position === 1 ? (
                  <div className="mb-2 flex justify-center">
                    <span className={cn(
                      "font-display inline-flex items-center rounded-full bg-ink-950 px-4 py-1 text-[26px] leading-tight tracking-tight text-brand tabular-nums",
                      isFullscreen && "text-[40px] px-6",
                    )}>
                      {style.label}
                    </span>
                  </div>
                ) : (
                <div className={cn(
                  "font-display mb-2 tabular-nums text-[28px] leading-none text-ink-950",
                  isFullscreen && "text-[40px]",
                )}>
                  {style.label}
                </div>
                )}

                {/* Name */}
                <h3 className={cn(
                  "text-xl font-bold mb-4 truncate",
                  "text-ink-900",
                  isFullscreen && "text-3xl",
                )}>
                  {seller.name}
                </h3>

                {/* Stats */}
                <div className={cn(
                  "space-y-2",
                  isFullscreen && "space-y-3",
                )}>
                  <div className={cn(
                    "text-[20px] font-bold tabular-nums",
                    position === 1 ? "text-[24px] text-ink-950" : "text-ink-950",
                    isFullscreen && "text-5xl",
                  )}>
                    {formatCurrency(seller.totalAmount)}
                  </div>
                  <div className={cn(
                    "text-sm tabular-nums",
                    "text-ink-500",
                    isFullscreen && "text-lg",
                  )}>
                    {seller.salesCount} vendas
                  </div>
                  <div className={cn(
                    "text-xs tabular-nums",
                    "text-ink-500",
                    isFullscreen && "text-base",
                  )}>
                    Ticket médio: {formatCurrency(seller.averageTicket)}
                  </div>
                  {/* Meta info */}
                  {metaBySellerName && (() => {
                    const metaValor = metaBySellerName.get(seller.name);
                    if (!metaValor) return null;
                    const metaPercent = (seller.totalAmount / metaValor) * 100;
                    const indicator = metaPercent >= 100 ? '🟢' : metaPercent >= 70 ? '🟡' : '🔴';
                    const faltam = Math.max(metaValor - seller.totalAmount, 0);
                    return (
                      <div className={cn("mt-3 pt-3 border-t", position === 1 ? "space-y-2 border-brand/30" : "space-y-1 border-ink-100")}>
                        <div className={cn("text-xs flex justify-between tabular-nums", "text-ink-500", isFullscreen && "text-sm")}>
                          <span>Meta: {formatCurrency(metaValor)}</span>
                          <span>{indicator} {formatPercent(metaPercent)}</span>
                        </div>
                        <DualProgress value={metaPercent} expected={expectedPercent} showLabel barClassName="h-2" />
                        {todayBySellerName && (
                          <div className={cn("text-xs tabular-nums", "text-ink-500", isFullscreen && "text-sm")}>
                            Hoje: {formatCurrency(todayBySellerName.get(seller.name) || 0)}
                          </div>
                        )}
                        <div className={cn("text-xs font-medium tabular-nums", isFullscreen && "text-sm", faltam > 0 ? "text-destructive" : "text-success")}>
                          {faltam > 0
                            ? `Faltam ${formatCurrency(faltam)}`
                            : `Excedeu ${formatCurrency(seller.totalAmount - metaValor)}`}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RankingPodium;
