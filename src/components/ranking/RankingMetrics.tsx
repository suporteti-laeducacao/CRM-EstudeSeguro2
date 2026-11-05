import { DollarSign, TrendingUp, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface RankingMetricsProps {
  totalAmount: number;
  totalSalesCount: number;
  activeVendorsCount: number;
  formatCurrency: (value: number) => string;
  isFullscreen?: boolean;
  metaGeralValor?: number;
}

const RankingMetrics = ({
  totalAmount,
  totalSalesCount,
  formatCurrency,
  isFullscreen,
  metaGeralValor,
}: RankingMetricsProps) => {
  const remaining = metaGeralValor ? Math.max(metaGeralValor - totalAmount, 0) : 0;

  return (
    <div className={cn(
      "grid gap-4",
      isFullscreen ? "grid-cols-3 max-w-4xl mx-auto" : "grid-cols-1 md:grid-cols-3",
    )}>
      <Card className={cn(isFullscreen && "bg-card/80 backdrop-blur-sm")}>
        <CardHeader className={cn(
          "flex flex-row items-center justify-between space-y-0 pb-2",
          isFullscreen && "pb-4",
        )}>
          <CardTitle className={cn("text-sm font-medium", isFullscreen && "text-lg")}>
            Total Faturado
          </CardTitle>
          <DollarSign className={cn("h-4 w-4 text-muted-foreground", isFullscreen && "h-6 w-6")} />
        </CardHeader>
        <CardContent>
          <div className={cn("font-display text-[26px] leading-8 tabular-nums text-ink-950", isFullscreen && "text-4xl")}>
            {formatCurrency(totalAmount)}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(isFullscreen && "bg-card/80 backdrop-blur-sm")}>
        <CardHeader className={cn(
          "flex flex-row items-center justify-between space-y-0 pb-2",
          isFullscreen && "pb-4",
        )}>
          <CardTitle className={cn("text-sm font-medium", isFullscreen && "text-lg")}>
            Total de Vendas
          </CardTitle>
          <TrendingUp className={cn("h-4 w-4 text-muted-foreground", isFullscreen && "h-6 w-6")} />
        </CardHeader>
        <CardContent>
          <div className={cn("font-display text-[26px] leading-8 tabular-nums", isFullscreen && "text-4xl")}>
            {totalSalesCount}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(isFullscreen && "bg-card/80 backdrop-blur-sm")}>
        <CardHeader className={cn(
          "flex flex-row items-center justify-between space-y-0 pb-2",
          isFullscreen && "pb-4",
        )}>
          <CardTitle className={cn("text-sm font-medium", isFullscreen && "text-lg")}>
            {metaGeralValor && remaining <= 0 ? 'Acima da Meta 🎉' : 'Restante p/ Meta'}
          </CardTitle>
          <Target className={cn("h-4 w-4 text-muted-foreground", isFullscreen && "h-6 w-6")} />
        </CardHeader>
        <CardContent>
          <div className={cn(
            "font-display text-[26px] leading-8 tabular-nums",
            isFullscreen && "text-4xl",
            metaGeralValor ? (remaining <= 0 ? "text-success" : "text-destructive") : "text-muted-foreground",
          )}>
            {metaGeralValor ? formatCurrency(remaining) : 'Sem meta'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RankingMetrics;
