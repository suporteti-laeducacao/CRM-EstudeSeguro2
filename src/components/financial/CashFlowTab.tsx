import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFinancial } from '@/contexts/FinancialContext';
import { Installment } from '@/lib/types';
import { parseLocalDate } from '@/lib/date';

const CashFlowTab = () => {
  const { installments } = useFinancial();
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const data = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayInstallments = installments.filter(i => {
        const dueDate = parseLocalDate(i.dueDate);
        return dueDate.getFullYear() === year &&
               dueDate.getMonth() === month &&
               dueDate.getDate() === day;
      });

      const receivable = dayInstallments
        .filter(i => i.status !== 'paid')
        .reduce((sum, i) => sum + i.value, 0);

      const paid = dayInstallments
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (i.paidAmount || i.value), 0);

      const overdue = dayInstallments
        .filter(i => i.status === 'overdue')
        .reduce((sum, i) => sum + i.value, 0);

      data.push({
        date,
        receivable,
        paid,
        overdue,
        installments: dayInstallments,
      });
    }

    return data;
  }, [installments, currentDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getFirstDayOfWeek = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return firstDay.getDay();
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-6">
      {/* Month Navigation */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">
          {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2">
          <Button aria-label="Mês anterior" variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button aria-label="Próximo mês" variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 items-center text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-success/20 border border-success"></div>
          <span>Pago</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-warning/20 border border-warning"></div>
          <span>Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-destructive/20 border border-destructive"></div>
          <span>Atrasado</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Week day headers */}
        {weekDays.map(day => (
          <div key={day} className="text-center font-semibold text-sm p-2">
            {day}
          </div>
        ))}

        {/* Empty cells for first week */}
        {Array.from({ length: getFirstDayOfWeek() }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2"></div>
        ))}

        {/* Calendar days */}
        {monthData.map((dayData, i) => {
          const hasPayments = dayData.paid > 0 || dayData.receivable > 0 || dayData.overdue > 0;
          let bgColor = 'bg-card';
          let borderColor = 'border-border';
          
          if (hasPayments) {
            if (dayData.overdue > 0) {
              bgColor = 'bg-destructive/10';
              borderColor = 'border-destructive';
            } else if (dayData.receivable > 0) {
              bgColor = 'bg-warning/10';
              borderColor = 'border-warning';
            } else if (dayData.paid > 0) {
              bgColor = 'bg-success/10';
              borderColor = 'border-success';
            }
          }

          return (
            <Card
              key={i}
              className={`p-2 min-h-[100px] ${bgColor} border ${borderColor}`}
            >
              <div className="font-semibold text-sm mb-2">
                {dayData.date.getDate()}
              </div>
              {hasPayments && (
                <div className="space-y-1 text-xs">
                  {dayData.paid > 0 && (
                    <div className="text-success font-medium">
                      {formatCurrency(dayData.paid)}
                    </div>
                  )}
                  {dayData.receivable > 0 && (
                    <div className="text-warning font-medium">
                      {formatCurrency(dayData.receivable)}
                    </div>
                  )}
                  {dayData.overdue > 0 && (
                    <div className="text-destructive font-medium">
                      {formatCurrency(dayData.overdue)}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    {dayData.installments.length} parcela(s)
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <Card className="p-6">
        <h4 className="font-semibold mb-4">Resumo do Mês</h4>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Recebido</p>
            <p className="text-2xl font-bold text-success">
              {formatCurrency(monthData.reduce((sum, d) => sum + d.paid, 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">A Receber</p>
            <p className="text-2xl font-bold text-warning">
              {formatCurrency(monthData.reduce((sum, d) => sum + d.receivable, 0))}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Atrasado</p>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(monthData.reduce((sum, d) => sum + d.overdue, 0))}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CashFlowTab;
