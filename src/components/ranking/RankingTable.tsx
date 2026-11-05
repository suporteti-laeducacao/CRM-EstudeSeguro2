import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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

interface RankingTableProps {
  sellers: SellerStats[];
  formatCurrency: (value: number) => string;
  changedPositions: Set<string>;
  isFullscreen?: boolean;
  showOnlyAfterTop3?: boolean;
  metaBySellerName?: Map<string, number>;
}

const RankingTable = ({ 
  sellers, 
  formatCurrency, 
  changedPositions,
  isFullscreen,
  showOnlyAfterTop3 = false,
  metaBySellerName,
}: RankingTableProps) => {
  const displaySellers = sellers.slice(3);
  const startIndex = 3;
  const hasMetas = metaBySellerName && metaBySellerName.size > 0;

  if (displaySellers.length === 0) {
    return (
      <div className={cn(
        "text-center py-12 text-muted-foreground",
        isFullscreen && "text-2xl py-20",
      )}>
        Sem vendedores adicionais além do pódio
      </div>
    );
  }

  const getMetaIndicator = (percent: number) => {
    if (percent >= 100) return '🟢';
    if (percent >= 70) return '🟡';
    return '🔴';
  };

  const getStatusBadge = (percent: number) => {
    if (percent >= 100) return <Badge className="bg-[#E7F7F0] text-[#07714E] border-transparent">🟢 Acima ({percent.toFixed(0)}%)</Badge>;
    if (percent >= 70) return <Badge className="bg-[#FFF1E7] text-[#B44309] border-transparent">🟡 Na meta ({percent.toFixed(0)}%)</Badge>;
    return <Badge variant="destructive">🔴 Abaixo ({percent.toFixed(0)}%)</Badge>;
  };

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className={cn(isFullscreen && "text-lg")}>
            <TableHead className="w-20">Posição</TableHead>
            <TableHead>Vendedor</TableHead>
            <TableHead className="text-right">Nº Vendas</TableHead>
            <TableHead className="text-right">Total Faturado</TableHead>
            <TableHead className="text-right">Ticket Médio</TableHead>
            {hasMetas && <TableHead className="text-right">Meta</TableHead>}
            {hasMetas && <TableHead className="text-right">Diferença</TableHead>}
            
            {hasMetas && <TableHead className="w-40">% Atingido</TableHead>}
            {hasMetas && <TableHead>Status</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displaySellers.map((stat, index) => {
            const position = startIndex + index;
            const isChanged = changedPositions.has(stat.name);
            const metaValor = metaBySellerName?.get(stat.name);
            const metaPercent = metaValor ? (stat.totalAmount / metaValor) * 100 : 0;
            const diff = metaValor ? stat.totalAmount - metaValor : 0;
            
            return (
              <TableRow 
                key={stat.name}
                className={cn(
                  "h-14 transition-all duration-500",
                  isChanged && "bg-brand-tint",
                  isFullscreen && "text-lg",
                )}
              >
                <TableCell className="font-bold tabular-nums text-ink-400">
                  <span className={cn("text-sm", isFullscreen && "text-xl")}>{position + 1}º</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className={cn(isFullscreen ? "h-10 w-10" : "h-8 w-8")}>
                      <AvatarImage src={stat.fotoUrl} alt={stat.name} />
                      <AvatarFallback className="text-xs bg-ink-950 text-brand">
                        {stat.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className={cn("font-medium", isFullscreen && "text-xl")}>{stat.name}</span>
                  </div>
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", isFullscreen && "text-xl")}>{stat.salesCount}</TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums text-ink-950", isFullscreen && "text-xl")}>{formatCurrency(stat.totalAmount)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", isFullscreen && "text-xl")}>{formatCurrency(stat.averageTicket)}</TableCell>
                {hasMetas && (
                  <TableCell className={cn("text-right tabular-nums", isFullscreen && "text-xl")}>
                    {metaValor ? formatCurrency(metaValor) : <span className="text-ink-400">-</span>}
                  </TableCell>
                )}
                {hasMetas && (
                  <TableCell className={cn("text-right tabular-nums", isFullscreen && "text-xl", metaValor ? (diff >= 0 ? "text-success" : "text-destructive") : "")}>
                    {metaValor ? (diff >= 0 ? '+' : '') + formatCurrency(diff) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                )}
                {hasMetas && (
                  <TableCell>
                    {metaValor ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getMetaIndicator(metaPercent)}</span>
                        <Progress value={Math.min(metaPercent, 100)} className="h-2 flex-1" />
                        <span className={cn("text-xs font-medium whitespace-nowrap", isFullscreen && "text-sm")}>
                          {metaPercent.toFixed(0)}%
                        </span>
                      </div>
                    ) : <span className="text-muted-foreground text-sm">-</span>}
                  </TableCell>
                )}
                {hasMetas && (
                  <TableCell>
                    {metaValor ? getStatusBadge(metaPercent) : <span className="text-muted-foreground">-</span>}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default RankingTable;
