import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';
import { Sale } from '@/lib/types';

interface RecentSalesProps {
  formatCurrency: (value: number) => string;
}

const RecentSales = ({ formatCurrency }: RecentSalesProps) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSales = async () => {
      const data = await storage.getSales();
      setSales(data.slice(0, 5));
      setLoading(false);
    };
    loadSales();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Nenhuma venda registrada ainda
      </p>
    );
  }

  return (
    <div>
      {sales.map((sale) => (
        <div key={sale.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-ink-100 py-2 last:border-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-950 truncate">{sale.studentName}</p>
            <p className="text-[12.5px] text-ink-500 truncate">{sale.course}</p>
          </div>
          <p className="text-sm font-semibold text-ink-950 tabular-nums">
            {formatCurrency(sale.amount)}
          </p>
        </div>
      ))}
    </div>
  );
};

export default RecentSales;
